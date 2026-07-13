package handlers

import (
	"net/http"
	"time"

	"github.com/ayt-sales/backend/internal/database"
	"github.com/gin-gonic/gin"
)

func reportDateRange(c *gin.Context) (string, string) {
	dateFrom := c.Query("date_from")
	dateTo := c.Query("date_to")
	if dateFrom == "" {
		dateFrom = time.Now().Format("2006-01-") + "01"
	}
	if dateTo == "" {
		dateTo = time.Now().Format("2006-01-02")
	}
	return dateFrom, dateTo
}

// GetReportSales powers the Report page's per-sales performance table: how many leads
// each sales received, how many closed into a booking, total pax, and total value —
// all scoped to the same date range.
func GetReportSales(c *gin.Context) {
	dateFrom, dateTo := reportDateRange(c)

	type ReportSalesRow struct {
		SalesID      string  `json:"sales_id"`
		FullName     string  `json:"full_name"`
		Avatar       string  `json:"avatar"`
		LeadsCount   int64   `json:"leads_count"`
		ClosingCount int64   `json:"closing_count"`
		TotalPax     int64   `json:"total_pax"`
		Revenue      float64 `json:"revenue"`
	}

	rows := make([]ReportSalesRow, 0)
	database.DB.Raw(`
		SELECT u.id as sales_id, u.full_name, u.avatar,
		       COALESCE(l.leads_count, 0) as leads_count,
		       COALESCE(b.closing_count, 0) as closing_count,
		       COALESCE(b.total_pax, 0) as total_pax,
		       COALESCE(b.revenue, 0) as revenue
		FROM users u
		LEFT JOIN (
			SELECT sales_id, COUNT(*) as leads_count
			FROM leads
			WHERE date_received BETWEEN ? AND ? AND deleted_at IS NULL
			GROUP BY sales_id
		) l ON l.sales_id = u.id
		LEFT JOIN (
			SELECT sales_id, COUNT(*) as closing_count, COALESCE(SUM(pax), 0) as total_pax, COALESCE(SUM(total_paid), 0) as revenue
			FROM bookings
			WHERE booking_date BETWEEN ? AND ? AND deleted_at IS NULL
			GROUP BY sales_id
		) b ON b.sales_id = u.id
		WHERE u.is_active = true AND u.role = 'sales'
		ORDER BY revenue DESC
	`, dateFrom, dateTo, dateFrom, dateTo).Scan(&rows)

	c.JSON(http.StatusOK, rows)
}
