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

// leadListFilters applies the filter set shared by GetLeads and GetLeadsSummary, so the
// summary cards always reflect exactly the rows currently visible in the table.
func leadListFilters(c *gin.Context, q *gorm.DB) *gorm.DB {
	q = scopeSalesFilter(c, q)
	if statusID := c.Query("status_id"); statusID != "" {
		q = q.Where("status_id = ?", statusID)
	}
	if qualityID := c.Query("quality_id"); qualityID != "" {
		q = q.Where("quality_id = ?", qualityID)
	}
	if resultID := c.Query("result_id"); resultID != "" {
		q = q.Where("result_id = ?", resultID)
	}
	if productID := c.Query("product_id"); productID != "" {
		q = q.Where("product_id = ?", productID)
	}
	if dateFrom := c.Query("date_from"); dateFrom != "" {
		q = q.Where("date_received >= ?", dateFrom)
	}
	if dateTo := c.Query("date_to"); dateTo != "" {
		q = q.Where("date_received <= ?", dateTo)
	}
	if search := c.Query("search"); search != "" {
		like := "%" + search + "%"
		q = q.Where("customer_id IN (?)",
			database.DB.Model(&models.Customer{}).Select("id").Where("full_name ILIKE ? OR phone ILIKE ?", like, like))
	}
	return q
}

func GetLeads(c *gin.Context) {
	var leads []models.Lead
	q := leadListFilters(c, database.DB.
		Preload("Customer").
		Preload("Sales").
		Preload("Source").
		Preload("Input").
		Preload("Quality").
		Preload("Status").
		Preload("Result").
		Preload("Product.Countries").
		Preload("Group").
		Where("is_converted = false")).
		Order("updated_at DESC")

	q.Find(&leads)

	dormantHours := GetDormantHours()
	closeHours := GetCloseHours()
	needResponseID, waitingCustomerID, dormantID, closeID := statusIDsByName()
	for i := range leads {
		recomputeLeadStatus(&leads[i], dormantHours, closeHours, needResponseID, waitingCustomerID, dormantID, closeID)
	}

	c.JSON(http.StatusOK, leads)
}

// GetLeadsSummary powers the Leads & Prospects summary cards. total_leads counts every
// lead matching the current filters (including already-converted ones, since Convert/Cancel
// are outcomes of the funnel); the pipeline-state buckets (Need Response/Waiting/Dormant)
// are further scoped to is_converted = false since a converted lead has left the pipeline.
func GetLeadsSummary(c *gin.Context) {
	var totalLeads int64
	leadListFilters(c, database.DB.Model(&models.Lead{})).Count(&totalLeads)

	countByResult := func(name string) int64 {
		var n int64
		leadListFilters(c, database.DB.Model(&models.Lead{})).
			Joins("JOIN master_results ON master_results.id = leads.result_id").
			Where("master_results.name = ?", name).Count(&n)
		return n
	}
	countByStatus := func(name string) int64 {
		var n int64
		leadListFilters(c, database.DB.Model(&models.Lead{})).
			Where("is_converted = false").
			Joins("JOIN master_statuses ON master_statuses.id = leads.status_id").
			Where("master_statuses.name = ?", name).Count(&n)
		return n
	}

	convert := countByResult("Converted")
	cancel := countByResult("Cancel")
	needResponse := countByStatus("Need Response")
	waitingCustomer := countByStatus("Waiting Customer")
	dormant := countByStatus("Dormant")

	pct := func(n int64) float64 {
		if totalLeads == 0 {
			return 0
		}
		return float64(n) / float64(totalLeads) * 100
	}

	c.JSON(http.StatusOK, gin.H{
		"total_leads":      totalLeads,
		"convert":          gin.H{"count": convert, "pct": pct(convert)},
		"cancel":           gin.H{"count": cancel, "pct": pct(cancel)},
		"need_response":    gin.H{"count": needResponse, "pct": pct(needResponse)},
		"waiting_customer": gin.H{"count": waitingCustomer, "pct": pct(waitingCustomer)},
		"dormant":          gin.H{"count": dormant, "pct": pct(dormant)},
	})
}

