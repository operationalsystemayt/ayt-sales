package handlers

import (
	"net/http"
	"time"

	"github.com/ayt-sales/backend/internal/database"
	"github.com/ayt-sales/backend/internal/metaads"
	"github.com/ayt-sales/backend/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm/clause"
)

func GetDashboardSummary(c *gin.Context) {
	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")
	if dateFrom == "" {
		dateFrom = time.Now().Format("2006-01-") + "01"
	}
	if dateTo == "" {
		dateTo = time.Now().Format("2006-01-02")
	}

	var totalLeads int64
	var totalPemesan int64
	var totalPeserta struct{ Sum int64 }
	var totalRevenue struct{ Sum float64 }

	database.DB.Model(&models.Lead{}).
		Where("date_received BETWEEN ? AND ?", dateFrom, dateTo).
		Count(&totalLeads)

	database.DB.Model(&models.Booking{}).
		Where("booking_date BETWEEN ? AND ?", dateFrom, dateTo).
		Count(&totalPemesan)

	database.DB.Model(&models.Booking{}).
		Where("booking_date BETWEEN ? AND ?", dateFrom, dateTo).
		Select("COALESCE(SUM(pax), 0) as sum").Scan(&totalPeserta)

	database.DB.Model(&models.Booking{}).
		Where("booking_date BETWEEN ? AND ?", dateFrom, dateTo).
		Select("COALESCE(SUM(total_paid), 0) as sum").Scan(&totalRevenue)

	var crPemesan float64
	if totalLeads > 0 {
		crPemesan = float64(totalPemesan) / float64(totalLeads) * 100
	}
	var crPeserta float64
	if totalLeads > 0 {
		crPeserta = float64(totalPeserta.Sum) / float64(totalLeads) * 100
	}

	c.JSON(http.StatusOK, gin.H{
		"penjualan":  totalRevenue.Sum,
		"leads":      totalLeads,
		"pemesan":    totalPemesan,
		"peserta":    totalPeserta.Sum,
		"cr_pemesan": crPemesan,
		"cr_peserta": crPeserta,
	})
}

func GetDashboardLeaderboard(c *gin.Context) {
	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")
	if dateFrom == "" {
		dateFrom = time.Now().Format("2006-01-") + "01"
	}
	if dateTo == "" {
		dateTo = time.Now().Format("2006-01-02")
	}

	type LeaderboardRow struct {
		SalesID  string  `json:"sales_id"`
		FullName string  `json:"full_name"`
		Avatar   string  `json:"avatar"`
		TotalPax int64   `json:"total_pax"`
		Revenue  float64 `json:"revenue"`
	}

	rows := make([]LeaderboardRow, 0)
	database.DB.Raw(`
		SELECT u.id as sales_id, u.full_name, u.avatar,
		       COALESCE(SUM(b.pax), 0) as total_pax,
		       COALESCE(SUM(b.total_paid), 0) as revenue
		FROM users u
		LEFT JOIN bookings b ON b.sales_id = u.id
		  AND b.booking_date BETWEEN ? AND ?
		  AND b.deleted_at IS NULL
		WHERE u.is_active = true AND u.role = 'sales'
		GROUP BY u.id, u.full_name, u.avatar
		ORDER BY revenue DESC
		LIMIT 10
	`, dateFrom, dateTo).Scan(&rows)

	c.JSON(http.StatusOK, rows)
}

func GetDashboardTopProducts(c *gin.Context) {
	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")
	if dateFrom == "" {
		dateFrom = time.Now().Format("2006-01-") + "01"
	}
	if dateTo == "" {
		dateTo = time.Now().Format("2006-01-02")
	}

	type TopProductRow struct {
		ProductName string  `json:"product_name"`
		FlagURL     string  `json:"flag_url"`
		CountryName string  `json:"country_name"`
		TotalPax    int64   `json:"total_pax"`
		Revenue     float64 `json:"revenue"`
	}

	// Pax/revenue are aggregated per product in a subquery first, then joined to the
	// product_countries many2many table — joining countries before aggregating would
	// fan out the SUMs whenever a product has more than one country.
	rows := make([]TopProductRow, 0)
	database.DB.Raw(`
		SELECT p.product_name,
		       COALESCE(STRING_AGG(DISTINCT co.flag_url, ' '), '') as flag_url,
		       COALESCE(STRING_AGG(DISTINCT co.name, ', '), '') as country_name,
		       agg.total_pax, agg.revenue
		FROM (
			SELECT b.product_id, COALESCE(SUM(b.pax), 0) as total_pax, COALESCE(SUM(b.total_paid), 0) as revenue
			FROM bookings b
			WHERE b.booking_date BETWEEN ? AND ? AND b.deleted_at IS NULL
			GROUP BY b.product_id
		) agg
		JOIN products p ON p.id = agg.product_id
		LEFT JOIN product_countries pc ON pc.product_id = p.id
		LEFT JOIN countries co ON co.id = pc.country_id
		GROUP BY p.product_name, agg.total_pax, agg.revenue
		ORDER BY agg.revenue DESC
		LIMIT 5
	`, dateFrom, dateTo).Scan(&rows)

	c.JSON(http.StatusOK, rows)
}

