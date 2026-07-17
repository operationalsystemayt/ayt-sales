package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	FullName     string    `gorm:"type:varchar(150);not null" json:"full_name"`
	Email        string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	Phone        string    `gorm:"type:varchar(30)" json:"phone"`
	PasswordHash string    `gorm:"type:varchar(255);not null" json:"-"`
	Role         string    `gorm:"type:varchar(20);default:'sales'" json:"role"`
	Avatar       string    `gorm:"type:text" json:"avatar"`
	// WahaSession is the WAHA session name bound to this sales rep's WhatsApp
	// number (e.g. one session per registered number). Empty means this user
	// isn't mapped to a WAHA session — inbound messages on unmapped sessions
	// and outbound sends for leads with no session-mapped sales fall back to
	// the default session (config.WahaSession).
	WahaSession string    `gorm:"type:varchar(100)" json:"waha_session"`
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type MasterSource struct {
	ID   uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	Name string `gorm:"type:varchar(100);uniqueIndex;not null" json:"name"`
}

type MasterInput struct {
	ID   uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	Name string `gorm:"type:varchar(50);not null" json:"name"`
}

type MasterQuality struct {
	ID    uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	Name  string `gorm:"type:varchar(50);not null" json:"name"`
	Color string `gorm:"type:varchar(20)" json:"color"`
}

type MasterStatus struct {
	ID    uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	Name  string `gorm:"type:varchar(100);not null" json:"name"`
	Color string `gorm:"type:varchar(20)" json:"color"`
}

type MasterResult struct {
	ID   uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	Name string `gorm:"type:varchar(50);not null" json:"name"`
}

type Country struct {
	ID      uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	Name    string `gorm:"type:varchar(100);not null" json:"name"`
	Code    string `gorm:"type:varchar(10)" json:"code"`
	FlagURL string `gorm:"type:text" json:"flag_url"`
}

type ProductGroup struct {
	ID   uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	Name string `gorm:"type:varchar(100);not null" json:"name"`
}

type Product struct {
	ID           uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Countries    []Country `gorm:"many2many:product_countries;" json:"countries,omitempty"`
	ProductName  string    `gorm:"type:varchar(200);not null" json:"product_name"`
	TripType     string    `gorm:"type:varchar(30)" json:"trip_type"`
	DurationDays int       `json:"duration_days"`
	PricePerPax  float64   `gorm:"type:numeric(15,2)" json:"price_per_pax"`
	Description  string    `gorm:"type:text" json:"description"`
	IsActive     bool      `gorm:"default:true" json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
}

type Departure struct {
	ID            uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	ProductID     uint      `json:"product_id"`
	Product       *Product  `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	DepartureDate time.Time `gorm:"type:date" json:"departure_date"`
	Quota         int       `json:"quota"`
	BookedPax     int       `gorm:"default:0" json:"booked_pax"`
	CreatedAt     time.Time `json:"created_at"`
}

