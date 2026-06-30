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

func GetProductGroups(c *gin.Context) {
	var data []models.ProductGroup
	database.DB.Order("id").Find(&data)
	c.JSON(http.StatusOK, data)
}

func GetProducts(c *gin.Context) {
	var data []models.Product
	database.DB.Preload("Country").Where("is_active = true").Order("product_name").Find(&data)
	c.JSON(http.StatusOK, data)
}

func CreateProduct(c *gin.Context) {
	var product models.Product
	if err := c.ShouldBindJSON(&product); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := database.DB.Create(&product).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, product)
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