// statusIDsByName resolves the MasterStatus IDs used by the on-the-fly status recompute below.
func statusIDsByName() (needResponseID, waitingCustomerID, dormantID, closeID uint) {
	var nr, wc, do, cl models.MasterStatus
	database.DB.Where("name = ?", "Need Response").First(&nr)
	database.DB.Where("name = ?", "Waiting Customer").First(&wc)
	database.DB.Where("name = ?", "Dormant").First(&do)
	database.DB.Where("name = ?", "Close").First(&cl)
	return nr.ID, wc.ID, do.ID, cl.ID
}

// recomputeLeadStatus inspects the lead's most recent Chat row and updates status_id
// in-memory (for this response) and persists it if it changed, so status filters and
// bulk-edit keep working off the stored column.
//
// Rules: an inbound (customer) message always means Need Response, immediately. An
// outbound (sales) message means Waiting Customer immediately, decaying to Dormant
// after dormantHours of silence and to Close after closeHours.
func recomputeLeadStatus(lead *models.Lead, dormantHours, closeHours int, needResponseID, waitingCustomerID, dormantID, closeID uint) {
	var lastChat models.Chat
	if err := database.DB.Where("lead_id = ?", lead.ID).
		Order("chat_timestamp DESC").First(&lastChat).Error; err != nil {
		return // no chat history yet — leave status untouched
	}

	var newStatusID uint
	switch lastChat.Direction {
	case "in":
		newStatusID = needResponseID
	case "out":
		elapsed := time.Since(lastChat.ChatTimestamp)
		switch {
		case elapsed >= time.Duration(closeHours)*time.Hour:
			newStatusID = closeID
		case elapsed >= time.Duration(dormantHours)*time.Hour:
			newStatusID = dormantID
		default:
			newStatusID = waitingCustomerID
		}
	default:
		return
	}

	if newStatusID == 0 {
		return
	}

	if lead.StatusID == nil || *lead.StatusID != newStatusID {
		database.DB.Model(&models.Lead{}).Where("id = ?", lead.ID).Update("status_id", newStatusID)
		lead.StatusID = &newStatusID
		var st models.MasterStatus
		database.DB.First(&st, newStatusID)
		lead.Status = &st
	}
}

type CreateLeadRequest struct {
	SalesID      string   `json:"sales_id"`
	CustomerName string   `json:"customer_name" binding:"required"`
	Phone        string   `json:"phone" binding:"required"`
	DateReceived string   `json:"date_received"`
	SourceID     *uint    `json:"source_id"`
	InputID      *uint    `json:"input_id"`
	QualityID    *uint    `json:"quality_id"`
	StatusID     *uint    `json:"status_id"`
	ResultID     *uint    `json:"result_id"`
	ProductID    *uint    `json:"product_id"`
	GroupID      *uint    `json:"group_id"`
	Price        *float64 `json:"price"`
	Pax          *int     `json:"pax"`
}

