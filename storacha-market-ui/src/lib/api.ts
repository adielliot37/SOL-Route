import axios from 'axios'

// Get backend URL with fallback
export const getBackendUrl = () => {
  // Use NEXT_PUBLIC_API_BASE as primary (already set in Vercel)
  const url = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://sol-route-775i.vercel.app'
  // Remove trailing slash if present
  return url.replace(/\/$/, '')
}

export const api = axios.create({
  baseURL: getBackendUrl(),
  timeout: 30000
})