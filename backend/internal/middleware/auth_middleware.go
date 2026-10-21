package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"iaas-dashboard/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	ContextUserID   = "user_id"
	ContextTenantID = "tenant_id"
	ContextUsername = "username"
	ContextRole     = "role"
)

func AuthMiddleware(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			// Also check query param "token" (helpful for WebSocket connections like VM console)
			tokenParam := c.Query("token")
			if tokenParam != "" {
				authHeader = "Bearer " + tokenParam
			} else {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
				c.Abort()
				return
			}
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization header format"})
			c.Abort()
			return
		}

		tokenString := parts[1]
		claims := &models.TokenClaims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired authorization token"})
			c.Abort()
			return
		}

		// Save claims to context
		c.Set(ContextUserID, claims.UserID)
		c.Set(ContextTenantID, claims.TenantID)
		c.Set(ContextUsername, claims.Username)
		c.Set(ContextRole, claims.Role)

		c.Next()
	}
}

// RequireRole checks if the authenticated user has at least one of the allowed roles
func RequireRole(allowedRoles ...models.UserRole) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, exists := c.Get(ContextRole)
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"error": "User role not found in context"})
			c.Abort()
			return
		}

		userRole := roleVal.(models.UserRole)
		for _, allowed := range allowedRoles {
			if userRole == allowed {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{
			"error": fmt.Sprintf("Access denied. Role '%s' is not authorized for this operation.", userRole),
		})
		c.Abort()
	}
}

// Helper functions for handlers
func GetUserID(c *gin.Context) uuid.UUID {
	val, _ := c.Get(ContextUserID)
	return val.(uuid.UUID)
}

func GetTenantID(c *gin.Context) uuid.UUID {
	val, _ := c.Get(ContextTenantID)
	return val.(uuid.UUID)
}

func GetUserRole(c *gin.Context) models.UserRole {
	val, _ := c.Get(ContextRole)
	return val.(models.UserRole)
}
