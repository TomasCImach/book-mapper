const ADSENSE_CLIENT_ID_PREFIX = 'ca-pub-'
const ADSENSE_META_ID = 'google-adsense-account-meta'
const ADSENSE_SCRIPT_ID = 'google-adsense-auto-ads-script'
const ADSENSE_SCRIPT_BASE_URL =
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'

function readAdsenseClientId() {
  const clientId = import.meta.env.VITE_ADSENSE_CLIENT_ID?.trim()

  return clientId?.startsWith(ADSENSE_CLIENT_ID_PREFIX) ? clientId : ''
}

function ensureAdsenseAccountMeta(clientId: string) {
  if (document.getElementById(ADSENSE_META_ID)) {
    return
  }

  const meta = document.createElement('meta')
  meta.id = ADSENSE_META_ID
  meta.name = 'google-adsense-account'
  meta.content = clientId
  document.head.append(meta)
}

export function initializeAdsenseAutoAds() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  const clientId = readAdsenseClientId()

  if (!clientId) {
    return
  }

  ensureAdsenseAccountMeta(clientId)

  if (document.getElementById(ADSENSE_SCRIPT_ID)) {
    return
  }

  const script = document.createElement('script')
  script.id = ADSENSE_SCRIPT_ID
  script.async = true
  script.crossOrigin = 'anonymous'
  script.src = `${ADSENSE_SCRIPT_BASE_URL}?client=${encodeURIComponent(clientId)}`
  document.head.append(script)
}
