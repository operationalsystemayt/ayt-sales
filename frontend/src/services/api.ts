import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
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

// Master
export const getMasterSources = () => api.get('/master/sources')
export const getMasterInputs = () => api.get('/master/inputs')
export const getMasterQualities = () => api.get('/master/qualities')
export const getMasterStatuses = () => api.get('/master/statuses')
export const getMasterResults = () => api.get('/master/results')
export const getCountries = () => api.get('/countries')
export const getProductGroups = () => api.get('/product-groups')
export const getProducts = () => api.get('/products')
export const createProduct = (data: object) => api.post('/products', data)
export const getDepartures = (productId?: number) =>
  api.get('/departures', { params: { product_id: productId } })

// Leads
export const getLeads = (params?: object) => api.get('/leads', { params })
export const createLead = (data: object) => api.post('/leads', data)
export const updateLead = (id: string, data: object) => api.put(`/leads/${id}`, data)
export const bulkUpdateLeads = (data: object) => api.put('/leads/bulk', data)
export const deleteLead = (id: string) => api.delete(`/leads/${id}`)
export const convertLeadToBooking = (id: string, data: object) =>
  api.post(`/leads/${id}/convert`, data)

// Bookings
export const getBookings = (params?: object) => api.get('/bookings', { params })
export const getBookingSummary = (params?: object) => api.get('/bookings/summary', { params })
export const createBooking = (data: object) => api.post('/bookings', data)
export const updateBooking = (id: string, data: object) => api.put(`/bookings/${id}`, data)
export const deleteBooking = (id: string) => api.delete(`/bookings/${id}`)
export const getPayments = (bookingId: string) => api.get(`/bookings/${bookingId}/payments`)
export const addPayment = (bookingId: string, data: object) =>
  api.post(`/bookings/${bookingId}/payments`, data)

// Dashboard
export const getDashboardSummary = (params?: object) => api.get('/dashboard/summary', { params })
export const getDashboardLeaderboard = (params?: object) => api.get('/dashboard/leaderboard', { params })
export const getDashboardTopProducts = (params?: object) => api.get('/dashboard/top-products', { params })
export const getDashboardChart = (params?: object) => api.get('/dashboard/chart', { params })
export const getTopTrips = (params?: object) => api.get('/dashboard/top-trips', { params })

export default api
