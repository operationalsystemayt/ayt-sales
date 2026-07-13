package handlers

import (
	"net/http"

	"github.com/ayt-sales/backend/internal/database"
	"github.com/ayt-sales/backend/internal/models"
	"github.com/gin-gonic/gin"
)

func GetMasterSources(c *gin.Context) {
	var data []models.MasterSource
	database.DB.Order("name").Find(&data)
	c.JSON(http.StatusOK, data)
}

func GetMasterInputs(c *gin.Context) {
	var data []models.MasterInput
	database.DB.Order("name").Find(&data)
	c.JSON(http.StatusOK, data)
}

func GetMasterQualities(c *gin.Context) {
	var data []models.MasterQuality
	database.DB.Order("id").Find(&data)
	c.JSON(http.StatusOK, data)
}

func GetMasterStatuses(c *gin.Context) {
	var data []models.MasterStatus
	database.DB.Order("id").Find(&data)
	c.JSON(http.StatusOK, data)
}

func GetMasterResults(c *gin.Context) {
	var data []models.MasterResult
	database.DB.Order("id").Find(&data)
	c.JSON(http.StatusOK, data)
}

func GetCountries(c *gin.Context) {
	var data []models.Country
	database.DB.Order("name").Find(&data)
	c.JSON(http.StatusOK, data)
}

// ── Product Groups ──────────────────────────────────────────────────────────

func GetProductGroups(c *gin.Context) {
	var data []models.ProductGroup
	database.DB.Order("id").Find(&data)
	c.JSON(http.StatusOK, data)
}

func CreateProductGroup(c *gin.Context) {
	var g models.ProductGroup
	if err := c.ShouldBindJSON(&g); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := database.DB.Create(&g).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, g)
}

func UpdateProductGroup(c *gin.Context) {
	id := c.Param("id")
	var g models.ProductGroup
	if err := database.DB.First(&g, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Grup tidak ditemukan"})
		return
	}
	if err := c.ShouldBindJSON(&g); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	database.DB.Save(&g)
	c.JSON(http.StatusOK, g)
}

func DeleteProductGroup(c *gin.Context) {
	id := c.Param("id")
	database.DB.Delete(&models.ProductGroup{}, id)
	c.JSON(http.StatusOK, gin.H{"message": "Grup dihapus"})
}

// ── Products ─────────────────────────────────────────────────────────────────

func GetProducts(c *gin.Context) {
	var data []models.Product
	q := database.DB.Preload("Countries").Order("product_name")
	if c.Query("all") != "1" {
		q = q.Where("is_active = true")
	}
	q.Find(&data)
	c.JSON(http.StatusOK, data)
}

type ProductRequest struct {
	ProductName  string  `json:"product_name"`
	TripType     string  `json:"trip_type"`
	DurationDays int     `json:"duration_days"`
	PricePerPax  float64 `json:"price_per_pax"`
	Description  string  `json:"description"`
	IsActive     *bool   `json:"is_active"`
	CountryIDs   []uint  `json:"country_ids"`
}

func CreateProduct(c *gin.Context) {
	var req ProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	product := models.Product{
		ProductName:  req.ProductName,
		TripType:     req.TripType,
		DurationDays: req.DurationDays,
		PricePerPax:  req.PricePerPax,
		Description:  req.Description,
		IsActive:     true,
	}
	if req.IsActive != nil {
		product.IsActive = *req.IsActive
	}
	if err := database.DB.Create(&product).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if len(req.CountryIDs) > 0 {
		var countries []models.Country
		database.DB.Where("id IN ?", req.CountryIDs).Find(&countries)
		database.DB.Model(&product).Association("Countries").Replace(countries)
	}
	database.DB.Preload("Countries").First(&product, product.ID)
	c.JSON(http.StatusCreated, product)
}

func UpdateProduct(c *gin.Context) {
	id := c.Param("id")
	var product models.Product
	if err := database.DB.First(&product, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Produk tidak ditemukan"})
		return
	}
	var req ProductRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.ProductName != "" {
		updates["product_name"] = req.ProductName
	}
	if req.TripType != "" {
		updates["trip_type"] = req.TripType
	}
	if req.DurationDays != 0 {
		updates["duration_days"] = req.DurationDays
	}
	if req.PricePerPax != 0 {
		updates["price_per_pax"] = req.PricePerPax
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}
	if len(updates) > 0 {
		database.DB.Model(&product).Updates(updates)
	}
	if req.CountryIDs != nil {
		var countries []models.Country
		if len(req.CountryIDs) > 0 {
			database.DB.Where("id IN ?", req.CountryIDs).Find(&countries)
		}
		database.DB.Model(&product).Association("Countries").Replace(countries)
	}
	database.DB.Preload("Countries").First(&product, product.ID)
	c.JSON(http.StatusOK, product)
}

func DeleteProduct(c *gin.Context) {
	id := c.Param("id")
	database.DB.Model(&models.Product{}).Where("id = ?", id).Update("is_active", false)
	c.JSON(http.StatusOK, gin.H{"message": "Produk dinonaktifkan"})
}

func GetDepartures(c *gin.Context) {
	var data []models.Departure
	q := database.DB.Preload("Product").Order("departure_date")
	if pid := c.Query("product_id"); pid != "" {
		q = q.Where("product_id = ?", pid)
	}
	q.Find(&data)
	c.JSON(http.StatusOK, data)
}
