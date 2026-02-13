// =============================================================================
// API CONFIGURATION - Dynamic URL resolution for backend connections
// =============================================================================

/**
 * Get the base URL for API requests.
 * Uses Next.js API proxy (/api) for client-side to avoid CORS issues.
 * Server-side uses direct connection.
 */
export function getApiBaseUrl(): string {
  // Always use /api proxy for both client and server components in Next.js App Router
  // to ensure consistency and leverage the [[...path]]/route.ts proxy logic
  return '/api'
}

/**
 * Get the WebSocket URL for portfolio price updates.
 */
export function getPortfolioWsUrl(): string {
  if (typeof window === 'undefined') {
    return 'ws://localhost:8000/portfolios/ws'
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws/portfolios/ws`
}

/**
 * Get the API docs URL.
 */
export function getApiDocsUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:8000/docs'
  }

  const hostname = window.location.hostname

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8000/docs'
  }

  return `http://${hostname}:8000/docs`
}
