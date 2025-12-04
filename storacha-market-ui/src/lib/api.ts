import axios from 'axios'

// Get backend URL with fallback
// NEXT_PUBLIC_API_BASE should be http://localhost:4000/api (with /api)
export const getBackendUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://sol-route-775i.vercel.app'
  // Remove trailing slash if present
  return url.replace(/\/$/, '')
}

// Axios instance - uses NEXT_PUBLIC_API_BASE directly (which includes /api)
// So axios calls should NOT include /api prefix
// Example: api.get('/listings') -> http://localhost:4000/api/listings
export const api = axios.create({
  baseURL: getBackendUrl(),
  timeout: 30000
})

// Helper to build full URL for fetch calls
// If baseUrl ends with /api and path starts with /api/, remove /api from path
// This handles both cases: baseUrl with /api and without /api
export const buildApiUrl = (path: string) => {
  const baseUrl = getBackendUrl()
  
  // If baseUrl ends with /api and path starts with /api/, remove /api from path
  if (baseUrl.endsWith('/api') && path.startsWith('/api/')) {
    return baseUrl + path.slice(4) // Remove /api from path
  }
  
  // Otherwise just append the path
  return baseUrl + (path.startsWith('/') ? path : '/' + path)
}
