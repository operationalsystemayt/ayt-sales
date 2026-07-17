package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/ayt-sales/backend/internal/database"
	"github.com/ayt-sales/backend/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func GetBookings(c *gin.Context) {
	var bookings []models.Booking
	q := database.DB.
		Preload("Customer").
		Preload("Sales").
		Preload("Product.Countries").
		Preload("Countries").
		Preload("Lead").
		Order("created_at DESC")

	q = scopeSalesFilter(c, q)
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

// bookingSummaryFilters applies the same filter set GetBookings supports, so the
// summary cards always reflect exactly the rows currently visible in the table.
func bookingSummaryFilters(c *gin.Context) *gorm.DB {
	q := database.DB.Model(&models.Booking{})
	q = scopeSalesFilter(c, q)
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
	return q
}

func GetBookingSummary(c *gin.Context) {
	var totalBooking int64
	var totalPax struct{ Sum int64 }
	var totalRevenue struct{ Sum float64 }
	var pendingPayment struct{ Sum float64 }
	var completed int64
	var upcoming int64

	bookingSummaryFilters(c).Count(&totalBooking)
	bookingSummaryFilters(c).Select("COALESCE(SUM(pax), 0) as sum").Scan(&totalPax)
	bookingSummaryFilters(c).Select("COALESCE(SUM(total_paid), 0) as sum").Scan(&totalRevenue)
	bookingSummaryFilters(c).Where("remaining_payment > 0").Select("COALESCE(SUM(remaining_payment), 0) as sum").Scan(&pendingPayment)
	bookingSummaryFilters(c).Where("booking_status = ?", "Completed").Count(&completed)
	bookingSummaryFilters(c).
		Where("departure_date BETWEEN ? AND ?", time.Now(), time.Now().AddDate(0, 0, 30)).
		Count(&upcoming)

	c.JSON(http.StatusOK, gin.H{
		"total_booking":    totalBooking,
		"total_pax":        totalPax.Sum,
		"total_revenue":    totalRevenue.Sum,
		"pending_payment":  pendingPayment.Sum,
		"completed":        completed,
		"upcoming_30_days": upcoming,
	})
}

type CreateBookingRequest struct {
	CustomerName  string  `json:"customer_name" binding:"required"`
	Phone         string  `json:"phone" binding:"required"`
	SalesID       string  `json:"sales_id"`
	LeadID        string  `json:"lead_id"`
	ProductID     uint    `json:"product_id" binding:"required"`
	CountryIDs    []uint  `json:"country_ids"`
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
	if currentRole(c) == "sales" {
		uid := currentUserID(c)
		salesID = &uid
	} else if req.SalesID != "" {
		sid, _ := uuid.Parse(req.SalesID)
		salesID = &sid
	}
	var leadID *uuid.UUID
	if req.LeadID != "" {
		lid, _ := uuid.Parse(req.LeadID)
		leadID = &lid
	}

	countryIDs := req.CountryIDs
	if len(countryIDs) == 0 {
		var product models.Product
		if err := database.DB.Preload("Countries").First(&product, req.ProductID).Error; err == nil {
			for _, co := range product.Countries {
				countryIDs = append(countryIDs, co.ID)
			}
		}
	}

	booking := models.Booking{
		ID:               uuid.New(),
		BookingNo:        bookingNo,
		CustomerID:       customer.ID,
		SalesID:          salesID,
		LeadID:           leadID,
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

	if len(countryIDs) > 0 {
		var countries []models.Country
		database.DB.Where("id IN ?", countryIDs).Find(&countries)
		database.DB.Model(&booking).Association("Countries").Replace(countries)
	}

	database.DB.Preload("Customer").Preload("Sales").Preload("Product.Countries").Preload("Countries").Preload("Lead").First(&booking, "id = ?", booking.ID)
	c.JSON(http.StatusCreated, booking)
}

type UpdateBookingRequest struct {
	CustomerName  *string  `json:"customer_name"`
	Phone         *string  `json:"phone"`
	SalesID       *string  `json:"sales_id"`
	ProductID     *uint    `json:"product_id"`
	CountryIDs    *[]uint  `json:"country_ids"`
	BookingDate   *string  `json:"booking_date"`
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
	if !ownsSalesRecord(c, booking.SalesID) {
		forbidden(c)
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
	if req.BookingDate != nil {
		if t, err := time.Parse("2006-01-02", *req.BookingDate); err == nil {
			updates["booking_date"] = t
		}
	}
	if req.DepartureDate != nil {
		t, _ := time.Parse("2006-01-02", *req.DepartureDate)
		updates["departure_date"] = t
	}
	if req.SalesID != nil && currentRole(c) == "admin" {
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

	if req.CountryIDs != nil {
		var countries []models.Country
		if len(*req.CountryIDs) > 0 {
			database.DB.Where("id IN ?", *req.CountryIDs).Find(&countries)
		}
		database.DB.Model(&booking).Association("Countries").Replace(countries)
	}

	if req.CustomerName != nil || req.Phone != nil {
		custUpdates := map[string]interface{}{}
		if req.CustomerName != nil && *req.CustomerName != "" {
			custUpdates["full_name"] = *req.CustomerName
		}
		if req.Phone != nil && *req.Phone != "" {
			custUpdates["phone"] = *req.Phone
		}
		if len(custUpdates) > 0 {
			database.DB.Model(&models.Customer{}).Where("id = ?", booking.CustomerID).Updates(custUpdates)
		}
	}

	database.DB.Preload("Customer").Preload("Sales").Preload("Product.Countries").Preload("Countries").Preload("Lead").First(&booking, "id = ?", id)
	c.JSON(http.StatusOK, booking)
}

func DeleteBooking(c *gin.Context) {
	id := c.Param("id")
	if _, ok := fetchOwnedBooking(c, id); !ok {
		return
	}
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
	booking, ok := fetchOwnedBooking(c, bookingID)
	if !ok {
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
	if _, ok := fetchOwnedBooking(c, bookingID); !ok {
		return
	}
	var payments []models.BookingPayment
	database.DB.Where("booking_id = ?", bookingID).Order("payment_no").Find(&payments)
	c.JSON(http.StatusOK, payments)
}

func DeletePayment(c *gin.Context) {
	bookingID := c.Param("id")
	paymentID := c.Param("paymentId")

	booking, ok := fetchOwnedBooking(c, bookingID)
	if !ok {
		return
	}

	var payment models.BookingPayment
	if err := database.DB.Where("id = ? AND booking_id = ?", paymentID, bookingID).First(&payment).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
		return
	}
	database.DB.Delete(&payment)

	newPaid := booking.TotalPaid - payment.Amount
	database.DB.Model(&booking).Updates(map[string]interface{}{
		"total_paid":        newPaid,
		"remaining_payment": booking.TotalPrice - newPaid,
	})

	c.JSON(http.StatusOK, gin.H{"message": "Payment deleted"})
}
