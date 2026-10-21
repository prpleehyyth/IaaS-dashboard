package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"iaas-dashboard/internal/models"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"golang.org/x/crypto/bcrypt"
)

type UserService struct {
	db *sqlx.DB
}

func NewUserService(db *sqlx.DB) *UserService {
	return &UserService{db: db}
}

func (s *UserService) ListUsers(ctx context.Context) ([]models.User, error) {
	var users []models.User
	query := `SELECT u.id, u.tenant_id, u.username, u.email, u.full_name, u.role, u.status, u.created_at, u.updated_at,
                     COALESCE(t.name, 'Default Org') as tenant_name
              FROM users u
              LEFT JOIN tenants t ON u.tenant_id = t.id
              ORDER BY u.created_at ASC`

	err := s.db.SelectContext(ctx, &users, query)
	if err != nil {
		return nil, err
	}

	for i := range users {
		var vmIDs []uuid.UUID
		err := s.db.SelectContext(ctx, &vmIDs, `SELECT vm_id FROM user_vm_assignments WHERE user_id = $1`, users[i].ID)
		if err == nil {
			users[i].AssignedVMIDs = vmIDs
			users[i].AssignedVMCount = len(vmIDs)
		}
	}

	return users, nil
}

func (s *UserService) CreateUser(ctx context.Context, req models.CreateUserRequest) (*models.User, error) {
	// Check if username or email already exists
	var count int
	_ = s.db.GetContext(ctx, &count, `SELECT COUNT(*) FROM users WHERE username = $1 OR email = $2`, req.Username, req.Email)
	if count > 0 {
		return nil, errors.New("username or email is already registered")
	}

	// Resolve tenant ID
	tenantID := uuid.MustParse("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11") // default tenant
	if req.TenantID != nil && *req.TenantID != uuid.Nil {
		tenantID = *req.TenantID
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	newUser := models.User{
		ID:           uuid.New(),
		TenantID:     tenantID,
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		FullName:     req.FullName,
		Role:         req.Role,
		Status:       "ACTIVE",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	insertQuery := `INSERT INTO users (id, tenant_id, username, email, password_hash, full_name, role, status, created_at, updated_at)
                    VALUES (:id, :tenant_id, :username, :email, :password_hash, :full_name, :role, :status, :created_at, :updated_at)`

	_, err = s.db.NamedExecContext(ctx, insertQuery, newUser)
	if err != nil {
		return nil, fmt.Errorf("failed to insert user record: %w", err)
	}

	// Assign VMs if provided
	if len(req.AssignedVMs) > 0 {
		_ = s.AssignVMs(ctx, newUser.ID, req.AssignedVMs)
		newUser.AssignedVMIDs = req.AssignedVMs
		newUser.AssignedVMCount = len(req.AssignedVMs)
	}

	return &newUser, nil
}

func (s *UserService) AssignVMs(ctx context.Context, userID uuid.UUID, vmIDs []uuid.UUID) error {
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Clear previous assignments
	_, err = tx.ExecContext(ctx, `DELETE FROM user_vm_assignments WHERE user_id = $1`, userID)
	if err != nil {
		return err
	}

	// Insert new assignments
	for _, vmID := range vmIDs {
		_, err = tx.ExecContext(ctx, `INSERT INTO user_vm_assignments (user_id, vm_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, userID, vmID)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *UserService) DeleteUser(ctx context.Context, userID, currentUserID uuid.UUID) error {
	if userID == currentUserID {
		return errors.New("cannot delete your own active session")
	}

	var user models.User
	if err := s.db.GetContext(ctx, &user, `SELECT username FROM users WHERE id = $1`, userID); err != nil {
		return errors.New("user not found")
	}

	if user.Username == "admin" {
		return errors.New("cannot delete the root system administrator")
	}

	_, err := s.db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, userID)
	return err
}
