package router

import (
	"github.com/ayt-sales/backend/internal/handlers"
	"github.com/ayt-sales/backend/internal/middleware"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func Setup() *gin.Engine {
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	api := r.Group("/api")

	// Auth
	api.POST("/auth/login", handlers.Login)

	// Protected routes
	auth := api.Group("/")
	auth.Use(middleware.AuthMiddleware())
	{
		auth.GET("/auth/me", handlers.Me)

		// Users / Sales
		auth.GET("/users", handlers.GetUsers)
		auth.POST("/users", handlers.CreateUser)

		// Master data
		auth.GET("/master/sources", handlers.GetMasterSources)
		auth.GET("/master/inputs", handlers.GetMasterInputs)
		auth.GET("/master/qualities", handlers.GetMasterQualities)
		auth.GET("/master/statuses", handlers.GetMasterStatuses)
		auth.GET("/master/results", handlers.GetMasterResults)
		auth.GET("/countries", handlers.GetCountries)
		auth.GET("/product-groups", handlers.GetProductGroups)
		auth.GET("/products", handlers.GetProducts)
		auth.POST("/products", handlers.CreateProduct)
		auth.GET("/departures", handlers.GetDepartures)

		// Leads
		auth.GET("/leads", handlers.GetLeads)
		auth.POST("/leads", handlers.CreateLead)
		auth.PUT("/leads/bulk", handlers.BulkUpdateLeads)
		auth.PUT("/leads/:id", handlers.UpdateLead)
		auth.DELETE("/leads/:id", handlers.DeleteLead)
		auth.POST("/leads/:id/convert", handlers.ConvertLeadToBooking)

		// Bookings
		auth.GET("/bookings", handlers.GetBookings)
		auth.GET("/bookings/summary", handlers.GetBookingSummary)
		auth.POST("/bookings", handlers.CreateBooking)
		auth.PUT("/bookings/:id", handlers.UpdateBooking)
		auth.DELETE("/bookings/:id", handlers.DeleteBooking)
		auth.GET("/bookings/:id/payments", handlers.GetPayments)
		auth.POST("/bookings/:id/payments", handlers.AddPayment)

		// Dashboard
		auth.GET("/dashboard/summary", handlers.GetDashboardSummary)
		auth.GET("/dashboard/leaderboard", handlers.GetDashboardLeaderboard)
		auth.GET("/dashboard/top-products", handlers.GetDashboardTopProducts)
		auth.GET("/dashboard/chart", handlers.GetDashboardChart)
		auth.GET("/dashboard/top-trips", handlers.GetTopTrips)
	}

	return r
}
