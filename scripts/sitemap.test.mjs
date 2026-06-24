import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_SITE_URL,
  collectLocationIds,
  getSitemapRouteGroups,
  getSitemapRoutes,
  readBooks,
  renderRobots,
  routePriority,
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

  it('groups title URLs into their own priority sitemap', () => {
    const groups = getSitemapRouteGroups([
      '/',
      '/titles/',
      '/titles/twenty-thousand-leagues-under-the-sea/',
      '/titles/twenty-thousand-leagues-under-the-sea/chapter-13/',
      '/authors/jules-verne/',
      '/locations/nautilus-japan/',
    ])

    expect(groups.map((group) => group.fileName)).toEqual([
      'sitemap-titles.xml',
      'sitemap-support.xml',
    ])
    expect(groups[0].routes).toEqual([
      '/titles/',
      '/titles/twenty-thousand-leagues-under-the-sea/',
      '/titles/twenty-thousand-leagues-under-the-sea/chapter-13/',
    ])
    expect(routePriority('/titles/twenty-thousand-leagues-under-the-sea/')).toBe('0.9')
    expect(routePriority('/titles/twenty-thousand-leagues-under-the-sea/chapter-13/')).toBe(
      '0.8',
    )
    expect(routePriority('/locations/nautilus-japan/')).toBe('0.4')
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
    const sitemapIndex = fs.readFileSync(result.sitemapPath, 'utf8')
    const titleSitemap = fs.readFileSync(path.join(tempDir, 'sitemap-titles.xml'), 'utf8')
    const supportSitemap = fs.readFileSync(path.join(tempDir, 'sitemap-support.xml'), 'utf8')
    const robots = fs.readFileSync(result.robotsPath, 'utf8')

    expect(result.routeCount).toBe(2)
    expect(sitemapIndex).toContain(
      '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    )
    expect(sitemapIndex).toContain('<loc>https://www.mappedfiction.com/sitemap-titles.xml</loc>')
    expect(sitemapIndex).toContain('<loc>https://www.mappedfiction.com/sitemap-support.xml</loc>')
    expect(titleSitemap).toContain('<loc>https://www.mappedfiction.com/titles/</loc>')
    expect(titleSitemap).toContain('<priority>1.0</priority>')
    expect(supportSitemap).toContain('<loc>https://www.mappedfiction.com/</loc>')
    expect(supportSitemap).toContain('<priority>1.0</priority>')
    expect(sitemapIndex).toContain('<lastmod>2026-06-09</lastmod>')
    expect(robots).toBe(renderRobots({ siteUrl: DEFAULT_SITE_URL }))
  })
})