type Customer struct {
	ID             uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	FullName       string     `gorm:"type:varchar(200);not null" json:"full_name"`
	Phone          string     `gorm:"type:varchar(30);not null" json:"phone"`
	Email          string     `gorm:"type:varchar(200)" json:"email"`
	Gender         string     `gorm:"type:varchar(20)" json:"gender"`
	BirthDate      *time.Time `gorm:"type:date" json:"birth_date"`
	PassportNumber string     `gorm:"type:varchar(100)" json:"passport_number"`
	Address        string     `gorm:"type:text" json:"address"`
	Notes          string     `gorm:"type:text" json:"notes"`
	IsFavorite     bool       `gorm:"default:false" json:"is_favorite"`
	IsSaved        bool       `gorm:"default:false" json:"is_saved"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type Lead struct {
	ID           uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	CustomerID   uuid.UUID      `gorm:"type:uuid;not null" json:"customer_id"`
	Customer     *Customer      `gorm:"foreignKey:CustomerID" json:"customer,omitempty"`
	SalesID      *uuid.UUID     `gorm:"type:uuid" json:"sales_id"`
	Sales        *User          `gorm:"foreignKey:SalesID" json:"sales,omitempty"`
	LeadNo       string         `gorm:"type:varchar(50);uniqueIndex" json:"lead_no"`
	SourceID     *uint          `json:"source_id"`
	Source       *MasterSource  `gorm:"foreignKey:SourceID" json:"source,omitempty"`
	InputID      *uint          `json:"input_id"`
	Input        *MasterInput   `gorm:"foreignKey:InputID" json:"input,omitempty"`
	QualityID    *uint          `json:"quality_id"`
	Quality      *MasterQuality `gorm:"foreignKey:QualityID" json:"quality,omitempty"`
	StatusID     *uint          `json:"status_id"`
	Status       *MasterStatus  `gorm:"foreignKey:StatusID" json:"status,omitempty"`
	ResultID     *uint          `json:"result_id"`
	Result       *MasterResult  `gorm:"foreignKey:ResultID" json:"result,omitempty"`
	ProductID    *uint          `json:"product_id"`
	Product      *Product       `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	GroupID      *uint          `json:"group_id"`
	Group        *ProductGroup  `gorm:"foreignKey:GroupID" json:"group,omitempty"`
	Price        *float64       `gorm:"type:numeric(15,2)" json:"price"`
	Pax          *int           `json:"pax"`
	TotalPrice   *float64       `gorm:"type:numeric(15,2)" json:"total_price"`
	DateReceived *time.Time     `gorm:"type:date" json:"date_received"`
	DealDate     *time.Time     `gorm:"type:date" json:"deal_date"`
	FollowUpDate *time.Time     `gorm:"type:date" json:"follow_up_date"`
	LastChatAt   *time.Time     `json:"last_chat_at"`
	LastReadAt   *time.Time     `json:"last_read_at"`
	Notes        string         `gorm:"type:text" json:"notes"`
	IsConverted  bool           `gorm:"default:false" json:"is_converted"`
	IsArchived   bool           `gorm:"default:false" json:"is_archived"`
	ConvertedAt  *time.Time     `json:"converted_at"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// AdInsight is a daily aggregate synced from the Meta Marketing API Insights
// endpoint (one row per calendar day, upserted on Date). Conversations counts
// the "onsite_conversion.messaging_conversation_started_7d" action — Meta's
// proxy for a lead on Click-to-WhatsApp campaigns.
type AdInsight struct {
	ID            uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Date          time.Time `gorm:"type:date;uniqueIndex;not null" json:"date"`
	Spend         float64   `gorm:"type:numeric(15,2);default:0" json:"spend"`
	Impressions   int64     `gorm:"default:0" json:"impressions"`
	Clicks        int64     `gorm:"default:0" json:"clicks"`
	Conversations int64     `gorm:"default:0" json:"conversations"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Booking struct {
	ID               uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	BookingNo        string         `gorm:"type:varchar(50);uniqueIndex;not null" json:"booking_no"`
	CustomerID       uuid.UUID      `gorm:"type:uuid;not null" json:"customer_id"`
	Customer         *Customer      `gorm:"foreignKey:CustomerID" json:"customer,omitempty"`
	LeadID           *uuid.UUID     `gorm:"type:uuid" json:"lead_id"`
	SalesID          *uuid.UUID     `gorm:"type:uuid" json:"sales_id"`
	Sales            *User          `gorm:"foreignKey:SalesID" json:"sales,omitempty"`
	ProductID        *uint          `json:"product_id"`
	Product          *Product       `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	GroupID          *uint          `json:"group_id"`
	Group            *ProductGroup  `gorm:"foreignKey:GroupID" json:"group,omitempty"`
	SourceID         *uint          `json:"source_id"`
	Source           *MasterSource  `gorm:"foreignKey:SourceID" json:"source,omitempty"`
	Countries        []Country      `gorm:"many2many:booking_countries;" json:"countries,omitempty"`
	Lead             *Lead          `gorm:"foreignKey:LeadID" json:"lead,omitempty"`
	DepartureID      *uint          `json:"departure_id"`
	Departure        *Departure     `gorm:"foreignKey:DepartureID" json:"departure,omitempty"`
	BookingDate      time.Time      `gorm:"type:date;not null" json:"booking_date"`
	DepartureDate    *time.Time     `gorm:"type:date" json:"departure_date"`
	Pax              int            `gorm:"not null" json:"pax"`
	PricePerPax      float64        `gorm:"type:numeric(18,2)" json:"price_per_pax"`
	TotalPrice       float64        `gorm:"type:numeric(18,2)" json:"total_price"`
	TotalPaid        float64        `gorm:"type:numeric(18,2);default:0" json:"total_paid"`
	RemainingPayment float64        `gorm:"type:numeric(18,2);default:0" json:"remaining_payment"`
	BookingStatus    string         `gorm:"type:varchar(50)" json:"booking_status"`
	Notes            string         `gorm:"type:text" json:"notes"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

type BookingPayment struct {
	ID            uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	BookingID     uuid.UUID  `gorm:"type:uuid;not null" json:"booking_id"`
	PaymentNo     int        `json:"payment_no"`
	PaymentDate   *time.Time `gorm:"type:date" json:"payment_date"`
	Amount        float64    `gorm:"type:numeric(18,2)" json:"amount"`
	PaymentMethod string     `gorm:"type:varchar(50)" json:"payment_method"`
	ReferenceNo   string     `gorm:"type:varchar(100)" json:"reference_no"`
	Notes         string     `gorm:"type:text" json:"notes"`
	CreatedAt     time.Time  `json:"created_at"`
}

type LeadActivity struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	LeadID    uuid.UUID  `gorm:"type:uuid;not null" json:"lead_id"`
	Activity  string     `gorm:"type:varchar(100)" json:"activity"`
	Notes     string     `gorm:"type:text" json:"notes"`
	CreatedBy *uuid.UUID `gorm:"type:uuid" json:"created_by"`
	Creator   *User      `gorm:"foreignKey:CreatedBy" json:"creator,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

type Chat struct {
	ID                uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	LeadID            uuid.UUID  `gorm:"type:uuid;not null;index" json:"lead_id"`
	CustomerID        uuid.UUID  `gorm:"type:uuid;not null" json:"customer_id"`
	Direction         string     `gorm:"type:varchar(10);not null" json:"direction"` // "in" | "out"
	FromPhone         string     `gorm:"type:varchar(30)" json:"from_phone"`
	Body              string     `gorm:"type:text" json:"body"`
	ChatTimestamp     time.Time  `json:"chat_timestamp"`
	ProviderMessageID *string    `gorm:"type:varchar(200);index" json:"provider_message_id,omitempty"`
	CreatedBy         *uuid.UUID `gorm:"type:uuid" json:"created_by,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
}

type Setting struct {
	Key       string    `gorm:"type:varchar(100);primaryKey" json:"key"`
	Value     string    `gorm:"type:text" json:"value"`
	UpdatedAt time.Time `json:"updated_at"`
}
