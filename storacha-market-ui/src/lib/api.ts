import axios from 'axios'

export const getBackendUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://sol-route-775i.vercel.app'
  return url.replace(/\/$/, '')
}

export const api = axios.create({
  baseURL: getBackendUrl(),
  timeout: 30000
})

export const buildApiUrl = (path: string) => {
  const baseUrl = getBackendUrl()
  if (baseUrl.endsWith('/api') && path.startsWith('/api/')) {
    return baseUrl + path.slice(4)
  }
  return baseUrl + (path.startsWith('/') ? path : '/' + path)
}
