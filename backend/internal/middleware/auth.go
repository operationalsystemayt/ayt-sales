package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Claims struct {
	UserID uuid.UUID `json:"user_id"`
	Email  string    `json:"email"`
	Role   string    `json:"role"`
	Name   string    `json:"name"`
	jwt.RegisteredClaims
}

var JWTSecret string

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims := &Claims{}

		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			return []byte(JWTSecret), nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("role", claims.Role)
		c.Set("name", claims.Name)
		c.Next()
	}
}

func RequireRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if r, _ := c.Get("role"); r != role {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		c.Next()
	}
}

// RequireNotViewer blocks the read-only "viewer" role from mutating routes (POST/PUT/
// PATCH/DELETE). Viewers can hit every GET endpoint but nothing that writes. Meant to be
// applied once at the top of the authenticated route group so every route is covered
// without having to annotate each one individually.
func RequireNotViewer() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == http.MethodGet {
			c.Next()
			return
		}
		if r, _ := c.Get("role"); r == "viewer" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Akun viewer tidak dapat mengubah data"})
			return
		}
		c.Next()
	}
}

func WebhookSecret(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if got := c.GetHeader("X-Webhook-Secret"); got == "" || got != secret {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid webhook secret"})
			return
		}
		c.Next()
	}
}