func CreateLead(c *gin.Context) {
	var req CreateLeadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Cari atau buat customer
	var customer models.Customer
	if err := database.DB.Where("phone = ?", req.Phone).First(&customer).Error; err != nil {
		customer = models.Customer{
			ID:       uuid.New(),
			FullName: req.CustomerName,
			Phone:    req.Phone,
		}
		database.DB.Create(&customer)
	} else {
		customer.FullName = req.CustomerName
		database.DB.Save(&customer)
	}

	leadNo := nextLeadNo()

	var dateReceived *time.Time
	if req.DateReceived != "" {
		t, err := time.Parse("2006-01-02", req.DateReceived)
		if err == nil {
			dateReceived = &t
		}
	} else {
		now := time.Now()
		dateReceived = &now
	}

	var salesID *uuid.UUID
	if currentRole(c) == "sales" {
		uid := currentUserID(c)
		salesID = &uid
	} else if req.SalesID != "" {
		sid, err := uuid.Parse(req.SalesID)
		if err == nil {
			salesID = &sid
		}
	}

	var totalPrice *float64
	if req.Price != nil && req.Pax != nil {
		t := *req.Price * float64(*req.Pax)
		totalPrice = &t
	}

	// Leads created through this endpoint are always manual entry (not connected to
	// WhatsApp), so status is forced to "Manual" rather than left to the client —
	// the automatic Need Response/Waiting Customer/Dormant states only make sense
	// for leads with a chat thread.
	var manualStatus models.MasterStatus
	database.DB.Where("name = ?", "Manual").First(&manualStatus)
	statusID := req.StatusID
	if manualStatus.ID != 0 {
		statusID = &manualStatus.ID
	}

	lead := models.Lead{
		ID:           uuid.New(),
		CustomerID:   customer.ID,
		SalesID:      salesID,
		LeadNo:       leadNo,
		SourceID:     req.SourceID,
		InputID:      req.InputID,
		QualityID:    req.QualityID,
		StatusID:     statusID,
		ResultID:     req.ResultID,
		ProductID:    req.ProductID,
		GroupID:      req.GroupID,
		Price:        req.Price,
		Pax:          req.Pax,
		TotalPrice:   totalPrice,
		DateReceived: dateReceived,
	}

	if err := database.DB.Create(&lead).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Log activity
	creatorID := c.MustGet("user_id").(uuid.UUID)
	database.DB.Create(&models.LeadActivity{
		ID:        uuid.New(),
		LeadID:    lead.ID,
		Activity:  "Lead dibuat",
		Notes:     "Lead baru ditambahkan secara manual",
		CreatedBy: &creatorID,
	})

	database.DB.Preload("Customer").Preload("Sales").Preload("Source").Preload("Input").
		Preload("Quality").Preload("Status").Preload("Result").Preload("Product.Countries").
		Preload("Group").First(&lead, "id = ?", lead.ID)

	c.JSON(http.StatusCreated, lead)
}

type UpdateLeadRequest struct {
	SalesID   *string  `json:"sales_id"`
	SourceID  *uint    `json:"source_id"`
	InputID   *uint    `json:"input_id"`
	QualityID *uint    `json:"quality_id"`
	StatusID  *uint    `json:"status_id"`
	ResultID  *uint    `json:"result_id"`
	ProductID *uint    `json:"product_id"`
	GroupID   *uint    `json:"group_id"`
	Price     *float64 `json:"price"`
	Pax       *int     `json:"pax"`
	DealDate  *string  `json:"deal_date"`
	Notes     *string  `json:"notes"`
}

