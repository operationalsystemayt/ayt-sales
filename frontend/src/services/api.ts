import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  console.debug(`[API] → ${config.method?.toUpperCase()} ${config.url}`, config.params ?? '')
  return config
})

api.interceptors.response.use(
  (res) => {
    console.debug(`[API] ← ${res.status} ${res.config.url}`, res.data)
    return res
  },
  (err) => {
    const status = err.response?.status
    const url = err.config?.url
    console.error(`[API] ✗ ${status ?? 'ERR'} ${url}`, err.response?.data ?? err.message)
    if (status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Auth
export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password })

export const getMe = () => api.get('/auth/me')

// Users
export const getUsers = () => api.get('/users')
export const createUser = (data: object) => api.post('/users', data)
export const updateUser = (id: string, data: object) => api.put(`/users/${id}`, data)

// Master
export const getMasterSources = () => api.get('/master/sources')
export const getMasterInputs = () => api.get('/master/inputs')
export const getMasterQualities = () => api.get('/master/qualities')
export const getMasterStatuses = () => api.get('/master/statuses')
export const getMasterResults = () => api.get('/master/results')
export const getCountries = () => api.get('/countries')
export const getProducts = (all?: boolean) => api.get('/products', { params: all ? { all: '1' } : {} })
export const createProduct = (data: object) => api.post('/products', data)
export const updateProduct = (id: number, data: object) => api.put(`/products/${id}`, data)
export const deleteProduct = (id: number) => api.delete(`/products/${id}`)
export const getProductGroups = () => api.get('/product-groups')
export const createProductGroup = (data: object) => api.post('/product-groups', data)
export const updateProductGroup = (id: number, data: object) => api.put(`/product-groups/${id}`, data)
export const deleteProductGroup = (id: number) => api.delete(`/product-groups/${id}`)
export const getDepartures = (productId?: number) =>
  api.get('/departures', { params: { product_id: productId } })

// Leads
export const getLeads = (params?: object) => api.get('/leads', { params })
export const getLeadsSummary = (params?: object) => api.get('/leads/summary', { params })
export const getLead = (id: string) => api.get(`/leads/${id}`)
export const createLead = (data: object) => api.post('/leads', data)
export const updateLead = (id: string, data: object) => api.put(`/leads/${id}`, data)
export const bulkUpdateLeads = (data: object) => api.put('/leads/bulk', data)
export const deleteLead = (id: string) => api.delete(`/leads/${id}`)
export const convertLeadToBooking = (id: string, data: object) =>
  api.post(`/leads/${id}/convert`, data)
export const getLeadChats = (leadId: string) => api.get(`/leads/${leadId}/chats`)
export const createLeadChat = (leadId: string, data: { direction: 'in' | 'out'; body: string }) =>
  api.post(`/leads/${leadId}/chats`, data)
export const markChatRead = (leadId: string) => api.post(`/leads/${leadId}/chats/read`)
export const syncLeadChats = (leadId: string) => api.post(`/leads/${leadId}/chats/sync`)
export const archiveLead = (leadId: string) => api.post(`/leads/${leadId}/archive`)
export const unarchiveLead = (leadId: string) => api.post(`/leads/${leadId}/unarchive`)
export const getLeadActivities = (leadId: string) => api.get(`/leads/${leadId}/activities`)
export const createLeadActivity = (leadId: string, data: { activity: string; notes?: string }) =>
  api.post(`/leads/${leadId}/activities`, data)

// Customers / Contact
export const getCustomers = (params?: object) => api.get('/customers', { params })
export const updateCustomer = (id: string, data: object) => api.put(`/customers/${id}`, data)
export const saveCustomer = (id: string) => api.post(`/customers/${id}/save`)
export const getCustomerSummary = (id: string) => api.get(`/customers/${id}/summary`)
export const getContactSummary = () => api.get('/customers/summary')

// Chat inbox
export const getChatInbox = (params?: object) => api.get('/chats/inbox', { params })
export const getChatSummary = (params?: object) => api.get('/chats/summary', { params })

// Settings
export const getSettings = () => api.get('/settings')
export const updateSettings = (data: object) => api.put('/settings', data)

// Bookings
export const getBookings = (params?: object) => api.get('/bookings', { params })
export const getBookingSummary = (params?: object) => api.get('/bookings/summary', { params })
export const createBooking = (data: object) => api.post('/bookings', data)
export const updateBooking = (id: string, data: object) => api.put(`/bookings/${id}`, data)
export const deleteBooking = (id: string) => api.delete(`/bookings/${id}`)
export const getPayments = (bookingId: string) => api.get(`/bookings/${bookingId}/payments`)
export const addPayment = (bookingId: string, data: object) =>
  api.post(`/bookings/${bookingId}/payments`, data)
export const deletePayment = (bookingId: string, paymentId: number) =>
  api.delete(`/bookings/${bookingId}/payments/${paymentId}`)

// Dashboard
export const getDashboardSummary = (params?: object) => api.get('/dashboard/summary', { params })
export const getDashboardLeaderboard = (params?: object) => api.get('/dashboard/leaderboard', { params })
export const getDashboardTopProducts = (params?: object) => api.get('/dashboard/top-products', { params })
export const getDashboardChart = (params?: object) => api.get('/dashboard/chart', { params })
export const syncDashboardAds = (params?: object) => api.post('/dashboard/ads/sync', null, { params })
export const getTopTrips = (params?: object) => api.get('/dashboard/top-trips', { params })

// Reports
export const getReportSales = (params?: object) => api.get('/reports/sales', { params })

export default api
