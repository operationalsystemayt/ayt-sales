package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/ayt-sales/backend/internal/database"
	"github.com/ayt-sales/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func GetBookings(c *gin.Context) {
	var bookings []models.Booking
	q := database.DB.
		Preload("Customer").
		Preload("Sales").
		Preload("Product.Country").
		Order("created_at DESC")

	if salesID := c.Query("sales_id"); salesID != "" {
		q = q.Where("sales_id = ?", salesID)
	}
	if status := c.Query("status"); status != "" {
		q = q.Where("booking_status = ?", status)
	}
	if productID := c.Query("product_id"); productID != "" {
		q = q.Where("product_id = ?", productID)
	}
	if dateFrom := c.Query("date_from"); dateFrom != "" {
		q = q.Where("booking_date >= ?", dateFrom)
	}
	if dateTo := c.Query("date_to"); dateTo != "" {
		q = q.Where("booking_date <= ?", dateTo)
	}

	q.Find(&bookings)
	c.JSON(http.StatusOK, bookings)
}

func GetBookingSummary(c *gin.Context) {
	var totalBooking int64
	var totalPax struct{ Sum int64 }
	var totalRevenue struct{ Sum float64 }
	var pendingPayment struct{ Sum float64 }
	var completed int64
	var upcoming int64

	db := database.DB.Model(&models.Booking{})

	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")
	if dateFrom != "" {
		db = db.Where("booking_date >= ?", dateFrom)
	}
	if dateTo != "" {
		db = db.Where("booking_date <= ?", dateTo)
	}

	db.Count(&totalBooking)
	database.DB.Model(&models.Booking{}).Select("COALESCE(SUM(pax), 0) as sum").Scan(&totalPax)
	database.DB.Model(&models.Booking{}).Select("COALESCE(SUM(total_paid), 0) as sum").Scan(&totalRevenue)
	database.DB.Model(&models.Booking{}).Where("remaining_payment > 0").Select("COALESCE(SUM(remaining_payment), 0) as sum").Scan(&pendingPayment)
	database.DB.Model(&models.Booking{}).Where("booking_status = ?", "Completed").Count(&completed)
	database.DB.Model(&models.Booking{}).
		Where("departure_date BETWEEN ? AND ?", time.Now(), time.Now().AddDate(0, 0, 30)).
		Count(&upcoming)

	c.JSON(http.StatusOK, gin.H{
		"total_booking":     totalBooking,
		"total_pax":         totalPax.Sum,
		"total_revenue":     totalRevenue.Sum,
		"pending_payment":   pendingPayment.Sum,
		"completed":         completed,
		"upcoming_30_days":  upcoming,
	})
}

type CreateBookingRequest struct {
	CustomerName  string  `json:"customer_name" binding:"required"`
	Phone         string  `json:"phone" binding:"required"`
	SalesID       string  `json:"sales_id"`
	ProductID     uint    `json:"product_id" binding:"required"`
	DepartureDate string  `json:"departure_date" binding:"required"`
	Pax           int     `json:"pax" binding:"required,min=1"`
	PricePerPax   float64 `json:"price_per_pax" binding:"required"`
	BookingStatus string  `json:"booking_status"`
	Notes         string  `json:"notes"`
}

func CreateBooking(c *gin.Context) {
	var req CreateBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var customer models.Customer
	if err := database.DB.Where("phone = ?", req.Phone).First(&customer).Error; err != nil {
		customer = models.Customer{ID: uuid.New(), FullName: req.CustomerName, Phone: req.Phone}
		database.DB.Create(&customer)
	}

	departureDate, _ := time.Parse("2006-01-02", req.DepartureDate)
	totalPrice := req.PricePerPax * float64(req.Pax)

	bookingStatus := req.BookingStatus
	if bookingStatus == "" {
		bookingStatus = "Waiting Payment 1"
	}

	now := time.Now()
	var count int64
	database.DB.Model(&models.Booking{}).Where("EXTRACT(YEAR FROM created_at) = ? AND EXTRACT(MONTH FROM created_at) = ?", now.Year(), now.Month()).Count(&count)
	bookingNo := fmt.Sprintf("BK-%02d%02d-%04d", now.Year()%100, now.Month(), count+1)

	var salesID *uuid.UUID
	if req.SalesID != "" {
		sid, _ := uuid.Parse(req.SalesID)
		salesID = &sid
	}

	booking := models.Booking{
		ID:               uuid.New(),
		BookingNo:        bookingNo,
		CustomerID:       customer.ID,
		SalesID:          salesID,
		ProductID:        &req.ProductID,
		BookingDate:      now,
		DepartureDate:    &departureDate,
		Pax:              req.Pax,
		PricePerPax:      req.PricePerPax,
		TotalPrice:       totalPrice,
		RemainingPayment: totalPrice,
		BookingStatus:    bookingStatus,
		Notes:            req.Notes,
	}

	if err := database.DB.Create(&booking).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	database.DB.Preload("Customer").Preload("Sales").Preload("Product.Country").First(&booking, "id = ?", booking.ID)
	c.JSON(http.StatusCreated, booking)
}

