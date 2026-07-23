package handlers

import (
	"net/http"
	"strconv"

	"github.com/ayt-sales/backend/internal/database"
	"github.com/ayt-sales/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// pagination parses page/page_size query params (1-indexed page, default
// page_size 20 to match the frontend's default, capped at 200 to bound
// response size regardless of what a caller passes) for list endpoints that
// support server-side paging.
func pagination(c *gin.Context) (page, pageSize int) {
	page = 1
	if p, err := strconv.Atoi(c.Query("page")); err == nil && p > 0 {
		page = p
	}
	pageSize = 20
	if ps, err := strconv.Atoi(c.Query("page_size")); err == nil && ps > 0 && ps <= 200 {
		pageSize = ps
	}
	return page, pageSize
}

func currentUserID(c *gin.Context) uuid.UUID {
	return c.MustGet("user_id").(uuid.UUID)
}

func currentRole(c *gin.Context) string {
	r, _ := c.Get("role")
	s, _ := r.(string)
	return s
}

// isAdminOrViewer reports whether the requester can see every record
// regardless of sales_id — "sales" is the only role scoped to its own data.
func isAdminOrViewer(c *gin.Context) bool {
	role := currentRole(c)
	return role == "admin" || role == "viewer"
}

// scopeSalesFilter restricts q to the requester's own sales_id when they're a
// "sales" user — overriding any client-supplied ?sales_id= so a sales rep can't
// page through another rep's data by editing the query param. Admin/viewer keep
// the existing behavior of honoring the query param filter (or seeing all rows
// when it's absent).
func scopeSalesFilter(c *gin.Context, q *gorm.DB) *gorm.DB {
	if currentRole(c) == "sales" {
		return q.Where("sales_id = ?", currentUserID(c))
	}
	if salesID := c.Query("sales_id"); salesID != "" {
		q = q.Where("sales_id = ?", salesID)
	}
	return q
}

// scopeCustomerFilter restricts a Customer query to customers with at least
// one lead or booking owned by the requester, when they're a "sales" user.
func scopeCustomerFilter(c *gin.Context, q *gorm.DB) *gorm.DB {
	if currentRole(c) == "sales" {
		uid := currentUserID(c)
		q = q.Where("id IN (SELECT customer_id FROM leads WHERE sales_id = ? UNION SELECT customer_id FROM bookings WHERE sales_id = ?)", uid, uid)
	}
	return q
}

// ownsSalesRecord reports whether the requester may access a record owned by
// ownerID — true for admin/viewer always, true for a sales user only when the
// record is their own (an unassigned record, ownerID == nil, belongs to no one
// yet so only admin/viewer can reach it).
func ownsSalesRecord(c *gin.Context, ownerID *uuid.UUID) bool {
	if isAdminOrViewer(c) {
		return true
	}
	return ownerID != nil && *ownerID == currentUserID(c)
}

func forbidden(c *gin.Context) {
	c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Anda tidak memiliki akses ke data ini"})
}

// ownsCustomer reports whether the requester may access a customer record —
// true for admin/viewer always, true for a sales user only when the customer
// has at least one lead or booking assigned to them.
func ownsCustomer(c *gin.Context, customerID string) bool {
	if isAdminOrViewer(c) {
		return true
	}
	var count int64
	database.DB.Raw(`SELECT count(*) FROM (
		SELECT customer_id FROM leads WHERE customer_id = ? AND sales_id = ?
		UNION
		SELECT customer_id FROM bookings WHERE customer_id = ? AND sales_id = ?
	) x`, customerID, currentUserID(c), customerID, currentUserID(c)).Scan(&count)
	return count > 0
}

// fetchOwnedBooking loads a booking by id and writes a 404/403 response
// (returning ok=false) if it doesn't exist or the requester isn't allowed to
// touch it.
func fetchOwnedBooking(c *gin.Context, id string) (models.Booking, bool) {
	var booking models.Booking
	if err := database.DB.First(&booking, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Booking not found"})
		return booking, false
	}
	if !ownsSalesRecord(c, booking.SalesID) {
		forbidden(c)
		return booking, false
	}
	return booking, true
}
