package database

import (
	"fmt"
	"log"

	"github.com/ayt-sales/backend/internal/config"
	"github.com/ayt-sales/backend/internal/models"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect(cfg *config.Config) {
	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Jakarta",
		cfg.DBHost, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBPort,
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	DB = db
	log.Println("Database connected successfully")

	migrate(db)
	seed(db)
}

func migrate(db *gorm.DB) {
	err := db.AutoMigrate(
		&models.User{},
		&models.MasterSource{},
		&models.MasterInput{},
		&models.MasterQuality{},
		&models.MasterStatus{},
		&models.MasterResult{},
		&models.Country{},
		&models.ProductGroup{},
		&models.Product{},
		&models.Departure{},
		&models.Customer{},
		&models.Lead{},
		&models.LeadActivity{},
		&models.Booking{},
		&models.BookingPayment{},
	)
	if err != nil {
		log.Fatal("Migration failed:", err)
	}
	log.Println("Database migrated successfully")
}

func seed(db *gorm.DB) {
	var count int64
	db.Model(&models.MasterSource{}).Count(&count)
	if count > 0 {
		return
	}

	sources := []models.MasterSource{{Name: "Ads"}, {Name: "Organik"}, {Name: "Referensi"}, {Name: "Offline"}}
	db.Create(&sources)

	inputs := []models.MasterInput{{Name: "Otomatis"}, {Name: "Manual"}}
	db.Create(&inputs)

	qualities := []models.MasterQuality{
		{Name: "Cold", Color: "blue"},
		{Name: "Warm", Color: "orange"},
		{Name: "Hot", Color: "red"},
	}
	db.Create(&qualities)

	statuses := []models.MasterStatus{
		{Name: "Need Response", Color: "red"},
		{Name: "Waiting Customer", Color: "yellow"},
		{Name: "Dormant", Color: "gray"},
	}
	db.Create(&statuses)

	results := []models.MasterResult{{Name: "Belum"}, {Name: "Deal"}, {Name: "Cancel"}}
	db.Create(&results)

	groups := []models.ProductGroup{{Name: "Open Trip"}, {Name: "Private Trip"}}
	db.Create(&groups)

	// Default admin user
	hash, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	adminUser := models.User{
		ID:           uuid.New(),
		FullName:     "Admin",
		Email:        "admin@ayt.com",
		PasswordHash: string(hash),
		Role:         "admin",
		IsActive:     true,
	}
	db.Create(&adminUser)

	// Default sales users
	salesNames := []struct{ name, email string }{
		{"Raya", "raya@ayt.com"},
		{"Jean", "jean@ayt.com"},
		{"Jevry", "jevry@ayt.com"},
	}
	for _, s := range salesNames {
		h, _ := bcrypt.GenerateFromPassword([]byte("sales123"), bcrypt.DefaultCost)
		db.Create(&models.User{
			ID: uuid.New(), FullName: s.name, Email: s.email,
			PasswordHash: string(h), Role: "sales", IsActive: true,
		})
	}

	countries := []models.Country{
		{Name: "Jepang", Code: "JP", FlagURL: "🇯🇵"},
		{Name: "Korea Selatan", Code: "KR", FlagURL: "🇰🇷"},
		{Name: "Thailand", Code: "TH", FlagURL: "🇹🇭"},
		{Name: "Malaysia", Code: "MY", FlagURL: "🇲🇾"},
		{Name: "Singapore", Code: "SG", FlagURL: "🇸🇬"},
		{Name: "Vietnam", Code: "VN", FlagURL: "🇻🇳"},
		{Name: "Eropa", Code: "EU", FlagURL: "🇪🇺"},
		{Name: "Kazakhstan", Code: "KZ", FlagURL: "🇰🇿"},
		{Name: "Turki", Code: "TR", FlagURL: "🇹🇷"},
		{Name: "Hongkong", Code: "HK", FlagURL: "🇭🇰"},
	}
	db.Create(&countries)

	log.Println("Database seeded successfully")
}
