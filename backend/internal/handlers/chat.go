package handlers

import (
	"net/http"
	"time"

	"github.com/ayt-sales/backend/internal/database"
	"github.com/ayt-sales/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func GetLead(c *gin.Context) {
	var lead models.Lead
	if err := database.DB.Preload("Customer").Preload("Sales").Preload("Source").Preload("Input").
		Preload("Quality").Preload("Status").Preload("Result").Preload("Product.Country").
		Preload("Group").First(&lead, "id = ?", c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Lead not found"})
		return
	}
	c.JSON(http.StatusOK, lead)
}

func GetLeadChats(c *gin.Context) {
	var chats []models.Chat
	database.DB.Where("lead_id = ?", c.Param("id")).Order("chat_timestamp ASC").Find(&chats)
	c.JSON(http.StatusOK, chats)
}

type CreateChatRequest struct {
	Direction string `json:"direction" binding:"required,oneof=in out"`
	Body      string `json:"body" binding:"required"`
}

func CreateLeadChat(c *gin.Context) {
	var lead models.Lead
	if err := database.DB.First(&lead, "id = ?", c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Lead not found"})
		return
	}

	var req CreateChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.MustGet("user_id").(uuid.UUID)
	now := time.Now()
	chat := models.Chat{
		ID:            uuid.New(),
		LeadID:        lead.ID,
		CustomerID:    lead.CustomerID,
		Direction:     req.Direction,
		Body:          req.Body,
		ChatTimestamp: now,
		CreatedBy:     &userID,
	}
	database.DB.Create(&chat)
	database.DB.Model(&lead).Update("last_chat_at", now)

	c.JSON(http.StatusCreated, chat)
}
