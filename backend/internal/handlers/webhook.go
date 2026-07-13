package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
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
	ID   string `json:"id"`
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
				handleWabaInboundMessage(msg, contactName)
				processed++
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok", "processed": processed})
}

func handleWabaInboundMessage(msg WebhookMessage, contactName string) {
	phone := msg.From
	chatTime := time.Now()
	if ts, err := strconv.ParseInt(msg.Timestamp, 10, 64); err == nil {
		chatTime = time.Unix(ts, 0)
	}

	sourceName := "Organik"
	if msg.Referral != nil && msg.Referral.SourceType == "ad" {
		sourceName = "Ads"
	}

	var providerMessageID *string
	if msg.ID != "" {
		providerMessageID = &msg.ID
	}

	ingestInboundMessage(phone, contactName, msg.Text.Body, chatTime, sourceName, providerMessageID)
}
