package whatsapp

import (
	"time"

	"github.com/ayt-sales/backend/internal/config"
	"github.com/ayt-sales/backend/internal/database"
	"github.com/ayt-sales/backend/internal/models"
)

// Provider is the abstraction that lets the app send/read WhatsApp messages
// through whichever backend (WABA or WAHA) is currently selected in Settings.
type Provider interface {
	SendText(phone, text string) error
	MarkAsRead(phone string, lastInboundMessageID *string) error
}

// HistorySyncer is an optional capability — only WAHA supports pulling past
// messages (Meta's Cloud API has no equivalent bulk-history endpoint).
// Handlers type-assert whatsapp.Current() against this interface.
type HistorySyncer interface {
	FetchHistory(phone string, limit int) ([]HistoryMessage, error)
}

type HistoryMessage struct {
	ProviderMessageID string
	FromMe            bool
	Body              string
	Timestamp         time.Time
}

var cfg *config.Config

// Init must be called once at startup with the loaded config.
func Init(c *config.Config) { cfg = c }

// Current returns the Provider implementation selected via the
// "whatsapp_provider" Setting (defaults to WABA if unset/invalid).
func Current() Provider {
	if getProviderSetting() == "waha" {
		return &WahaProvider{}
	}
	return &WabaProvider{}
}

// getProviderSetting queries the Setting table directly instead of going through
// handlers.GetDormantHours-style helpers, to avoid an import cycle (handlers
// needs to import this package to send messages).
func getProviderSetting() string {
	var s models.Setting
	if err := database.DB.Where("key = ?", "whatsapp_provider").First(&s).Error; err != nil {
		return "waba"
	}
	return s.Value
}
