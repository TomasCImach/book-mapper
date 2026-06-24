import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const DEFAULT_SITE_URL = 'https://www.mappedfiction.com'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const defaultDistDir = path.join(rootDir, 'dist')
const defaultBookDir = path.join(rootDir, 'src', 'data', 'books')
const defaultLastmod = new Date().toISOString().slice(0, 10)

export const bookFiles = [
  'journey-to-the-center-of-the-earth.json',
  'around-the-world-in-eighty-days.json',
  'twenty-thousand-leagues-under-the-sea.json',
  'moby-dick.json',
  'forrest-gump.json',
  'pride-and-prejudice.json',
  'a-room-with-a-view.json',
  'alices-adventures-in-wonderland.json',
  'frankenstein.json',
  'crime-and-punishment.json',
  'the-count-of-monte-cristo.json',
  'the-adventures-of-sherlock-holmes.json',
  'middlemarch.json',
  'memoirs-of-the-court-of-queen-elizabeth.json',
  'little-women.json',
  'my-life-volume-1.json',
  'dracula.json',
  'genesis-abraham.json',
  'genesis-jacob.json',
  'genesis-joseph.json',
  'exodus-to-promised-land.json',
]

export function normalizeSiteUrl(siteUrl = process.env.SITE_URL ?? DEFAULT_SITE_URL) {
  return siteUrl.replace(/\/+$/, '')
}

export function readBooks(bookDir = defaultBookDir) {
  return bookFiles.map((file) =>
    JSON.parse(fs.readFileSync(path.join(bookDir, file), 'utf8')),
  )
}

export function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function bookPath(book) {
  return `/titles/${book.id}/`
}

export function routePath(book) {
  return `/titles/${book.id}/route/`
}

export function chapterPath(book, chapterNumber) {
  return `/titles/${book.id}/chapter-${chapterNumber}/`
}

export function authorPath(author) {
  return `/authors/${slugify(author)}/`
}

export function locationPath(locationId) {
  return `/locations/${locationId}/`
}

export function collectLocationIds(books) {
  return [
    ...new Set(
      books.flatMap((book) => book.waypoints.map((waypoint) => waypoint.id)),
    ),
  ].sort((a, b) => a.localeCompare(b))
}

export function getSitemapRoutes(books = readBooks()) {
  const authorRoutes = [...new Set(books.map((book) => authorPath(book.author)))].sort(
    (a, b) => a.localeCompare(b),
  )
  const locationRoutes = collectLocationIds(books).map(locationPath)
  const bookRoutes = books.flatMap((book) => [
    bookPath(book),
    routePath(book),
    ...book.chapters.map((chapter) => chapterPath(book, chapter.number)),
  ])

  return assertUniqueRoutes([
    '/',
    '/titles/',
    '/authors/',
    '/locations/',
    ...bookRoutes,
    ...authorRoutes,
    ...locationRoutes,
  ])
}

export function getSitemapRouteGroups(routes) {
  const canonicalRoutes = assertUniqueRoutes(routes)

  return [
    {
      fileName: 'sitemap-titles.xml',
      label: 'titles',
      routes: canonicalRoutes.filter(isTitleRoute),
    },
    {
      fileName: 'sitemap-support.xml',
      label: 'support',
      routes: canonicalRoutes.filter((route) => !isTitleRoute(route)),
    },
  ].filter((group) => group.routes.length > 0)
}

export function isTitleRoute(route) {
  return route === '/titles/' || route.startsWith('/titles/')
}

export function routePriority(route) {
  if (route === '/' || route === '/titles/') {
    return '1.0'
  }

  if (route.startsWith('/titles/')) {
    if (/\/chapter-\d+\/$/.test(route)) {
      return '0.8'
    }

    return '0.9'
  }

  if (route === '/authors/' || route === '/locations/') {
    return '0.6'
  }

  if (route.startsWith('/authors/')) {
    return '0.5'
  }

  if (route.startsWith('/locations/')) {
    return '0.4'
  }

  return '0.5'
}

export function assertUniqueRoutes(routes) {
  const seen = new Set()
  const duplicates = new Set()

  for (const route of routes) {
    if (seen.has(route)) {
      duplicates.add(route)
    }

    seen.add(route)
  }

  if (duplicates.size > 0) {
    throw new Error(`Duplicate sitemap routes: ${[...duplicates].join(', ')}`)
  }

  return routes
}

export function renderSitemap(routes, options = {}) {
  const siteUrl = normalizeSiteUrl(options.siteUrl)
  const lastmod = options.lastmod ?? defaultLastmod
  const priorityForRoute = options.priorityForRoute ?? routePriority
  const urls = assertUniqueRoutes(routes)
    .map((route) => {
      const priority = priorityForRoute(route)

      return `
  <url>
    <loc>${escapeXml(`${siteUrl}${route}`)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    ${priority ? `<priority>${escapeXml(priority)}</priority>` : ''}
  </url>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>
`
}

export function renderSitemapIndex(groups, options = {}) {
  const siteUrl = normalizeSiteUrl(options.siteUrl)
  const lastmod = options.lastmod ?? defaultLastmod
  const sitemaps = groups
    .map(
      (group) => `
  <sitemap>
    <loc>${escapeXml(`${siteUrl}/${group.fileName}`)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
  </sitemap>`,
    )
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemaps}
</sitemapindex>
`
}

export function renderRobots(options = {}) {
  const siteUrl = normalizeSiteUrl(options.siteUrl)

  return `User-agent: *
Allow: /
Sitemap: ${siteUrl}/sitemap.xml
`
}

export function writeSitemapFiles(options = {}) {
  const outDir = options.outDir ?? process.env.SITEMAP_OUT_DIR ?? defaultDistDir
  const siteUrl = normalizeSiteUrl(options.siteUrl)
  const lastmod = options.lastmod ?? process.env.SITEMAP_LASTMOD ?? defaultLastmod
  const routes = options.routes ?? getSitemapRoutes()
  const groups = getSitemapRouteGroups(routes)
  const sitemapIndexPath = path.join(outDir, 'sitemap.xml')

  fs.mkdirSync(outDir, { recursive: true })
  for (const group of groups) {
    fs.writeFileSync(
      path.join(outDir, group.fileName),
      renderSitemap(group.routes, { siteUrl, lastmod }),
    )
  }

  fs.writeFileSync(sitemapIndexPath, renderSitemapIndex(groups, { siteUrl, lastmod }))
  fs.writeFileSync(path.join(outDir, 'robots.txt'), renderRobots({ siteUrl }))

  return {
    groups,
    outDir,
    routeCount: routes.length,
    robotsPath: path.join(outDir, 'robots.txt'),
    sitemapPath: sitemapIndexPath,
  }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function isCliEntrypoint() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
}

if (isCliEntrypoint()) {
  const result = writeSitemapFiles()

  console.log(
    `Wrote ${result.routeCount} sitemap URLs across ${result.groups.length} sitemap files to ${result.sitemapPath}`,
  )
  console.log(`Wrote robots.txt to ${result.robotsPath}`)
}