func UpdateLead(c *gin.Context) {
	id := c.Param("id")
	var lead models.Lead
	if err := database.DB.First(&lead, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Lead not found"})
		return
	}
	if !ownsSalesRecord(c, lead.SalesID) {
		forbidden(c)
		return
	}

	var req UpdateLeadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.QualityID != nil {
		var q models.MasterQuality
		if err := database.DB.First(&q, *req.QualityID).Error; err == nil && q.Name == "Hot" {
			effProduct := req.ProductID
			if effProduct == nil {
				effProduct = lead.ProductID
			}
			effGroup := req.GroupID
			if effGroup == nil {
				effGroup = lead.GroupID
			}
			effPrice := req.Price
			if effPrice == nil {
				effPrice = lead.Price
			}
			effPax := req.Pax
			if effPax == nil {
				effPax = lead.Pax
			}

			var missing []string
			if effProduct == nil {
				missing = append(missing, "product_id")
			}
			if effGroup == nil {
				missing = append(missing, "group_id")
			}
			if effPrice == nil {
				missing = append(missing, "price")
			}
			if effPax == nil {
				missing = append(missing, "pax")
			}
			if len(missing) > 0 {
				c.JSON(http.StatusBadRequest, gin.H{
					"error":          "Kualitas Hot membutuhkan Produk, Grup, Harga, dan Pax terisi",
					"missing_fields": missing,
				})
				return
			}
		}
	}

	updates := map[string]interface{}{}

	// Reassigning a lead to a different sales rep is admin-only — a sales user
	// can edit their own lead's other fields but not hand it off to someone else.
	if req.SalesID != nil && currentRole(c) == "admin" {
		if *req.SalesID == "" {
			updates["sales_id"] = nil
		} else {
			sid, _ := uuid.Parse(*req.SalesID)
			updates["sales_id"] = sid
		}
	}
	if req.SourceID != nil {
		updates["source_id"] = req.SourceID
	}
	if req.InputID != nil {
		updates["input_id"] = req.InputID
	}
	if req.QualityID != nil {
		updates["quality_id"] = req.QualityID
	}
	if req.StatusID != nil {
		updates["status_id"] = req.StatusID
	}
	if req.ResultID != nil {
		updates["result_id"] = req.ResultID
	}
	if req.ProductID != nil {
		updates["product_id"] = req.ProductID
	}
	if req.GroupID != nil {
		updates["group_id"] = req.GroupID
	}
	if req.Price != nil {
		updates["price"] = req.Price
	}
	if req.Pax != nil {
		updates["pax"] = req.Pax
	}
	if req.DealDate != nil && *req.DealDate != "" {
		t, err := time.Parse("2006-01-02", *req.DealDate)
		if err == nil {
			updates["deal_date"] = t
		}
	}
	if req.Notes != nil {
		updates["notes"] = *req.Notes
	}

	// Recalculate total
	price := lead.Price
	pax := lead.Pax
	if req.Price != nil {
		price = req.Price
	}
	if req.Pax != nil {
		pax = req.Pax
	}
	if price != nil && pax != nil {
		updates["total_price"] = *price * float64(*pax)
	}

	database.DB.Model(&lead).Updates(updates)
	database.DB.Preload("Customer").Preload("Sales").Preload("Source").Preload("Input").
		Preload("Quality").Preload("Status").Preload("Result").Preload("Product.Countries").
		Preload("Group").First(&lead, "id = ?", id)

	c.JSON(http.StatusOK, lead)
}

type BulkUpdateRequest struct {
	IDs   []string    `json:"ids" binding:"required"`
	Field string      `json:"field" binding:"required"`
	Value interface{} `json:"value"`
}

func BulkUpdateLeads(c *gin.Context) {
	var req BulkUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	allowedFields := map[string]bool{
		"source_id": true, "quality_id": true, "result_id": true,
		"product_id": true, "group_id": true, "status_id": true,
		"deal_date": true,
	}
	if !allowedFields[req.Field] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Field tidak diizinkan untuk bulk update"})
		return
	}

	q := database.DB.Model(&models.Lead{}).Where("id IN ?", req.IDs)
	if currentRole(c) == "sales" {
		q = q.Where("sales_id = ?", currentUserID(c))
	}

	if req.Field == "deal_date" {
		dateStr, ok := req.Value.(string)
		if !ok || dateStr == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "deal_date value harus berupa tanggal (YYYY-MM-DD)"})
			return
		}
		t, err := time.Parse("2006-01-02", dateStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal tidak valid"})
			return
		}
		q.Update("deal_date", t)
	} else {
		q.Update(req.Field, req.Value)
	}

	c.JSON(http.StatusOK, gin.H{"updated": len(req.IDs)})
}

func DeleteLead(c *gin.Context) {
	id := c.Param("id")
	var lead models.Lead
	if err := database.DB.First(&lead, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Lead not found"})
		return
	}
	if !ownsSalesRecord(c, lead.SalesID) {
		forbidden(c)
		return
	}
	database.DB.Delete(&models.Lead{}, "id = ?", id)
	c.JSON(http.StatusOK, gin.H{"message": "Lead deleted"})
}

