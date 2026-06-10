import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_SITE_URL,
  collectLocationIds,
  getSitemapRoutes,
  readBooks,
  renderRobots,
  writeSitemapFiles,
} from './sitemap.mjs'

const tempDirs = []

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { force: true, recursive: true })
  }
})

describe('sitemap automation', () => {
  it('derives canonical routes from every mapped data set', () => {
    const books = readBooks()
    const routes = getSitemapRoutes(books)
    const expectedRouteCount =
      4 +
      books.reduce((total, book) => total + 2 + book.chapters.length, 0) +
      new Set(books.map((book) => book.author)).size +
      collectLocationIds(books).length

    expect(routes).toHaveLength(expectedRouteCount)
    expect(new Set(routes).size).toBe(routes.length)
    expect(routes).toContain('/')
    expect(routes).toContain('/titles/')
    expect(routes).toContain('/authors/')
    expect(routes).toContain('/locations/')
    expect(routes).toContain('/titles/twenty-thousand-leagues-under-the-sea/')
    expect(routes).toContain('/titles/twenty-thousand-leagues-under-the-sea/route/')
    expect(routes).toContain(
      '/titles/twenty-thousand-leagues-under-the-sea/chapter-13/',
    )
    expect(routes).toContain('/authors/jules-verne/')
    expect(routes).toContain('/locations/nautilus-japan/')
  })

  it('writes sitemap.xml and robots.txt for the production domain', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mappedfiction-sitemap-'))
    tempDirs.push(tempDir)

    const result = writeSitemapFiles({
      lastmod: '2026-06-09',
      outDir: tempDir,
      routes: ['/', '/titles/'],
      siteUrl: DEFAULT_SITE_URL,
    })
    const sitemap = fs.readFileSync(result.sitemapPath, 'utf8')
    const robots = fs.readFileSync(result.robotsPath, 'utf8')

    expect(result.routeCount).toBe(2)
    expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(sitemap).toContain('<loc>https://www.mappedfiction.com/</loc>')
    expect(sitemap).toContain('<loc>https://www.mappedfiction.com/titles/</loc>')
    expect(sitemap).toContain('<lastmod>2026-06-09</lastmod>')
    expect(robots).toBe(renderRobots({ siteUrl: DEFAULT_SITE_URL }))
  })
})
