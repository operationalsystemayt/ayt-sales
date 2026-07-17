package handlers

import (
	"net/http"
	"time"

	"github.com/ayt-sales/backend/internal/database"
	"github.com/ayt-sales/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// chatInboxItem is a Lead annotated with the fields the Chat inbox list needs
// that aren't on the Lead row itself.
type chatInboxItem struct {
	models.Lead
	LastMessage *models.Chat `json:"last_message"`
	UnreadCount int64        `json:"unread_count"`
}

func chatFilters(c *gin.Context) *gorm.DB {
	q := database.DB.
		Where("EXISTS (SELECT 1 FROM chats WHERE chats.lead_id = leads.id)")

	q = scopeSalesFilter(c, q)
	if statusID := c.Query("status_id"); statusID != "" {
		q = q.Where("status_id = ?", statusID)
	}
	q = q.Where("is_archived = ?", c.Query("archived") == "true")
	if search := c.Query("search"); search != "" {
		like := "%" + search + "%"
		q = q.Where("EXISTS (SELECT 1 FROM customers WHERE customers.id = leads.customer_id AND (customers.full_name ILIKE ? OR customers.phone ILIKE ?))", like, like)
	}
	if dateFrom := c.Query("date_from"); dateFrom != "" {
		q = q.Where("last_chat_at >= ?", dateFrom)
	}
	if dateTo := c.Query("date_to"); dateTo != "" {
		q = q.Where("last_chat_at <= ?", dateTo)
	}
	return q
}

// GetChatInbox lists every conversation (a Lead with at least one Chat row),
// annotated with its last message and unread count, powering the Chat tab's
// conversation list.
func GetChatInbox(c *gin.Context) {
	var leads []models.Lead
	chatFilters(c).Model(&models.Lead{}).
		Preload("Customer").
		Preload("Sales").
		Preload("Source").
		Preload("Status").
		Preload("Product").
		Preload("Group").
		Order("last_chat_at DESC").
		Find(&leads)

	dormantHours := GetDormantHours()
	closeHours := GetCloseHours()
	needResponseID, waitingCustomerID, dormantID, closeID := statusIDsByName()

	items := make([]chatInboxItem, 0, len(leads))
	for i := range leads {
		recomputeLeadStatus(&leads[i], dormantHours, closeHours, needResponseID, waitingCustomerID, dormantID, closeID)

		var lastChat models.Chat
		database.DB.Where("lead_id = ?", leads[i].ID).Order("chat_timestamp DESC").First(&lastChat)

		unreadQuery := database.DB.Model(&models.Chat{}).Where("lead_id = ? AND direction = 'in'", leads[i].ID)
		if leads[i].LastReadAt != nil {
			unreadQuery = unreadQuery.Where("chat_timestamp > ?", *leads[i].LastReadAt)
		}
		var unread int64
		unreadQuery.Count(&unread)

		item := chatInboxItem{Lead: leads[i], UnreadCount: unread}
		if lastChat.ID != uuid.Nil {
			item.LastMessage = &lastChat
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, items)
}

// GetChatSummary powers the Chat tab's summary/SLA cards, using the exact same
// filter set and status recompute as GetChatInbox so the numbers always agree
// with what's shown in the list below them.
func GetChatSummary(c *gin.Context) {
	var leads []models.Lead
	chatFilters(c).Model(&models.Lead{}).Find(&leads)

	dormantHours := GetDormantHours()
	closeHours := GetCloseHours()
	needResponseID, waitingCustomerID, dormantID, closeID := statusIDsByName()

	var needResponse, waitingCustomer, dormant, selesaiHariIni int64
	var over30m, m15to30, m5to15, under5m int64
	now := time.Now()
	today := now.Format("2006-01-02")

	for i := range leads {
		recomputeLeadStatus(&leads[i], dormantHours, closeHours, needResponseID, waitingCustomerID, dormantID, closeID)
		if leads[i].StatusID == nil {
			continue
		}
		switch *leads[i].StatusID {
		case needResponseID:
			needResponse++
			if leads[i].LastChatAt != nil {
				elapsed := now.Sub(*leads[i].LastChatAt)
				switch {
				case elapsed > 30*time.Minute:
					over30m++
				case elapsed > 15*time.Minute:
					m15to30++
				case elapsed > 5*time.Minute:
					m5to15++
				default:
					under5m++
				}
			}
		case waitingCustomerID:
			waitingCustomer++
		case dormantID:
			dormant++
		case closeID:
			if leads[i].UpdatedAt.Format("2006-01-02") == today {
				selesaiHariIni++
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"total":            len(leads),
		"need_response":    needResponse,
		"waiting_customer": waitingCustomer,
		"dormant":          dormant,
		"selesai_hari_ini": selesaiHariIni,
		"sla_buckets": gin.H{
			"over_30m": over30m,
			"15_30m":   m15to30,
			"5_15m":    m5to15,
			"under_5m": under5m,
		},
	})
}

// fetchOwnedLead loads a lead by id and writes a 404/403 response (returning
// ok=false) if it doesn't exist or the requester isn't allowed to touch it.
func fetchOwnedLead(c *gin.Context, id string) (models.Lead, bool) {
	var lead models.Lead
	if err := database.DB.First(&lead, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Lead not found"})
		return lead, false
	}
	if !ownsSalesRecord(c, lead.SalesID) {
		forbidden(c)
		return lead, false
	}
	return lead, true
}

func ArchiveLead(c *gin.Context) {
	if _, ok := fetchOwnedLead(c, c.Param("id")); !ok {
		return
	}
	database.DB.Model(&models.Lead{}).Where("id = ?", c.Param("id")).Update("is_archived", true)
	c.JSON(http.StatusOK, gin.H{"message": "Lead archived"})
}

func UnarchiveLead(c *gin.Context) {
	if _, ok := fetchOwnedLead(c, c.Param("id")); !ok {
		return
	}
	database.DB.Model(&models.Lead{}).Where("id = ?", c.Param("id")).Update("is_archived", false)
	c.JSON(http.StatusOK, gin.H{"message": "Lead unarchived"})
}

func GetLeadActivities(c *gin.Context) {
	if _, ok := fetchOwnedLead(c, c.Param("id")); !ok {
		return
	}
	var activities []models.LeadActivity
	database.DB.Preload("Creator").Where("lead_id = ?", c.Param("id")).Order("created_at DESC").Find(&activities)
	c.JSON(http.StatusOK, activities)
}

type CreateLeadActivityRequest struct {
	Activity string `json:"activity" binding:"required"`
	Notes    string `json:"notes"`
}

// CreateLeadActivity is used both for manual activity logging and as the
// backing store for the Chat tab's "Catatan Internal" reply mode (team-only
// notes that are never sent to WhatsApp).
func CreateLeadActivity(c *gin.Context) {
	lead, ok := fetchOwnedLead(c, c.Param("id"))
	if !ok {
		return
	}

	var req CreateLeadActivityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.MustGet("user_id").(uuid.UUID)
	activity := models.LeadActivity{
		ID:        uuid.New(),
		LeadID:    lead.ID,
		Activity:  req.Activity,
		Notes:     req.Notes,
		CreatedBy: &userID,
	}
	database.DB.Create(&activity)
	database.DB.Preload("Creator").First(&activity, "id = ?", activity.ID)

	c.JSON(http.StatusCreated, activity)
}
