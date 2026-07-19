export interface User {
  id: string
  full_name: string
  email: string
  phone?: string
  role: 'admin' | 'sales' | 'viewer'
  avatar?: string
  is_active?: boolean
  waha_session?: string
}

export interface MasterSource { id: number; name: string }
export interface MasterInput { id: number; name: string }
export interface MasterQuality { id: number; name: string; color: string }
export interface MasterStatus { id: number; name: string; color: string }
export interface MasterResult { id: number; name: string }
export interface Country { id: number; name: string; code: string; flag_url: string }
export interface ProductGroup { id: number; name: string }

export interface Product {
  id: number
  product_name: string
  trip_type: string
  countries?: Country[]
  duration_days: number
  price_per_pax: number
  is_active: boolean
}

export interface Customer {
  id: string
  full_name: string
  phone: string
  email?: string
  address?: string
  notes?: string
  is_favorite: boolean
  is_saved: boolean
  created_at: string
  updated_at: string
}

export interface ContactSummary {
  total_contact: number
  total_dormant: number
  total_active: number
  total_plain: number
  dormant_days: number
  active_days: number
}

export interface Lead {
  id: string
  lead_no: string
  customer_id: string
  customer?: Customer
  sales_id?: string
  sales?: User
  source_id?: number
  source?: MasterSource
  input_id?: number
  input?: MasterInput
  quality_id?: number
  quality?: MasterQuality
  status_id?: number
  status?: MasterStatus
  result_id?: number
  result?: MasterResult
  product_id?: number
  product?: Product
  group_id?: number
  group?: ProductGroup
  price?: number
  pax?: number
  total_price?: number
  date_received?: string
  deal_date?: string
  follow_up_date?: string
  last_chat_at?: string
  last_read_at?: string
  notes?: string
  is_converted: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface ChatInboxItem extends Lead {
  last_message: Chat | null
  unread_count: number
}

export interface ChatSummary {
  total: number
  need_response: number
  waiting_customer: number
  dormant: number
  selesai_hari_ini: number
  sla_buckets: {
    over_30m: number
    '15_30m': number
    '5_15m': number
    under_5m: number
  }
}

export interface LeadActivity {
  id: string
  lead_id: string
  activity: string
  notes?: string
  created_by?: string
  creator?: User
  created_at: string
}

export interface CustomerSummary {
  recent_lead?: Lead
  active_booking?: Booking
  total_bookings: number
  total_spent: number
  latest_note?: LeadActivity
}

export interface Chat {
  id: string
  lead_id: string
  customer_id: string
  direction: 'in' | 'out'
  from_phone?: string
  body: string
  chat_timestamp: string
  provider_message_id?: string
  created_at: string
}

export interface Settings {
  dormant_hours: string
  close_hours: string
  whatsapp_provider: string
  contact_dormant_days?: string
  contact_active_days?: string
}

export interface LeadsSummaryStat {
  count: number
  pax: number
  total_price: number
}

export interface LeadsSummary {
  total_leads: number
  total_cold: number
  total_warm: number
  hot: LeadsSummaryStat
  total_convert: number
  loss: LeadsSummaryStat
  close: { count: number }
}

export interface ReportSalesRow {
  sales_id: string
  full_name: string
  avatar?: string
  leads_count: number
  closing_count: number
  total_pax: number
  revenue: number
}

export interface Booking {
  id: string
  booking_no: string
  customer_id: string
  customer?: Customer
  lead_id?: string
  sales_id?: string
  sales?: User
  product_id?: number
  product?: Product
  group_id?: number
  group?: ProductGroup
  source_id?: number
  source?: MasterSource
  countries?: Country[]
  lead?: Lead
  booking_date: string
  departure_date?: string
  pax: number
  price_per_pax: number
  total_price: number
  total_paid: number
  remaining_payment: number
  booking_status: string
  notes?: string
  created_at: string
}

export interface BookingPayment {
  id: number
  booking_id: string
  payment_no: number
  payment_date?: string
  amount: number
  payment_method?: string
  reference_no?: string
  notes?: string
  created_at: string
}

export interface DashboardSummary {
  penjualan: number
  leads: number
  pemesan: number
  peserta: number
  cr_pemesan: number
  cr_peserta: number
}

export interface LeaderboardRow {
  sales_id: string
  full_name: string
  avatar?: string
  total_pax: number
  revenue: number
}

export interface TopProductRow {
  product_name: string
  flag_url: string
  country_name: string
  total_pax: number
  revenue: number
}

export interface ChartRow {
  day: number
  leads: number
  closing: number
  revenue: number
  total_price: number
  ad_spend: number
  ads_conversations: number
}

export interface BookingSummary {
  total_booking: number
  total_pax: number
  total_revenue: number
  pending_payment: number
  completed: number
  upcoming_30_days: number
}
