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
		&models.Chat{},
		&models.Setting{},
		&models.Booking{},
		&models.BookingPayment{},
	)
	if err != nil {
		log.Fatal("Migration failed:", err)
	}
	log.Println("Database migrated successfully")
}

func seed(db *gorm.DB) {
	// Idempotent backfills for already-provisioned databases (run every startup)
	db.Model(&models.MasterResult{}).Where("name = ?", "Deal").Update("name", "Converted")
	seedSettings(db)
	seedCloseStatus(db)
	seedManualStatus(db)
	seedCountries(db)

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
		{Name: "Close", Color: "black"},
	}
	db.Create(&statuses)

	results := []models.MasterResult{{Name: "Belum"}, {Name: "Cancel"}, {Name: "Converted"}}
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

	log.Println("Database seeded successfully")
}

// seedManualStatus adds the "Manual" lead status (assigned to leads created via
// the manual-add form, which have no WhatsApp thread to derive a status from).
func seedManualStatus(db *gorm.DB) {
	var s models.MasterStatus
	if err := db.Where("name = ?", "Manual").First(&s).Error; err != nil {
		db.Create(&models.MasterStatus{Name: "Manual", Color: "purple"})
	}
}

// seedCountries idempotently backfills any country missing from an already-provisioned
// database, so re-running on an existing install picks up newly added destinations.
func seedCountries(db *gorm.DB) {
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
		{Name: "Maldive", Code: "MV", FlagURL: "🇲🇻"},
		{Name: "China", Code: "CN", FlagURL: "🇨🇳"},
		{Name: "Switzerland", Code: "CH", FlagURL: "🇨🇭"},
		{Name: "Madinah", Code: "MED", FlagURL: "🕌"},
		{Name: "Mekkah", Code: "MEK", FlagURL: "🕋"},
		{Name: "Russia", Code: "RU", FlagURL: "🇷🇺"},
		{Name: "Kyrgyzstan", Code: "KG", FlagURL: "🇰🇬"},
		{Name: "Australia", Code: "AU", FlagURL: "🇦🇺"},
	}
	for _, c := range countries {
		var existing models.Country
		if err := db.Where("name = ?", c.Name).First(&existing).Error; err != nil {
			db.Create(&c)
		}
	}
}

func seedSettings(db *gorm.DB) {
	// Migrate the old single-threshold key (pre Dormant/Close split) if present.
	var old models.Setting
	if err := db.Where("key = ?", "waiting_customer_hours").First(&old).Error; err == nil {
		var dormant models.Setting
		if err := db.Where("key = ?", "dormant_hours").First(&dormant).Error; err != nil {
			db.Create(&models.Setting{Key: "dormant_hours", Value: old.Value})
		}
		db.Delete(&old)
	}

	defaults := map[string]string{
		"dormant_hours":        "12",
		"close_hours":          "72",
		"whatsapp_provider":    "waba",
		"contact_dormant_days": "365",
		"contact_active_days":  "60",
	}
	for k, v := range defaults {
		var s models.Setting
		if err := db.Where("key = ?", k).First(&s).Error; err != nil {
			db.Create(&models.Setting{Key: k, Value: v})
		}
	}
}

func seedCloseStatus(db *gorm.DB) {
	var s models.MasterStatus
	if err := db.Where("name = ?", "Close").First(&s).Error; err != nil {
		db.Create(&models.MasterStatus{Name: "Close", Color: "black"})
	}
}