func GetDashboardChart(c *gin.Context) {
	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")
	if dateFrom == "" {
		dateFrom = time.Now().Format("2006-01-") + "01"
	}
	if dateTo == "" {
		dateTo = time.Now().Format("2006-01-02")
	}

	type ChartRow struct {
		Day              int     `json:"day"`
		Leads            int64   `json:"leads"`
		Closing          int64   `json:"closing"`
		Revenue          float64 `json:"revenue"`
		TotalPrice       float64 `json:"total_price"`
		AdSpend          float64 `json:"ad_spend"`
		AdsConversations int64   `json:"ads_conversations"`
	}

	// Leads = sum of pax across leads received that day (a lead with pax unset/0 counts
	// as 1 person). Closing = sum of pax across bookings made that day. Revenue is what's
	// actually been paid (total_paid); TotalPrice is the full booking value regardless of
	// payment status — both scoped to bookings made that day. AdSpend/AdsConversations
	// come from ad_insights, synced separately from the Meta Marketing API (see
	// SyncAdInsights) — 0 for any day not yet synced.
	rows := make([]ChartRow, 0)
	database.DB.Raw(`
		SELECT
			EXTRACT(DAY FROM gs.day)::int as day,
			COALESCE((SELECT SUM(GREATEST(COALESCE(l.pax, 0), 1)) FROM leads l WHERE DATE(l.date_received) = gs.day AND l.deleted_at IS NULL), 0) as leads,
			COALESCE((SELECT SUM(b.pax) FROM bookings b WHERE DATE(b.booking_date) = gs.day AND b.deleted_at IS NULL), 0) as closing,
			COALESCE((SELECT SUM(b2.total_paid) FROM bookings b2 WHERE DATE(b2.booking_date) = gs.day AND b2.deleted_at IS NULL), 0) as revenue,
			COALESCE((SELECT SUM(b3.total_price) FROM bookings b3 WHERE DATE(b3.booking_date) = gs.day AND b3.deleted_at IS NULL), 0) as total_price,
			COALESCE((SELECT ai.spend FROM ad_insights ai WHERE ai.date = gs.day), 0) as ad_spend,
			COALESCE((SELECT ai.conversations FROM ad_insights ai WHERE ai.date = gs.day), 0) as ads_conversations
		FROM generate_series(?::date, ?::date, '1 day'::interval) AS gs(day)
		ORDER BY gs.day
	`, dateFrom, dateTo).Scan(&rows)

	c.JSON(http.StatusOK, rows)
}

// SyncAdInsights pulls daily spend/conversions from the Meta Marketing API
// for [date_from, date_to] and upserts them into ad_insights, keyed by date.
func SyncAdInsights(c *gin.Context) {
	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")
	if dateFrom == "" || dateTo == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date_from and date_to are required"})
		return
	}

	insights, err := metaads.FetchDailyInsights(dateFrom, dateTo)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	rows := make([]models.AdInsight, 0, len(insights))
	for _, ins := range insights {
		rows = append(rows, models.AdInsight{
			Date:          ins.Date,
			Spend:         ins.Spend,
			Impressions:   ins.Impressions,
			Clicks:        ins.Clicks,
			Conversations: ins.Conversations,
		})
	}

	if len(rows) > 0 {
		database.DB.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "date"}},
			DoUpdates: clause.AssignmentColumns([]string{"spend", "impressions", "clicks", "conversations", "updated_at"}),
		}).Create(&rows)
	}

	c.JSON(http.StatusOK, gin.H{"synced": len(rows)})
}

func GetTopTrips(c *gin.Context) {
	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")
	if dateFrom == "" {
		dateFrom = time.Now().Format("2006-01-") + "01"
	}
	if dateTo == "" {
		dateTo = time.Now().Format("2006-01-02")
	}

	type TripRow struct {
		TripType string  `json:"trip_type"`
		TotalPax int64   `json:"total_pax"`
		Revenue  float64 `json:"revenue"`
	}

	rows := make([]TripRow, 0)
	database.DB.Raw(`
		SELECT p.trip_type,
		       COALESCE(SUM(b.pax), 0) as total_pax,
		       COALESCE(SUM(b.total_paid), 0) as revenue
		FROM bookings b
		JOIN products p ON p.id = b.product_id
		WHERE b.booking_date BETWEEN ? AND ?
		  AND b.deleted_at IS NULL
		GROUP BY p.trip_type
		ORDER BY revenue DESC
	`, dateFrom, dateTo).Scan(&rows)

	c.JSON(http.StatusOK, rows)
}
