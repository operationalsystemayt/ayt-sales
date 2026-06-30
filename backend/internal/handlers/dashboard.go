package handlers

import (
	"net/http"
	"time"

	"github.com/ayt-sales/backend/internal/database"
	"github.com/ayt-sales/backend/internal/models"
	"github.com/gin-gonic/gin"
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
		"penjualan":   totalRevenue.Sum,
		"leads":       totalLeads,
		"pemesan":     totalPemesan,
		"peserta":     totalPeserta.Sum,
		"cr_pemesan":  crPemesan,
		"cr_peserta":  crPeserta,
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
		SalesID   string  `json:"sales_id"`
		FullName  string  `json:"full_name"`
		Avatar    string  `json:"avatar"`
		TotalPax  int64   `json:"total_pax"`
		Revenue   float64 `json:"revenue"`
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

	rows := make([]TopProductRow, 0)
	database.DB.Raw(`
		SELECT p.product_name, co.flag_url, co.name as country_name,
		       COALESCE(SUM(b.pax), 0) as total_pax,
		       COALESCE(SUM(b.total_paid), 0) as revenue
		FROM bookings b
		JOIN products p ON p.id = b.product_id
		LEFT JOIN countries co ON co.id = p.country_id
		WHERE b.booking_date BETWEEN ? AND ?
		  AND b.deleted_at IS NULL
		GROUP BY p.product_name, co.flag_url, co.name
		ORDER BY revenue DESC
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
		Day     int     `json:"day"`
		Leads   int64   `json:"leads"`
		Closing int64   `json:"closing"`
		Revenue float64 `json:"revenue"`
	}

	rows := make([]ChartRow, 0)
	database.DB.Raw(`
		SELECT
			EXTRACT(DAY FROM gs.day)::int as day,
			COALESCE((SELECT COUNT(*) FROM leads l WHERE DATE(l.date_received) = gs.day AND l.deleted_at IS NULL), 0) as leads,
			COALESCE((SELECT COUNT(*) FROM bookings b WHERE DATE(b.booking_date) = gs.day AND b.deleted_at IS NULL), 0) as closing,
			COALESCE((SELECT SUM(b2.total_paid) FROM bookings b2 WHERE DATE(b2.booking_date) = gs.day AND b2.deleted_at IS NULL), 0) as revenue
		FROM generate_series(?::date, ?::date, '1 day'::interval) AS gs(day)
		ORDER BY gs.day
	`, dateFrom, dateTo).Scan(&rows)

	c.JSON(http.StatusOK, rows)
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
