package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/ayt-sales/backend/internal/whatsapp"
	"github.com/gin-gonic/gin"
)

type WahaWebhookPayload struct {
	Event   string `json:"event"`
	Session string `json:"session"`
	Payload struct {
		ID          string `json:"id"`
		Timestamp   int64  `json:"timestamp"`
		From        string `json:"from"`
		FromMe      bool   `json:"fromMe"`
		Body        string `json:"body"`
		Participant string `json:"participant"` // populated on group (@g.us) messages: the actual sender's id
		Data        struct {
			NotifyName string `json:"notifyName"`
		} `json:"_data"`
	} `json:"payload"`
}

// resolveSenderPhone returns the individual sender's phone number.
//
// For a direct chat, "from" is normally "<phone>@c.us". For a group chat,
// "from" is the group's own id ("...@g.us") and the actual sender is in
// "participant" instead.
//
// Either identifier can also come back as a WhatsApp "LID" ("...@lid") instead
// of a real phone-based id — WhatsApp's newer privacy layer that masks the
// sender even on direct messages, not just in groups. When that happens we
// attempt a lookup via WAHA's contact API; if WAHA has no mapping (e.g. the
// sender isn't a saved contact), we fall back to the group id (or the raw lid
// on a direct chat) so the conversation is still tracked as a distinct thread,
// just without a real phone number attached.
func resolveSenderPhone(from, participant string) string {
	candidate := from
	if strings.HasSuffix(from, "@g.us") && participant != "" {
		candidate = participant
	}

	if strings.HasSuffix(candidate, "@c.us") {
		return strings.TrimSuffix(candidate, "@c.us")
	}
	if strings.HasSuffix(candidate, "@lid") {
		if real, ok := whatsapp.ResolveLid(candidate); ok {
			return real
		}
	}

	return strings.TrimSuffix(from, "@c.us")
}

// WahaWebhook receives WAHA's "message" event and feeds it into the same
// ingestion pipeline the WABA webhook uses. WAHA carries no Meta-ads-referral
// concept, so every WAHA-sourced lead is attributed to "Organik".
func WahaWebhook(c *gin.Context) {
	var payload WahaWebhookPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if payload.Event != "message" || payload.Payload.FromMe {
		c.JSON(http.StatusOK, gin.H{"status": "ignored"})
		return
	}

	phone := resolveSenderPhone(payload.Payload.From, payload.Payload.Participant)
	chatTime := time.Now()
	if payload.Payload.Timestamp > 0 {
		chatTime = time.Unix(payload.Payload.Timestamp, 0)
	}

	var providerMessageID *string
	if payload.Payload.ID != "" {
		providerMessageID = &payload.Payload.ID
	}

	ingestInboundMessage(phone, payload.Payload.Data.NotifyName, payload.Payload.Body, chatTime, "Organik", providerMessageID)

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
