package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/ayt-sales/backend/internal/database"
	"github.com/ayt-sales/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type WebhookPayload struct {
	Object string         `json:"object"`
	Entry  []WebhookEntry `json:"entry"`
}

type WebhookEntry struct {
	Changes []WebhookChange `json:"changes"`
}

type WebhookChange struct {
	Value WebhookValue `json:"value"`
}

type WebhookValue struct {
	Contacts []WebhookContact `json:"contacts"`
	Messages []WebhookMessage `json:"messages"`
}

type WebhookContact struct {
	Profile struct {
		Name string `json:"name"`
	} `json:"profile"`
	WaID string `json:"wa_id"`
}

type WebhookMessage struct {
	From string `json:"from"`
	Type string `json:"type"`
	Text struct {
		Body string `json:"body"`
	} `json:"text"`
	Timestamp string           `json:"timestamp"`
	Referral  *WebhookReferral `json:"referral"`
}

type WebhookReferral struct {
	SourceType   string `json:"source_type"`
	AdSourceName string `json:"ad_source_name"`
	SourceID     string `json:"source_id"`
	CtwaClid     string `json:"ctwa_clid"`
}

func WhatsAppWebhook(c *gin.Context) {
	var payload WebhookPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	processed := 0
	for _, entry := range payload.Entry {
		for _, change := range entry.Changes {
			contactName := ""
			if len(change.Value.Contacts) > 0 {
				contactName = change.Value.Contacts[0].Profile.Name
			}
			for _, msg := range change.Value.Messages {
				if msg.Type != "text" {
					continue
				}
				handleInboundMessage(msg, contactName)
				processed++
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok", "processed": processed})
}

func handleInboundMessage(msg WebhookMessage, contactName string) {
	phone := msg.From
	chatTime := time.Now()
	if ts, err := strconv.ParseInt(msg.Timestamp, 10, 64); err == nil {
		chatTime = time.Unix(ts, 0)
	}

	var customer models.Customer
	if err := database.DB.Where("phone = ?", phone).First(&customer).Error; err != nil {
		customer = models.Customer{ID: uuid.New(), FullName: contactName, Phone: phone}
		database.DB.Create(&customer)
	}

	sourceName := "Organik"
	if msg.Referral != nil && msg.Referral.SourceType == "ad" {
		sourceName = "Ads"
	}
	var source models.MasterSource
	database.DB.Where("name = ?", sourceName).First(&source)
	var input models.MasterInput
	database.DB.Where("name = ?", "Otomatis").First(&input)
	var status models.MasterStatus
	database.DB.Where("name = ?", "Need Response").First(&status)
	var quality models.MasterQuality
	database.DB.Where("name = ?", "Warm").First(&quality)
	var result models.MasterResult
	database.DB.Where("name = ?", "Belum").First(&result)

	// Find the customer's currently-open lead; the webhook may fire repeatedly for one conversation.
	var lead models.Lead
	err := database.DB.Where("customer_id = ? AND is_converted = false", customer.ID).
		Order("created_at DESC").First(&lead).Error
	if err != nil {
		var count int64
		database.DB.Model(&models.Lead{}).Count(&count)
		lead = models.Lead{
			ID:           uuid.New(),
			CustomerID:   customer.ID,
			LeadNo:       fmt.Sprintf("L-%06d", count+1),
			SourceID:     &source.ID,
			InputID:      &input.ID,
			QualityID:    &quality.ID,
			StatusID:     &status.ID,
			ResultID:     &result.ID,
			DateReceived: &chatTime,
			LastChatAt:   &chatTime,
		}
		database.DB.Create(&lead)
		database.DB.Create(&models.LeadActivity{
			ID:       uuid.New(),
			LeadID:   lead.ID,
			Activity: "Lead dibuat",
			Notes:    "Lead masuk otomatis via WhatsApp webhook",
		})
	} else {
		database.DB.Model(&lead).Update("last_chat_at", chatTime)
	}

	database.DB.Create(&models.Chat{
		ID:            uuid.New(),
		LeadID:        lead.ID,
		CustomerID:    customer.ID,
		Direction:     "in",
		FromPhone:     phone,
		Body:          msg.Text.Body,
		ChatTimestamp: chatTime,
	})
}
