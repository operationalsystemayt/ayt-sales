package main

import (
	"log"

	"github.com/ayt-sales/backend/internal/config"
	"github.com/ayt-sales/backend/internal/database"
	"github.com/ayt-sales/backend/internal/middleware"
	"github.com/ayt-sales/backend/internal/router"
	"github.com/ayt-sales/backend/internal/whatsapp"
)

func main() {
	cfg := config.Load()
	middleware.JWTSecret = cfg.JWTSecret
	whatsapp.Init(cfg)

	database.Connect(cfg)

	r := router.Setup(cfg)

	log.Printf("Server running on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
