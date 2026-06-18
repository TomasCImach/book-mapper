import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

const ADSENSE_CLIENT_ID_PREFIX = 'ca-pub-'
const ADSENSE_META_ID = 'google-adsense-account-meta'
const ADSENSE_SCRIPT_ID = 'google-adsense-auto-ads-script'
const ADSENSE_SCRIPT_BASE_URL =
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js'
const ADSENSE_SELLER_ACCOUNT_ID = 'f08c47fec0942fa0'

function normalizeAdsenseClientId(value: string | undefined) {
  const clientId = value?.trim()

  return clientId?.startsWith(ADSENSE_CLIENT_ID_PREFIX) ? clientId : ''
}

function getAdsensePublisherId(clientId: string) {
  return clientId.replace(/^ca-/, '')
}

function renderAdsTxt(clientId: string) {
  return `google.com, ${getAdsensePublisherId(clientId)}, DIRECT, ${ADSENSE_SELLER_ACCOUNT_ID}
`
}

function adsensePlugin(clientId: string): Plugin {
  return {
    name: 'mapped-fiction-adsense',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: {
            id: ADSENSE_META_ID,
            name: 'google-adsense-account',
            content: clientId,
          },
          injectTo: 'head',
        },
        {
          tag: 'script',
          attrs: {
            id: ADSENSE_SCRIPT_ID,
            async: true,
            crossorigin: 'anonymous',
            src: `${ADSENSE_SCRIPT_BASE_URL}?client=${encodeURIComponent(clientId)}`,
          },
          injectTo: 'head',
        },
      ]
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'ads.txt',
        source: renderAdsTxt(clientId),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const adsenseClientId = normalizeAdsenseClientId(env.VITE_ADSENSE_CLIENT_ID)

  return {
    plugins: adsenseClientId
      ? [react(), adsensePlugin(adsenseClientId)]
      : [react()],
  }
})
