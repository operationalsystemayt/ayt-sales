export interface User {
  id: string
  full_name: string
  email: string
  phone?: string
  role: 'admin' | 'sales'
  avatar?: string
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
  country_id?: number
  country?: Country
  duration_days: number
  price_per_pax: number
  is_active: boolean
}

export interface Customer {
  id: string
  full_name: string
  phone: string
  email?: string
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
  is_converted: boolean
  created_at: string
  updated_at: string
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
}

export interface BookingSummary {
  total_booking: number
  total_pax: number
  total_revenue: number
  pending_payment: number
  completed: number
  upcoming_30_days: number
}
