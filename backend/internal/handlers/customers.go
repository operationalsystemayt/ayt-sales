package handlers

import (
	"net/http"
	"time"

	"github.com/ayt-sales/backend/internal/database"
	"github.com/ayt-sales/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func GetCustomers(c *gin.Context) {
	var customers []models.Customer
	q := database.DB.Order("updated_at DESC")

	if saved := c.Query("saved"); saved != "" {
		q = q.Where("is_saved = ?", saved == "true")
	}
	if search := c.Query("search"); search != "" {
		like := "%" + search + "%"
		q = q.Where("full_name ILIKE ? OR phone ILIKE ?", like, like)
	}

	q.Find(&customers)
	c.JSON(http.StatusOK, customers)
}

type UpdateCustomerRequest struct {
	FullName   *string `json:"full_name"`
	Notes      *string `json:"notes"`
	IsFavorite *bool   `json:"is_favorite"`
}

func UpdateCustomer(c *gin.Context) {
	id := c.Param("id")
	var customer models.Customer
	if err := database.DB.First(&customer, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}

	var req UpdateCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.FullName != nil {
		updates["full_name"] = *req.FullName
	}
	if req.Notes != nil {
		updates["notes"] = *req.Notes
	}
	if req.IsFavorite != nil {
		updates["is_favorite"] = *req.IsFavorite
	}

	database.DB.Model(&customer).Updates(updates)
	database.DB.First(&customer, "id = ?", id)
	c.JSON(http.StatusOK, customer)
}

func SaveCustomer(c *gin.Context) {
	id := c.Param("id")
	var customer models.Customer
	if err := database.DB.First(&customer, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer not found"})
		return
	}
	database.DB.Model(&customer).Update("is_saved", true)
	c.JSON(http.StatusOK, gin.H{"message": "Customer saved"})
}

// GetContactSummary powers the Contact page's summary cards. "Dormant" and "Active" are
// scoped to customers who have booked before (a churned customer vs. a recently-active
// one); "Plain" is a customer with a lead but no booking history at all — those two
// buckets are mutually exclusive by construction.
func GetContactSummary(c *gin.Context) {
	dormantDays := getIntSetting("contact_dormant_days", 365)
	activeDays := getIntSetting("contact_active_days", 60)

	var totalContact int64
	database.DB.Model(&models.Customer{}).Count(&totalContact)

	var totalActive int64
	database.DB.Model(&models.Customer{}).
		Where("EXISTS (SELECT 1 FROM bookings b WHERE b.customer_id = customers.id AND b.deleted_at IS NULL AND b.booking_date >= ?)",
			time.Now().AddDate(0, 0, -activeDays)).
		Count(&totalActive)

	var totalDormant int64
	database.DB.Model(&models.Customer{}).
		Where(`EXISTS (SELECT 1 FROM bookings b WHERE b.customer_id = customers.id AND b.deleted_at IS NULL)
		       AND NOT EXISTS (SELECT 1 FROM bookings b2 WHERE b2.customer_id = customers.id AND b2.deleted_at IS NULL AND b2.booking_date >= ?)`,
			time.Now().AddDate(0, 0, -dormantDays)).
		Count(&totalDormant)

	var totalPlain int64
	database.DB.Model(&models.Customer{}).
		Where(`EXISTS (SELECT 1 FROM leads l WHERE l.customer_id = customers.id AND l.deleted_at IS NULL)
		       AND NOT EXISTS (SELECT 1 FROM bookings b3 WHERE b3.customer_id = customers.id AND b3.deleted_at IS NULL)`).
		Count(&totalPlain)

	c.JSON(http.StatusOK, gin.H{
		"total_contact": totalContact,
		"total_dormant": totalDormant,
		"total_active":  totalActive,
		"total_plain":   totalPlain,
		"dormant_days":  dormantDays,
		"active_days":   activeDays,
	})
}

// GetCustomerSummary powers the Chat inbox's right-hand relationship panel.
func GetCustomerSummary(c *gin.Context) {
	id := c.Param("id")

	var recentLead models.Lead
	database.DB.Preload("Result").Preload("Product").Where("customer_id = ?", id).
		Order("created_at DESC").First(&recentLead)

	var activeBooking models.Booking
	database.DB.Preload("Product").Where("customer_id = ? AND booking_status NOT IN ?", id, []string{"Completed", "Cancelled"}).
		Order("created_at DESC").First(&activeBooking)

	var totalBookings int64
	database.DB.Model(&models.Booking{}).Where("customer_id = ?", id).Count(&totalBookings)

	var totalSpent struct{ Sum float64 }
	database.DB.Model(&models.Booking{}).Where("customer_id = ?", id).
		Select("COALESCE(SUM(total_price), 0) as sum").Scan(&totalSpent)

	var latestActivity models.LeadActivity
	database.DB.Joins("JOIN leads ON leads.id = lead_activities.lead_id").
		Where("leads.customer_id = ?", id).
		Order("lead_activities.created_at DESC").First(&latestActivity)

	resp := gin.H{
		"total_bookings": totalBookings,
		"total_spent":    totalSpent.Sum,
	}
	if recentLead.ID != uuid.Nil {
		resp["recent_lead"] = recentLead
	}
	if activeBooking.ID != uuid.Nil {
		resp["active_booking"] = activeBooking
	}
	if latestActivity.ID != uuid.Nil {
		resp["latest_note"] = latestActivity
	}

	c.JSON(http.StatusOK, resp)
}
