package handlers

import (
	"log"
	"net/http"
	"time"

	"github.com/ayt-sales/backend/internal/database"
	"github.com/ayt-sales/backend/internal/models"
	"github.com/ayt-sales/backend/internal/whatsapp"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func GetLead(c *gin.Context) {
	var lead models.Lead
	if err := database.DB.Preload("Customer").Preload("Sales").Preload("Source").Preload("Input").
		Preload("Quality").Preload("Status").Preload("Result").Preload("Product.Countries").
		Preload("Group").First(&lead, "id = ?", c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Lead not found"})
		return
	}
	if !ownsSalesRecord(c, lead.SalesID) {
		forbidden(c)
		return
	}
	c.JSON(http.StatusOK, lead)
}

func GetLeadChats(c *gin.Context) {
	var lead models.Lead
	if err := database.DB.First(&lead, "id = ?", c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Lead not found"})
		return
	}
	if !ownsSalesRecord(c, lead.SalesID) {
		forbidden(c)
		return
	}
	// Cap to the latest 200 messages — fetched newest-first so LIMIT keeps the
	// right window, then reversed back to chronological order for the UI.
	var chats []models.Chat
	database.DB.Where("lead_id = ?", c.Param("id")).Order("chat_timestamp DESC").Limit(200).Find(&chats)
	for i, j := 0, len(chats)-1; i < j; i, j = i+1, j-1 {
		chats[i], chats[j] = chats[j], chats[i]
	}
	c.JSON(http.StatusOK, chats)
}

type CreateChatRequest struct {
	Direction string `json:"direction" binding:"required,oneof=in out"`
	Body      string `json:"body" binding:"required"`
}

func CreateLeadChat(c *gin.Context) {
	var lead models.Lead
	if err := database.DB.Preload("Customer").Preload("Sales").First(&lead, "id = ?", c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Lead not found"})
		return
	}
	if !ownsSalesRecord(c, lead.SalesID) {
		forbidden(c)
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

	sendError := ""
	if req.Direction == "out" && lead.Customer != nil {
		session := ""
		if lead.Sales != nil {
			session = lead.Sales.WahaSession
		}
		if err := whatsapp.Current().SendText(session, lead.Customer.Phone, req.Body); err != nil {
			log.Println("whatsapp send failed:", err)
			sendError = err.Error()
		}
	}

	c.JSON(http.StatusCreated, gin.H{"chat": chat, "send_error": sendError})
}

// MarkChatRead marks the lead's most recent inbound message as read/seen through
// whichever WhatsApp provider is currently active, and clears our own internal
// unread badge for the conversation (LastReadAt) — distinct concepts: one tells
// WhatsApp the customer's message was seen, the other is what the Chat inbox
// list uses to decide whether to show an unread pill.
func MarkChatRead(c *gin.Context) {
	var lead models.Lead
	if err := database.DB.Preload("Customer").Preload("Sales").First(&lead, "id = ?", c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Lead not found"})
		return
	}
	if !ownsSalesRecord(c, lead.SalesID) {
		forbidden(c)
		return
	}

	database.DB.Model(&lead).Update("last_read_at", time.Now())

	var lastIn models.Chat
	if err := database.DB.Where("lead_id = ? AND direction = ?", lead.ID, "in").
		Order("chat_timestamp DESC").First(&lastIn).Error; err == nil {
		session := ""
		if lead.Sales != nil {
			session = lead.Sales.WahaSession
		}
		if err := whatsapp.Current().MarkAsRead(session, lead.Customer.Phone, lastIn.ProviderMessageID); err != nil {
			log.Println("whatsapp mark-as-read failed:", err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// SyncLeadChats pulls historical messages directly from the provider's API
// (only supported by providers implementing whatsapp.HistorySyncer, i.e. WAHA)
// to backfill conversations that started before our webhook was wired up.
func SyncLeadChats(c *gin.Context) {
	var lead models.Lead
	if err := database.DB.Preload("Customer").Preload("Sales").First(&lead, "id = ?", c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Lead not found"})
		return
	}
	if !ownsSalesRecord(c, lead.SalesID) {
		forbidden(c)
		return
	}

	syncer, ok := whatsapp.Current().(whatsapp.HistorySyncer)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Provider saat ini tidak mendukung sync riwayat chat"})
		return
	}

	session := ""
	if lead.Sales != nil {
		session = lead.Sales.WahaSession
	}
	messages, err := syncer.FetchHistory(session, lead.Customer.Phone, 100)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	synced := 0
	var latest *time.Time
	for _, m := range messages {
		var existing models.Chat
		if err := database.DB.Where("provider_message_id = ?", m.ProviderMessageID).First(&existing).Error; err == nil {
			continue // already have it
		}

		direction := "in"
		if m.FromMe {
			direction = "out"
		}
		msgID := m.ProviderMessageID
		database.DB.Create(&models.Chat{
			ID:                uuid.New(),
			LeadID:            lead.ID,
			CustomerID:        lead.CustomerID,
			Direction:         direction,
			Body:              m.Body,
			ChatTimestamp:     m.Timestamp,
			ProviderMessageID: &msgID,
		})
		synced++
		if latest == nil || m.Timestamp.After(*latest) {
			t := m.Timestamp
			latest = &t
		}
	}

	if latest != nil && (lead.LastChatAt == nil || latest.After(*lead.LastChatAt)) {
		database.DB.Model(&lead).Update("last_chat_at", *latest)
	}

	c.JSON(http.StatusOK, gin.H{"synced": synced})
}
