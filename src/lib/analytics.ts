import type { PageRoute } from './pageRoutes'

type AnalyticsPrimitive = string | number | boolean | null | undefined

export type AnalyticsPayload = Record<string, AnalyticsPrimitive>

type DataLayerEvent = AnalyticsPayload & {
  event?: string
}

declare global {
  interface Window {
    dataLayer?: DataLayerEvent[]
  }
}

const GTM_SCRIPT_ID = 'google-tag-manager-script'
const GTM_ID_PREFIX = 'GTM-'

let linkTrackingInitialized = false

function readGtmId() {
  const gtmId = import.meta.env.VITE_GTM_ID?.trim()

  return gtmId?.startsWith(GTM_ID_PREFIX) ? gtmId : ''
}

function cleanPayload(payload: DataLayerEvent) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  ) as DataLayerEvent
}

function ensureDataLayer() {
  window.dataLayer = window.dataLayer ?? []

  return window.dataLayer
}

export function initializeAnalytics() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  const dataLayer = ensureDataLayer()
  const gtmId = readGtmId()

  if (!gtmId || document.getElementById(GTM_SCRIPT_ID)) {
    return
  }

  dataLayer.push({ event: 'gtm.js', 'gtm.start': Date.now() })

  const script = document.createElement('script')
  script.id = GTM_SCRIPT_ID
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`
  document.head.append(script)
}

export function trackEvent(event: string, properties: AnalyticsPayload = {}) {
  if (typeof window === 'undefined') {
    return
  }

  ensureDataLayer().push(cleanPayload({ event, ...properties }))
}

export function getRouteAnalyticsProperties(route: PageRoute): AnalyticsPayload {
  if (route.kind === 'catalog') {
    return {
      route_kind: route.kind,
      route_catalog: route.catalog,
    }
  }

  if (route.kind === 'book' || route.kind === 'book-route') {
    return {
      route_kind: route.kind,
      book_id: route.bookId,
    }
  }

  if (route.kind === 'chapter') {
    return {
      route_kind: route.kind,
      book_id: route.bookId,
      chapter_number: route.chapter,
    }
  }

  if (route.kind === 'location') {
    return {
      route_kind: route.kind,
      location_id: route.locationId,
    }
  }

  if (route.kind === 'author') {
    return {
      route_kind: route.kind,
      author_slug: route.authorSlug,
    }
  }

  return {
    route_kind: route.kind,
  }
}

export function trackPageContext(route: PageRoute) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  trackEvent('page_context_viewed', {
    page_path: window.location.pathname,
    page_title: document.title,
    ...getRouteAnalyticsProperties(route),
  })
}

export function initializeLinkTracking() {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    linkTrackingInitialized
  ) {
    return
  }

  document.addEventListener('click', handleDocumentClick, true)
  linkTrackingInitialized = true
}

function handleDocumentClick(event: MouseEvent) {
  if (!(event.target instanceof Element)) {
    return
  }

  const link = event.target.closest('a[href]') as HTMLAnchorElement | null

  if (!link) {
    return
  }

  const isSeoLink = Boolean(link.closest('.seo-document'))
  const isOutbound = link.hostname !== window.location.hostname
  const analyticsEvent = link.dataset.analyticsEvent

  if (!analyticsEvent && !isSeoLink && !isOutbound) {
    return
  }

  trackEvent(analyticsEvent ?? 'link_clicked', {
    link_text: normalizeText(link.textContent),
    link_url: stripUrlForAnalytics(link.href),
    link_domain: link.hostname,
    link_path: link.pathname,
    link_outbound: isOutbound,
    link_location: getLinkLocation(link),
  })
}

function normalizeText(value: string | null) {
  const text = value?.replace(/\s+/g, ' ').trim()

  return text ? text.slice(0, 120) : 'unlabeled_link'
}

function stripUrlForAnalytics(value: string) {
  try {
    const url = new URL(value)

    return `${url.origin}${url.pathname}`
  } catch {
    return value
  }
}

function getLinkLocation(link: HTMLAnchorElement) {
  const explicitLocation = link.closest('[data-analytics-location]') as HTMLElement | null

  if (explicitLocation?.dataset.analyticsLocation) {
    return explicitLocation.dataset.analyticsLocation
  }

  if (link.closest('.seo-document')) {
    return 'seo_document'
  }

  if (link.closest('.source-list')) {
    return 'route_details_sources'
  }

  if (link.closest('.context-panel')) {
    return 'context_panel'
  }

  if (link.closest('.app-header')) {
    return 'app_header'
  }

  if (link.closest('.book-selector')) {
    return 'book_selector'
  }

  return 'document'
}