type ConvertLeadRequest struct {
	ProductID     *uint    `json:"product_id"`
	GroupID       *uint    `json:"group_id"`
	DepartureDate string   `json:"departure_date" binding:"required"`
	PricePerPax   *float64 `json:"price_per_pax"`
	Pax           *int     `json:"pax"`
	BookingStatus string   `json:"booking_status"`
	DealDate      *string  `json:"deal_date"`
}

func ConvertLeadToBooking(c *gin.Context) {
	leadID := c.Param("id")
	var lead models.Lead
	if err := database.DB.Preload("Customer").First(&lead, "id = ?", leadID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Lead not found"})
		return
	}
	if !ownsSalesRecord(c, lead.SalesID) {
		forbidden(c)
		return
	}
	if lead.IsConverted {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Lead sudah dikonversi"})
		return
	}

	var req ConvertLeadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	productID := req.ProductID
	if productID == nil {
		productID = lead.ProductID
	}
	groupID := req.GroupID
	if groupID == nil {
		groupID = lead.GroupID
	}
	pricePerPax := req.PricePerPax
	if pricePerPax == nil {
		pricePerPax = lead.Price
	}
	pax := req.Pax
	if pax == nil {
		pax = lead.Pax
	}

	var missing []string
	if productID == nil {
		missing = append(missing, "product_id")
	}
	if pricePerPax == nil {
		missing = append(missing, "price_per_pax")
	}
	if pax == nil {
		missing = append(missing, "pax")
	}
	if len(missing) > 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":          "Produk, Harga per Pax, dan Jumlah Pax wajib diisi",
			"missing_fields": missing,
		})
		return
	}

	departureDate, err := time.Parse("2006-01-02", req.DepartureDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Format tanggal keberangkatan tidak valid"})
		return
	}
	totalPrice := *pricePerPax * float64(*pax)

	bookingStatus := req.BookingStatus
	if bookingStatus == "" {
		bookingStatus = "Waiting Payment 1"
	}

	// Generate booking number
	now := time.Now()
	var count int64
	database.DB.Model(&models.Booking{}).Where("EXTRACT(YEAR FROM created_at) = ? AND EXTRACT(MONTH FROM created_at) = ?", now.Year(), now.Month()).Count(&count)
	bookingNo := fmt.Sprintf("BK-%02d%02d-%04d", now.Year()%100, now.Month(), count+1)

	booking := models.Booking{
		ID:               uuid.New(),
		BookingNo:        bookingNo,
		CustomerID:       lead.CustomerID,
		LeadID:           &lead.ID,
		SalesID:          lead.SalesID,
		ProductID:        productID,
		GroupID:          groupID,
		SourceID:         lead.SourceID,
		BookingDate:      now,
		DepartureDate:    &departureDate,
		Pax:              *pax,
		PricePerPax:      *pricePerPax,
		TotalPrice:       totalPrice,
		RemainingPayment: totalPrice,
		BookingStatus:    bookingStatus,
	}

	if err := database.DB.Create(&booking).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Mark lead as converted
	var convertedResult models.MasterResult
	database.DB.Where("name = ?", "Converted").First(&convertedResult)

	leadUpdates := map[string]interface{}{
		"is_converted": true,
		"converted_at": now,
	}
	if convertedResult.ID != 0 {
		leadUpdates["result_id"] = convertedResult.ID
	}
	if req.DealDate != nil && *req.DealDate != "" {
		if dd, err := time.Parse("2006-01-02", *req.DealDate); err == nil {
			leadUpdates["deal_date"] = dd
		}
	}
	database.DB.Model(&lead).Updates(leadUpdates)

	creatorID := c.MustGet("user_id").(uuid.UUID)
	database.DB.Create(&models.LeadActivity{
		ID:        uuid.New(),
		LeadID:    lead.ID,
		Activity:  "Lead dikonversi",
		Notes:     fmt.Sprintf("Lead dikonversi ke Booking %s", bookingNo),
		CreatedBy: &creatorID,
	})

	c.JSON(http.StatusCreated, gin.H{
		"booking_no": bookingNo,
		"booking":    booking,
	})
}
