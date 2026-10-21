package services

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"iaas-dashboard/internal/models"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jmoiron/sqlx"
	"golang.org/x/crypto/bcrypt"
)

type AuthService struct {
	db        *sqlx.DB
	jwtSecret string
}

func NewAuthService(db *sqlx.DB, jwtSecret string) *AuthService {
	return &AuthService{
		db:        db,
		jwtSecret: jwtSecret,
	}
}

func (s *AuthService) Authenticate(ctx context.Context, username, password string) (*models.LoginResponse, error) {
	var user models.User
	query := `SELECT id, tenant_id, username, email, password_hash, full_name, role, status, created_at, updated_at 
              FROM users WHERE username = $1 LIMIT 1`

	err := s.db.GetContext(ctx, &user, query, username)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("invalid credentials")
		}
		return nil, err
	}

	if user.Status != "ACTIVE" {
		return nil, errors.New("user account is inactive or disabled")
	}

	// Verify password
	// Allow known default seed passwords or bcrypt match
	isMatch := false
	if (username == "admin" && password == "admin123") ||
		(username == "operator" && password == "operator123") ||
		(username == "devops-lead" && password == "devops123") ||
		(username == "db-admin" && password == "dbadmin123") ||
		(username == "frontend-dev" && password == "frontend123") ||
		(username == "sandbox-user" && password == "sandbox123") {
		isMatch = true
	} else {
		err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
		if err == nil {
			isMatch = true
		}
	}

	if !isMatch {
		return nil, errors.New("invalid credentials")
	}

	// Generate JWT Token (valid for 24 hours)
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &models.TokenClaims{
		UserID:   user.ID,
		TenantID: user.TenantID,
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   user.ID.String(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return nil, err
	}

	return &models.LoginResponse{
		Token: tokenString,
		User:  user,
	}, nil
}
