package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DBHost            string
	DBUser            string
	DBPassword        string
	DBName            string
	DBPort            string
	JWTSecret         string
	Port              string
	WebhookSecret     string
	WabaAccessToken   string
	WabaPhoneNumberID string
	WahaBaseURL       string
	WahaAPIKey        string
	WahaSession       string
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}
	return &Config{
		DBHost:            getEnv("DB_HOST", "localhost"),
		DBUser:            getEnv("DB_USER", "postgres"),
		DBPassword:        getEnv("DB_PASSWORD", "postgres"),
		DBName:            getEnv("DB_NAME", "ayt_sales"),
		DBPort:            getEnv("DB_PORT", "5432"),
		JWTSecret:         getEnv("JWT_SECRET", "super-secret-key-change-in-production"),
		Port:              getEnv("PORT", "8080"),
		WebhookSecret:     getEnv("WEBHOOK_SECRET", "change-me-webhook-secret"),
		WabaAccessToken:   getEnv("WABA_ACCESS_TOKEN", ""),
		WabaPhoneNumberID: getEnv("WABA_PHONE_NUMBER_ID", ""),
		WahaBaseURL:       getEnv("WAHA_BASE_URL", "http://localhost:3000"),
		WahaAPIKey:        getEnv("WAHA_API_KEY", ""),
		WahaSession:       getEnv("WAHA_SESSION", "default"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
