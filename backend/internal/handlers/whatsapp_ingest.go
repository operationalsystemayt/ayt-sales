package handlers

import (
	"fmt"
	"log"
	"time"

	"github.com/ayt-sales/backend/internal/database"
	"github.com/ayt-sales/backend/internal/models"
	"github.com/google/uuid"
)

// nextLeadNo generates the next "L-NNNNNN" number based on the highest existing
// suffix rather than a row COUNT — COUNT(*) collides with an already-issued
// number as soon as any lead has ever been deleted (soft-delete leaves a gap,
// but COUNT drops accordingly, so count+1 can re-mint a number that's still
// taken by a non-deleted row). Unscoped() is required here too: the unique
// index on lead_no doesn't care whether a row is soft-deleted, but GORM's
// default query scope silently excludes soft-deleted rows from MAX() — without
// it, a lead_no whose highest holder was deleted gets reissued and collides.
func nextLeadNo() string {
	var maxNo int
	database.DB.Unscoped().Model(&models.Lead{}).
		Select("COALESCE(MAX(CAST(SUBSTRING(lead_no FROM 3) AS INTEGER)), 0)").
		Scan(&maxNo)
	return fmt.Sprintf("L-%06d", maxNo+1)
}

// ingestInboundMessage is the provider-agnostic pipeline shared by every inbound
// WhatsApp webhook (WABA, WAHA, ...): find-or-create the Customer, find-or-create
// the customer's currently-open Lead, and record the Chat row. sourceName and
// providerMessageID are supplied by each provider-specific webhook parser.
// salesID (optional) assigns a newly-created lead to the sales rep whose
// registered WhatsApp number/session received this message; an already-open
// lead keeps whatever sales_id it has (reassignment is admin-only, via UpdateLead).
func ingestInboundMessage(phone, contactName, body string, chatTime time.Time, sourceName string, providerMessageID *string, salesID *uuid.UUID) {
	var customer models.Customer
	if err := database.DB.Where("phone = ?", phone).First(&customer).Error; err != nil {
		customer = models.Customer{ID: uuid.New(), FullName: contactName, Phone: phone}
		database.DB.Create(&customer)
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
	var closeResult models.MasterResult
	database.DB.Where("name = ?", "Close").First(&closeResult)

	// Find the customer's currently-open lead; the webhook may fire repeatedly for one
	// conversation. A lead that's already Converted or Closed is treated as closed —
	// a new inbound message starts a fresh lead instead of reopening it.
	q := database.DB.Where("customer_id = ? AND is_converted = false", customer.ID)
	if closeResult.ID != 0 {
		q = q.Where("result_id IS NULL OR result_id != ?", closeResult.ID)
	}
	var lead models.Lead
	err := q.Order("created_at DESC").First(&lead).Error
	if err != nil {
		lead = models.Lead{
			ID:           uuid.New(),
			CustomerID:   customer.ID,
			SalesID:      salesID,
			LeadNo:       nextLeadNo(),
			SourceID:     &source.ID,
			InputID:      &input.ID,
			QualityID:    &quality.ID,
			StatusID:     &status.ID,
			ResultID:     &result.ID,
			DateReceived: &chatTime,
			LastChatAt:   &chatTime,
		}
		if err := database.DB.Create(&lead).Error; err != nil {
			log.Println("failed to create lead from inbound webhook:", err)
			return
		}
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
		ID:                uuid.New(),
		LeadID:            lead.ID,
		CustomerID:        customer.ID,
		Direction:         "in",
		FromPhone:         phone,
		Body:              body,
		ChatTimestamp:     chatTime,
		ProviderMessageID: providerMessageID,
	})
}
