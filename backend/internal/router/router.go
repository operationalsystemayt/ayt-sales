package router

import (
	"fmt"
	"time"

	"github.com/ayt-sales/backend/internal/config"
	"github.com/ayt-sales/backend/internal/handlers"
	"github.com/ayt-sales/backend/internal/middleware"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func Setup(cfg *config.Config) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())

	// Structured request logger
	r.Use(func(c *gin.Context) {
		start := time.Now()
		c.Next()
		latency := time.Since(start)
		status := c.Writer.Status()
		color := ""
		switch {
		case status >= 500:
			color = "\033[31m" // red
		case status >= 400:
			color = "\033[33m" // yellow
		case status >= 200:
			color = "\033[32m" // green
		}
		fmt.Printf("%s[%d]\033[0m %s %s  %v  %s\n",
			color, status, c.Request.Method, c.Request.URL.Path,
			latency, c.ClientIP(),
		)
	})

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	api := r.Group("/api")

	// Auth
	api.POST("/auth/login", handlers.Login)

	// Public webhooks (no JWT — called by WhatsApp/Meta or WAHA infra, gated by shared secret)
	api.POST("/webhooks/whatsapp", middleware.WebhookSecret(cfg.WebhookSecret), handlers.WhatsAppWebhook)
	api.POST("/webhooks/waha", middleware.WebhookSecret(cfg.WebhookSecret), handlers.WahaWebhook)

	// Protected routes
	auth := api.Group("/")
	auth.Use(middleware.AuthMiddleware())
	auth.Use(middleware.RequireNotViewer())
	{
		auth.GET("/auth/me", handlers.Me)

		// Users / Sales
		auth.GET("/users", handlers.GetUsers)
		auth.POST("/users", middleware.RequireRole("admin"), handlers.CreateUser)
		auth.PUT("/users/:id", middleware.RequireRole("admin"), handlers.UpdateUser)

		// Master data
		auth.GET("/master/sources", handlers.GetMasterSources)
		auth.GET("/master/inputs", handlers.GetMasterInputs)
		auth.GET("/master/qualities", handlers.GetMasterQualities)
		auth.GET("/master/statuses", handlers.GetMasterStatuses)
		auth.GET("/master/results", handlers.GetMasterResults)
		auth.GET("/countries", handlers.GetCountries)
		auth.GET("/product-groups", handlers.GetProductGroups)
		auth.POST("/product-groups", handlers.CreateProductGroup)
		auth.PUT("/product-groups/:id", handlers.UpdateProductGroup)
		auth.DELETE("/product-groups/:id", handlers.DeleteProductGroup)
		auth.GET("/products", handlers.GetProducts)
		auth.POST("/products", handlers.CreateProduct)
		auth.PUT("/products/:id", handlers.UpdateProduct)
		auth.DELETE("/products/:id", handlers.DeleteProduct)
		auth.GET("/departures", handlers.GetDepartures)

		// Leads
		auth.GET("/leads", handlers.GetLeads)
		auth.GET("/leads/summary", handlers.GetLeadsSummary)
		auth.POST("/leads", handlers.CreateLead)
		auth.PUT("/leads/bulk", handlers.BulkUpdateLeads)
		auth.GET("/leads/:id", handlers.GetLead)
		auth.PUT("/leads/:id", handlers.UpdateLead)
		auth.DELETE("/leads/:id", handlers.DeleteLead)
		auth.POST("/leads/:id/convert", handlers.ConvertLeadToBooking)
		auth.GET("/leads/:id/chats", handlers.GetLeadChats)
		auth.POST("/leads/:id/chats", handlers.CreateLeadChat)
		auth.POST("/leads/:id/chats/read", handlers.MarkChatRead)
		auth.POST("/leads/:id/chats/sync", handlers.SyncLeadChats)
		auth.POST("/leads/:id/archive", handlers.ArchiveLead)
		auth.POST("/leads/:id/unarchive", handlers.UnarchiveLead)
		auth.GET("/leads/:id/activities", handlers.GetLeadActivities)
		auth.POST("/leads/:id/activities", handlers.CreateLeadActivity)

		// Customers / Contact
		auth.GET("/customers", handlers.GetCustomers)
		auth.GET("/customers/summary", handlers.GetContactSummary)
		auth.PUT("/customers/:id", handlers.UpdateCustomer)
		auth.POST("/customers/:id/save", handlers.SaveCustomer)
		auth.GET("/customers/:id/summary", handlers.GetCustomerSummary)

		// Chat inbox
		auth.GET("/chats/inbox", handlers.GetChatInbox)
		auth.GET("/chats/summary", handlers.GetChatSummary)

		// Bookings
		auth.GET("/bookings", handlers.GetBookings)
		auth.GET("/bookings/summary", handlers.GetBookingSummary)
		auth.POST("/bookings", handlers.CreateBooking)
		auth.PUT("/bookings/:id", handlers.UpdateBooking)
		auth.DELETE("/bookings/:id", handlers.DeleteBooking)
		auth.GET("/bookings/:id/payments", handlers.GetPayments)
		auth.POST("/bookings/:id/payments", handlers.AddPayment)
		auth.DELETE("/bookings/:id/payments/:paymentId", handlers.DeletePayment)

		// Dashboard
		auth.GET("/dashboard/summary", handlers.GetDashboardSummary)
		auth.GET("/dashboard/leaderboard", handlers.GetDashboardLeaderboard)
		auth.GET("/dashboard/top-products", handlers.GetDashboardTopProducts)
		auth.GET("/dashboard/chart", handlers.GetDashboardChart)
		auth.GET("/dashboard/top-trips", handlers.GetTopTrips)
		auth.POST("/dashboard/ads/sync", middleware.RequireRole("admin"), handlers.SyncAdInsights)

		// Reports
		auth.GET("/reports/sales", handlers.GetReportSales)

		// Settings (admin only)
		settings := auth.Group("/settings")
		settings.Use(middleware.RequireRole("admin"))
		{
			settings.GET("", handlers.GetSettings)
			settings.PUT("", handlers.UpdateSettings)
		}
	}

	return r
}