type UpdateBookingRequest struct {
	SalesID       *string  `json:"sales_id"`
	ProductID     *uint    `json:"product_id"`
	DepartureDate *string  `json:"departure_date"`
	Pax           *int     `json:"pax"`
	PricePerPax   *float64 `json:"price_per_pax"`
	BookingStatus *string  `json:"booking_status"`
	Notes         *string  `json:"notes"`
}

func UpdateBooking(c *gin.Context) {
	id := c.Param("id")
	var booking models.Booking
	if err := database.DB.First(&booking, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Booking not found"})
		return
	}

	var req UpdateBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.BookingStatus != nil {
		updates["booking_status"] = req.BookingStatus
	}
	if req.ProductID != nil {
		updates["product_id"] = req.ProductID
	}
	if req.Pax != nil {
		updates["pax"] = req.Pax
	}
	if req.PricePerPax != nil {
		updates["price_per_pax"] = req.PricePerPax
	}
	if req.Notes != nil {
		updates["notes"] = req.Notes
	}
	if req.DepartureDate != nil {
		t, _ := time.Parse("2006-01-02", *req.DepartureDate)
		updates["departure_date"] = t
	}
	if req.SalesID != nil {
		if *req.SalesID == "" {
			updates["sales_id"] = nil
		} else {
			sid, _ := uuid.Parse(*req.SalesID)
			updates["sales_id"] = sid
		}
	}

	pax := booking.Pax
	pricePerPax := booking.PricePerPax
	if req.Pax != nil {
		pax = *req.Pax
	}
	if req.PricePerPax != nil {
		pricePerPax = *req.PricePerPax
	}
	newTotal := pricePerPax * float64(pax)
	updates["total_price"] = newTotal
	updates["remaining_payment"] = newTotal - booking.TotalPaid

	database.DB.Model(&booking).Updates(updates)
	database.DB.Preload("Customer").Preload("Sales").Preload("Product.Country").First(&booking, "id = ?", id)
	c.JSON(http.StatusOK, booking)
}

func DeleteBooking(c *gin.Context) {
	id := c.Param("id")
	database.DB.Delete(&models.Booking{}, "id = ?", id)
	c.JSON(http.StatusOK, gin.H{"message": "Booking deleted"})
}

type AddPaymentRequest struct {
	Amount        float64 `json:"amount" binding:"required"`
	PaymentDate   string  `json:"payment_date"`
	PaymentMethod string  `json:"payment_method"`
	ReferenceNo   string  `json:"reference_no"`
	Notes         string  `json:"notes"`
}

func AddPayment(c *gin.Context) {
	bookingID := c.Param("id")
	var booking models.Booking
	if err := database.DB.First(&booking, "id = ?", bookingID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Booking not found"})
		return
	}

	var req AddPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var count int64
	database.DB.Model(&models.BookingPayment{}).Where("booking_id = ?", bookingID).Count(&count)

	var paymentDate *time.Time
	if req.PaymentDate != "" {
		t, _ := time.Parse("2006-01-02", req.PaymentDate)
		paymentDate = &t
	}

	bID, _ := uuid.Parse(bookingID)
	payment := models.BookingPayment{
		BookingID:     bID,
		PaymentNo:     int(count + 1),
		PaymentDate:   paymentDate,
		Amount:        req.Amount,
		PaymentMethod: req.PaymentMethod,
		ReferenceNo:   req.ReferenceNo,
		Notes:         req.Notes,
	}
	database.DB.Create(&payment)

	newPaid := booking.TotalPaid + req.Amount
	newRemaining := booking.TotalPrice - newPaid
	database.DB.Model(&booking).Updates(map[string]interface{}{
		"total_paid":        newPaid,
		"remaining_payment": newRemaining,
	})

	c.JSON(http.StatusCreated, payment)
}

func GetPayments(c *gin.Context) {
	bookingID := c.Param("id")
	var payments []models.BookingPayment
	database.DB.Where("booking_id = ?", bookingID).Order("payment_no").Find(&payments)
	c.JSON(http.StatusOK, payments)
}
