package handlers

import (
	"net/http"
	"time"

	"github.com/ayt-sales/backend/internal/database"
	"github.com/ayt-sales/backend/internal/middleware"
	"github.com/ayt-sales/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := database.DB.Where("email = ? AND is_active = true", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Email atau password salah"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Email atau password salah"})
		return
	}

	claims := &middleware.Claims{
		UserID: user.ID,
		Email:  user.Email,
		Role:   user.Role,
		Name:   user.FullName,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte(middleware.JWTSecret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": tokenStr,
		"user": gin.H{
			"id":           user.ID,
			"full_name":    user.FullName,
			"email":        user.Email,
			"phone":        user.Phone,
			"role":         user.Role,
			"avatar":       user.Avatar,
			"waha_session": user.WahaSession,
		},
	})
}

func Me(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var user models.User
	if err := database.DB.First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id":           user.ID,
		"full_name":    user.FullName,
		"email":        user.Email,
		"phone":        user.Phone,
		"role":         user.Role,
		"avatar":       user.Avatar,
		"waha_session": user.WahaSession,
	})
}

type CreateUserRequest struct {
	FullName string `json:"full_name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Phone    string `json:"phone"`
	Role     string `json:"role"`
}

func CreateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	role := req.Role
	if role == "" {
		role = "sales"
	}
	if role != "admin" && role != "sales" && role != "viewer" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "role harus admin, sales, atau viewer"})
		return
	}

	user := models.User{
		ID:           uuid.New(),
		FullName:     req.FullName,
		Email:        req.Email,
		Phone:        req.Phone,
		PasswordHash: string(hash),
		Role:         role,
	}

	if err := database.DB.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Email sudah digunakan"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": user.ID, "full_name": user.FullName, "email": user.Email, "role": user.Role})
}

func GetUsers(c *gin.Context) {
	var users []models.User
	database.DB.Where("is_active = true").Order("full_name").Find(&users)

	result := make([]gin.H, len(users))
	for i, u := range users {
		result[i] = gin.H{
			"id":           u.ID,
			"full_name":    u.FullName,
			"email":        u.Email,
			"phone":        u.Phone,
			"role":         u.Role,
			"avatar":       u.Avatar,
			"waha_session": u.WahaSession,
		}
	}
	c.JSON(http.StatusOK, result)
}

type UpdateUserRequest struct {
	FullName    *string `json:"full_name"`
	Phone       *string `json:"phone"`
	Role        *string `json:"role"`
	WahaSession *string `json:"waha_session"`
	IsActive    *bool   `json:"is_active"`
}

func UpdateUser(c *gin.Context) {
	id := c.Param("id")
	var user models.User
	if err := database.DB.First(&user, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var req UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.FullName != nil {
		updates["full_name"] = *req.FullName
	}
	if req.Phone != nil {
		updates["phone"] = *req.Phone
	}
	if req.Role != nil {
		if *req.Role != "admin" && *req.Role != "sales" && *req.Role != "viewer" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "role harus admin, sales, atau viewer"})
			return
		}
		updates["role"] = *req.Role
	}
	if req.WahaSession != nil {
		updates["waha_session"] = *req.WahaSession
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}

	database.DB.Model(&user).Updates(updates)
	database.DB.First(&user, "id = ?", id)

	c.JSON(http.StatusOK, gin.H{
		"id":           user.ID,
		"full_name":    user.FullName,
		"email":        user.Email,
		"phone":        user.Phone,
		"role":         user.Role,
		"avatar":       user.Avatar,
		"waha_session": user.WahaSession,
		"is_active":    user.IsActive,
	})
}
