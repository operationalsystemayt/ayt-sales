package handlers

import (
	"net/http"
	"strconv"

	"github.com/ayt-sales/backend/internal/database"
	"github.com/ayt-sales/backend/internal/models"
	"github.com/gin-gonic/gin"
)

func GetSettings(c *gin.Context) {
	var settings []models.Setting
	database.DB.Find(&settings)
	out := map[string]string{}
	for _, s := range settings {
		out[s.Key] = s.Value
	}
	c.JSON(http.StatusOK, out)
}

type UpdateSettingsRequest struct {
	DormantHours       *int    `json:"dormant_hours"`
	CloseHours         *int    `json:"close_hours"`
	Provider           *string `json:"whatsapp_provider"`
	ContactDormantDays *int    `json:"contact_dormant_days"`
	ContactActiveDays  *int    `json:"contact_active_days"`
}

func upsertSetting(key, value string) {
	res := database.DB.Model(&models.Setting{}).Where("key = ?", key).Update("value", value)
	if res.RowsAffected == 0 {
		database.DB.Create(&models.Setting{Key: key, Value: value})
	}
}

func UpdateSettings(c *gin.Context) {
	var req UpdateSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dormant := GetDormantHours()
	closeH := GetCloseHours()
	if req.DormantHours != nil {
		dormant = *req.DormantHours
	}
	if req.CloseHours != nil {
		closeH = *req.CloseHours
	}
	if dormant <= 0 || closeH <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "dormant_hours dan close_hours harus > 0"})
		return
	}
	if closeH <= dormant {
		c.JSON(http.StatusBadRequest, gin.H{"error": "close_hours harus lebih besar dari dormant_hours"})
		return
	}

	if req.Provider != nil && *req.Provider != "waba" && *req.Provider != "waha" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "whatsapp_provider harus 'waba' atau 'waha'"})
		return
	}

	if req.DormantHours != nil {
		upsertSetting("dormant_hours", strconv.Itoa(*req.DormantHours))
	}
	if req.CloseHours != nil {
		upsertSetting("close_hours", strconv.Itoa(*req.CloseHours))
	}
	if req.Provider != nil {
		upsertSetting("whatsapp_provider", *req.Provider)
	}
	if req.ContactDormantDays != nil {
		if *req.ContactDormantDays <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "contact_dormant_days harus > 0"})
			return
		}
		upsertSetting("contact_dormant_days", strconv.Itoa(*req.ContactDormantDays))
	}
	if req.ContactActiveDays != nil {
		if *req.ContactActiveDays <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "contact_active_days harus > 0"})
			return
		}
		upsertSetting("contact_active_days", strconv.Itoa(*req.ContactActiveDays))
	}

	c.JSON(http.StatusOK, gin.H{"message": "Settings updated"})
}

func getIntSetting(key string, fallback int) int {
	var s models.Setting
	if err := database.DB.Where("key = ?", key).First(&s).Error; err != nil {
		return fallback
	}
	n, err := strconv.Atoi(s.Value)
	if err != nil {
		return fallback
	}
	return n
}

// GetDormantHours and GetCloseHours are consumed by leads.go's status recompute.
func GetDormantHours() int { return getIntSetting("dormant_hours", 12) }
func GetCloseHours() int   { return getIntSetting("close_hours", 72) }
