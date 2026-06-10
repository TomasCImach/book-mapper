import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const bookDir = path.join(rootDir, 'src', 'data', 'books')
const siteUrl = (process.env.SITE_URL ?? 'https://www.mappedfiction.com').replace(/\/+$/, '')

const bookFiles = [
  'journey-to-the-center-of-the-earth.json',
  'around-the-world-in-eighty-days.json',
  'twenty-thousand-leagues-under-the-sea.json',
  'moby-dick.json',
]

const books = bookFiles.map((file) =>
  JSON.parse(fs.readFileSync(path.join(bookDir, file), 'utf8')),
)
const models = books.map(createModel)
const template = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')

const pages = [
  homePage(models),
  booksIndexPage(models),
  authorsIndexPage(models),
  locationsIndexPage(models),
  ...models.flatMap((model) => [
    bookPage(model),
    routePage(model),
    ...model.book.chapters.map((chapter) => chapterPage(model, chapter.number)),
  ]),
  ...authorPages(models),
  ...locationPages(models),
]

for (const page of pages) {
  writePage(page)
}

console.log(`Prerendered ${pages.length} SEO pages for ${siteUrl}`)

function createModel(book) {
  const waypointById = Object.fromEntries(
    book.waypoints.map((waypoint) => [waypoint.id, waypoint]),
  )
  const chapterByNumber = Object.fromEntries(
    book.chapters.map((chapter) => [chapter.number, chapter]),
  )
  const mediumLabels = Object.fromEntries(
    Object.entries(book.media).map(([key, value]) => [key, value.label]),
  )
  const routeSegments = book.paths.map((route) => ({
    ...route,
    from: route.start.waypointId,
    to: route.end.waypointId,
    path: route.points ?? [],
  }))

  return {
    book,
    waypointById,
    chapterByNumber,
    mediumLabels,
    routeSegments,
  }
}

function homePage(activeModels) {
  const totalChapters = activeModels.reduce(
    (total, model) => total + model.book.chapters.length,
    0,
  )
  const totalSegments = activeModels.reduce(
    (total, model) => total + model.routeSegments.length,
    0,
  )
  const totalDistance = activeModels.reduce(
    (total, model) => total + getCumulativeDistanceKm(model),
    0,
  )
  const cards = activeModels
    .map((model) => {
      const first = model.routeSegments[0]
      const last = model.routeSegments.at(-1)

      return `
        <article class="seo-card">
          <h3><a href="${bookPath(model.book)}">${escapeHtml(model.book.title)}</a></h3>
          <p>${escapeHtml(model.book.author)}. Route from ${escapeHtml(waypointName(model, first.from))} to ${escapeHtml(waypointName(model, last.to))}, with ${model.routeSegments.length} mapped route segments.</p>
        </article>`
    })
    .join('')

  return {
    route: '/',
    title: 'Mapped Fiction - Interactive 3D Literary Route Atlas',
    description:
      'Explore public-domain books as interactive 3D route maps with chapter-by-chapter distances, travel media, coordinates, and source notes.',
    body: `
      ${breadcrumb([{ label: 'Home', href: '/' }])}
      <p class="seo-kicker">Interactive literary atlas</p>
      <h1>Mapped Fiction turns classic novels into chapter-by-chapter 3D route maps.</h1>
      <p>Mapped Fiction builds accurate, source-linked route maps from public-domain fiction. Each mapped book records the journey as a sequence of paths with start and end points, travel media, distances, chapter facts, confidence notes, and curve points for the 3D globe.</p>
      <div class="seo-summary-grid">
        ${statCard('Books mapped', String(activeModels.length))}
        ${statCard('Chapter pages', String(totalChapters))}
        ${statCard('Route segments', String(totalSegments))}
        ${statCard('Mapped distance', formatDistance(totalDistance))}
      </div>
      <h2>Mapped books</h2>
      <p><a href="/books/">Browse every mapped book</a>, <a href="/authors/">author page</a>, or <a href="/locations/">literary map location</a>.</p>
      <div class="seo-card-grid">${cards}</div>
      <h2>How the maps are built</h2>
      <p>The route data separates book evidence from geographic estimates. Confirmed locations, textual coordinates, inferred route bends, fictional underground or submarine sections, and explicit book distances are labeled so readers can see where the map is exact and where it is interpretive.</p>
      <ul>
        <li>Book pages summarize the complete journey and link to every chapter map.</li>
        <li>Route pages list every path segment with distance, transport medium, confidence, and source links.</li>
        <li>Chapter pages explain what changes in that chapter: location, distance, depth, slope, and route notes.</li>
        <li>Location pages collect coordinates, appearances, and route context across the atlas.</li>
      </ul>`,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Mapped Fiction',
        url: siteUrl,
        logo: `${siteUrl}/mappedfiction-logo.svg`,
        description:
          'Interactive 3D literary route maps built from chapter-level book data.',
      },
    ],
  }
}

function booksIndexPage(activeModels) {
  const rows = activeModels
    .map((model) => {
      const { book } = model
      const first = model.routeSegments[0]
      const last = model.routeSegments.at(-1)

      return `
        <tr>
          <td><a href="${bookPath(book)}">${escapeHtml(book.title)}</a></td>
          <td><a href="${authorPath(book.author)}">${escapeHtml(book.author)}</a></td>
          <td>${book.chapters.length}</td>
          <td>${model.routeSegments.length}</td>
          <td>${formatDistance(getCumulativeDistanceKm(model))}</td>
          <td>${escapeHtml(waypointName(model, first.from))} to ${escapeHtml(waypointName(model, last.to))}</td>
          <td><a class="seo-action-secondary" href="${bookPath(book)}">Open map</a></td>
        </tr>`
    })
    .join('')
  const cards = activeModels
    .map((model) => {
      const { book } = model

      return `
        <article class="seo-card">
          <h3><a href="${bookPath(book)}">${escapeHtml(book.title)}</a></h3>
          <p>${escapeHtml(book.author)}. Includes <a href="${routePath(book)}">complete route table</a> and ${book.chapters.length} chapter map pages.</p>
          <div class="seo-actions">
            <a class="seo-action" href="${bookPath(book)}">Open map</a>
            <a class="seo-action-secondary" href="${routePath(book)}">Route table</a>
          </div>
        </article>`
    })
    .join('')

  return {
    route: '/books/',
    title: 'Mapped Books - 3D Literary Route Maps | Mapped Fiction',
    description:
      'Browse every classic book mapped in Mapped Fiction, with route tables, chapter maps, distances, transport media, and source notes.',
    body: `
      ${breadcrumb([
        { label: 'Home', href: '/' },
        { label: 'Books', href: '/books/' },
      ])}
      <p class="seo-kicker">Book catalog</p>
      <h1>Mapped books with 3D literary routes</h1>
      <p>This catalog lists every book currently modeled in Mapped Fiction. Each book has a crawlable overview, complete route table, chapter-by-chapter pages, source references, and an interactive 3D map state.</p>
      <div class="seo-summary-grid">
        ${statCard('Books', String(activeModels.length))}
        ${statCard('Chapter pages', String(activeModels.reduce((total, model) => total + model.book.chapters.length, 0)))}
        ${statCard('Route segments', String(activeModels.reduce((total, model) => total + model.routeSegments.length, 0)))}
        ${statCard('Mapped distance', formatDistance(activeModels.reduce((total, model) => total + getCumulativeDistanceKm(model), 0)))}
      </div>
      <div class="seo-card-grid">${cards}</div>
      <h2>Book map index</h2>
      <div class="seo-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Book</th>
              <th>Author</th>
              <th>Chapters</th>
              <th>Segments</th>
              <th>Mapped distance</th>
              <th>Route span</th>
              <th>Map</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`,
    jsonLd: [
      webPageJson('/books/', 'Mapped books', 'Classic literary route maps'),
      breadcrumbJson([
        { label: 'Home', href: '/' },
        { label: 'Books', href: '/books/' },
      ]),
      itemListJson(
        activeModels.map((model) => ({
          name: model.book.title,
          href: bookPath(model.book),
        })),
      ),
    ],
  }
}

function authorsIndexPage(activeModels) {
  const groups = getAuthorGroups(activeModels)
  const cards = groups
    .map(({ author, authorModels }) => {
      const mappedDistance = authorModels.reduce(
        (total, model) => total + getCumulativeDistanceKm(model),
        0,
      )

      return `
        <article class="seo-card">
          <h3><a href="${authorPath(author)}">${escapeHtml(author)}</a></h3>
          <p>${authorModels.length} mapped book${authorModels.length === 1 ? '' : 's'}, ${formatDistance(mappedDistance)}, and ${authorModels.reduce((total, model) => total + model.routeSegments.length, 0)} route segments.</p>
          <div class="seo-actions">
            <a class="seo-action" href="${authorPath(author)}">View books</a>
          </div>
        </article>`
    })
    .join('')
  const rows = groups
    .map(({ author, authorModels }) => {
      const books = authorModels
        .map((model) => `<a href="${bookPath(model.book)}">${escapeHtml(model.book.title)}</a>`)
        .join('<br />')

      return `
        <tr>
          <td><a href="${authorPath(author)}">${escapeHtml(author)}</a></td>
          <td>${books}</td>
          <td>${authorModels.reduce((total, model) => total + model.book.chapters.length, 0)}</td>
          <td>${authorModels.reduce((total, model) => total + model.routeSegments.length, 0)}</td>
        </tr>`
    })
    .join('')

  return {
    route: '/authors/',
    title: 'Authors with Mapped Literary Routes | Mapped Fiction',
    description:
      'Browse authors with interactive 3D literary maps, mapped books, chapter routes, source notes, and route distances.',
    body: `
      ${breadcrumb([
        { label: 'Home', href: '/' },
        { label: 'Authors', href: '/authors/' },
      ])}
      <p class="seo-kicker">Author catalog</p>
      <h1>Authors with mapped literary routes</h1>
      <p>This author index groups the books in Mapped Fiction by writer. Author pages collect every mapped work, then link into book overviews, full route tables, and chapter map pages.</p>
      <div class="seo-summary-grid">
        ${statCard('Authors', String(groups.length))}
        ${statCard('Books', String(activeModels.length))}
        ${statCard('Route segments', String(activeModels.reduce((total, model) => total + model.routeSegments.length, 0)))}
        ${statCard('Locations', String(collectLocations(activeModels).length))}
      </div>
      <div class="seo-card-grid">${cards}</div>
      <h2>Author map index</h2>
      <div class="seo-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Author</th>
              <th>Mapped books</th>
              <th>Chapter pages</th>
              <th>Route segments</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`,
    jsonLd: [
      webPageJson('/authors/', 'Authors with mapped literary routes', 'Literary route authors'),
      breadcrumbJson([
        { label: 'Home', href: '/' },
        { label: 'Authors', href: '/authors/' },
      ]),
      itemListJson(groups.map(({ author }) => ({ name: author, href: authorPath(author) }))),
    ],
  }
}

function locationsIndexPage(activeModels) {
  const locations = collectLocations(activeModels)
  const rows = locations
    .map((location) => {
      const books = [
        ...new Set(location.appearances.map(({ model }) => model.book.title)),
      ]
        .map((title) => escapeHtml(title))
        .join('<br />')

      return `
        <tr>
          <td><a href="${locationPath(location.id)}">${escapeHtml(location.name)}</a></td>
          <td>${formatCoordinate(location.position.lat, 'lat')}</td>
          <td>${formatCoordinate(location.position.lon, 'lon')}</td>
          <td>${location.position.depthKm ? `${location.position.depthKm} km` : 'surface'}</td>
          <td>${books}</td>
          <td><a class="seo-action-secondary" href="${locationPath(location.id)}">Open map</a></td>
        </tr>`
    })
    .join('')
  const locationCards = locations
    .slice(0, 9)
    .map(
      (location) => `
        <article class="seo-card">
          <h3><a href="${locationPath(location.id)}">${escapeHtml(location.name)}</a></h3>
          <p>${formatCoordinate(location.position.lat, 'lat')}, ${formatCoordinate(location.position.lon, 'lon')}. Appears in ${location.appearances.length} mapped waypoint record${location.appearances.length === 1 ? '' : 's'}.</p>
          <div class="seo-actions">
            <a class="seo-action" href="${locationPath(location.id)}">Open map</a>
          </div>
        </article>`,
    )
    .join('')

  return {
    route: '/locations/',
    title: 'Literary Map Locations and Coordinates | Mapped Fiction',
    description:
      'Browse mapped literary locations, coordinates, route appearances, source confidence, and connected book journeys in Mapped Fiction.',
    body: `
      ${breadcrumb([
        { label: 'Home', href: '/' },
        { label: 'Locations', href: '/locations/' },
      ])}
      <p class="seo-kicker">Location catalog</p>
      <h1>Literary map locations and coordinates</h1>
      <p>This location index lists every waypoint used by the Mapped Fiction atlas. Location detail pages show coordinates, book appearances, connected route segments, map confidence, and chapter links.</p>
      <div class="seo-summary-grid">
        ${statCard('Locations', String(locations.length))}
        ${statCard('Books', String(activeModels.length))}
        ${statCard('Surface points', String(locations.filter((location) => !location.position.depthKm).length))}
        ${statCard('Depth points', String(locations.filter((location) => location.position.depthKm).length))}
      </div>
      <div class="seo-card-grid">${locationCards}</div>
      <h2>Location coordinate index</h2>
      <div class="seo-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Location</th>
              <th>Latitude</th>
              <th>Longitude</th>
              <th>Depth</th>
              <th>Mapped books</th>
              <th>Map</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`,
    jsonLd: [
      webPageJson('/locations/', 'Literary map locations and coordinates', 'Literary route locations'),
      breadcrumbJson([
        { label: 'Home', href: '/' },
        { label: 'Locations', href: '/locations/' },
      ]),
      itemListJson(
        locations.map((location) => ({
          name: location.name,
          href: locationPath(location.id),
        })),
      ),
    ],
  }
}

function bookPage(model) {
  const { book } = model
  const first = model.routeSegments[0]
  const last = model.routeSegments.at(-1)
  const firstChapter = book.chapters[0]
  const lastChapter = book.chapters.at(-1)
  const distance = getCumulativeDistanceKm(model)
  const media = [...new Set(model.routeSegments.map((segment) => segment.medium))]
    .map((medium) => model.mediumLabels[medium] ?? medium)
    .join(', ')
  const chapters = book.chapters
    .map(
      (chapter) =>
        `<li><a href="${chapterPath(book, chapter.number)}">Chapter ${chapter.number}: ${escapeHtml(chapter.title)}</a></li>`,
    )
    .join('')
  const routeHighlights = model.routeSegments
    .slice(0, 8)
    .map(
      (segment) =>
        `<li>${escapeHtml(segment.title)}: ${escapeHtml(waypointName(model, segment.from))} to ${escapeHtml(waypointName(model, segment.to))}, ${formatDistance(getSegmentDistanceKm(model, segment))} by ${escapeHtml(model.mediumLabels[segment.medium] ?? segment.medium)}.</li>`,
    )
    .join('')

  return {
    route: bookPath(book),
    title: `${book.title} Map, Route, Chapters, and Distances | Mapped Fiction`,
    description: truncate(
      `Explore the ${book.title} route map with ${book.chapters.length} chapters, ${model.routeSegments.length} travel segments, ${formatDistance(distance)} of mapped distance, and source-linked notes.`,
    ),
    body: `
      ${breadcrumb([
        { label: 'Home', href: '/' },
        { label: 'Books', href: '/books/' },
        { label: book.title, href: bookPath(book) },
      ])}
      <p class="seo-kicker">${escapeHtml(book.author)} route map</p>
      <h1>${escapeHtml(book.title)} map, route, chapters, and distances</h1>
      <p>This page collects the full Mapped Fiction route for <cite>${escapeHtml(book.title)}</cite>. The interactive map follows the journey from ${escapeHtml(waypointName(model, first.from))} to ${escapeHtml(waypointName(model, last.to))}, while the notes below make the route crawlable and easy to audit.</p>
      <div class="seo-summary-grid">
        ${statCard('Chapters', `${firstChapter.number}-${lastChapter.number}`)}
        ${statCard('Route segments', String(model.routeSegments.length))}
        ${statCard('Mapped distance', formatDistance(distance))}
        ${statCard('Travel media', String(media.split(', ').length))}
      </div>
      <h2>Route overview</h2>
      <p>The mapped route uses ${escapeHtml(media)}. Distances are either explicit in the text, geodesic between known locations, or estimated from the route notes where the book gives a fictional or approximate path.</p>
      <ul>${routeHighlights}</ul>
      <p><a href="${routePath(book)}">View the complete route table for ${escapeHtml(book.title)}</a>.</p>
      <h2>Chapter maps</h2>
      <ol>${chapters}</ol>
      <h2>Primary source</h2>
      <p>The map is grounded in <a href="${escapeAttr(book.source.url)}">${escapeHtml(book.source.label)}</a>. Source links on route and chapter pages point to the relevant book chapters where available.</p>`,
    jsonLd: [
      webPageJson(bookPath(book), `${book.title} route map`, book.title),
      breadcrumbJson([
        { label: 'Home', href: '/' },
        { label: 'Books', href: '/books/' },
        { label: book.title, href: bookPath(book) },
      ]),
      {
        '@context': 'https://schema.org',
        '@type': 'Book',
        name: book.title,
        author: {
          '@type': 'Person',
          name: book.author,
        },
        url: `${siteUrl}${bookPath(book)}`,
      },
    ],
  }
}

function routePage(model) {
  const { book } = model
  const rows = model.routeSegments
    .map((segment) => {
      const refs = sourceLinks(segment.sourceRefs)

      return `
        <tr>
          <td><a href="${chapterPath(book, segment.chapterStart)}">${escapeHtml(segment.title)}</a></td>
          <td>${escapeHtml(waypointName(model, segment.from))}</td>
          <td>${escapeHtml(waypointName(model, segment.to))}</td>
          <td>${escapeHtml(model.mediumLabels[segment.medium] ?? segment.medium)}</td>
          <td>${formatDistance(getSegmentDistanceKm(model, segment))}</td>
          <td>${escapeHtml(segment.distanceSource)} / ${escapeHtml(segment.confidence)}</td>
          <td>${refs}</td>
        </tr>`
    })
    .join('')

  return {
    route: routePath(book),
    title: `${book.title} Complete Route Table | Mapped Fiction`,
    description: truncate(
      `Complete ${book.title} route table with every mapped segment, distance, travel medium, confidence label, and source reference.`,
    ),
    body: `
      ${breadcrumb([
        { label: 'Home', href: '/' },
        { label: 'Books', href: '/books/' },
        { label: book.title, href: bookPath(book) },
        { label: 'Route', href: routePath(book) },
      ])}
      <p class="seo-kicker">Complete route table</p>
      <h1>${escapeHtml(book.title)} complete route table</h1>
      <p>This table exposes every path used by the 3D map. It is designed for readers who want to inspect distance choices, travel media, source confidence, and chapter coverage without relying on the interactive globe.</p>
      <div class="seo-summary-grid">
        ${statCard('Segments', String(model.routeSegments.length))}
        ${statCard('Mapped distance', formatDistance(getCumulativeDistanceKm(model)))}
        ${statCard('First waypoint', waypointName(model, model.routeSegments[0].from))}
        ${statCard('Final waypoint', waypointName(model, model.routeSegments.at(-1).to))}
      </div>
      <div class="seo-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Path</th>
              <th>Start</th>
              <th>End</th>
              <th>Medium</th>
              <th>Distance</th>
              <th>Evidence</th>
              <th>Sources</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`,
    jsonLd: [
      webPageJson(routePath(book), `${book.title} route table`, book.title),
      breadcrumbJson([
        { label: 'Home', href: '/' },
        { label: 'Books', href: '/books/' },
        { label: book.title, href: bookPath(book) },
        { label: 'Route', href: routePath(book) },
      ]),
    ],
  }
}

function chapterPage(model, chapterNumber) {
  const { book } = model
  const chapter = model.chapterByNumber[chapterNumber]
  const fact = book.chapterFacts.find((item) => item.chapter === chapterNumber)
  const segments = model.routeSegments.filter(
    (segment) =>
      segment.chapterStart <= chapterNumber && segment.chapterEnd >= chapterNumber,
  )
  const segmentRows = segments.length
    ? segments
        .map(
          (segment) => `
            <tr>
              <td>${escapeHtml(segment.title)}</td>
              <td>${escapeHtml(waypointName(model, segment.from))}</td>
              <td>${escapeHtml(waypointName(model, segment.to))}</td>
              <td>${escapeHtml(model.mediumLabels[segment.medium] ?? segment.medium)}</td>
              <td>${formatDistance(getSegmentDistanceKm(model, segment))}</td>
            </tr>`,
        )
        .join('')
    : `<tr><td colspan="5">No new mapped path starts in this chapter; the scene remains tied to the current route state.</td></tr>`
  const prev = model.chapterByNumber[chapterNumber - 1]
  const next = model.chapterByNumber[chapterNumber + 1]
  const facts = [
    ...(fact?.locationFacts ?? []),
    ...(fact?.deltaFacts ?? []),
    ...(fact?.slopeFacts ?? []),
  ]
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('')

  return {
    route: chapterPath(book, chapterNumber),
    title: `${book.title} Chapter ${chapterNumber} Map: ${chapter.title} | Mapped Fiction`,
    description: truncate(
      `${book.title} chapter ${chapterNumber} map notes for ${chapter.title}: ${fact?.anchor ?? 'route state'}, ${segments.length} mapped route segment${segments.length === 1 ? '' : 's'}.`,
    ),
    body: `
      ${breadcrumb([
        { label: 'Home', href: '/' },
        { label: 'Books', href: '/books/' },
        { label: book.title, href: bookPath(book) },
        { label: `Chapter ${chapterNumber}`, href: chapterPath(book, chapterNumber) },
      ])}
      <p class="seo-kicker">Chapter ${chapterNumber} route notes</p>
      <h1>${escapeHtml(book.title)} chapter ${chapterNumber} map: ${escapeHtml(chapter.title)}</h1>
      <p>The interactive map opens this page at chapter ${chapterNumber}. The static notes below explain the chapter's mapped location, distance changes, slope or depth changes, and source trail.</p>
      <div class="seo-summary-grid">
        ${statCard('Anchor', fact?.anchor ?? 'Unmapped chapter')}
        ${statCard('Movement', fact?.movement ?? 'stationary')}
        ${statCard('Segments active', String(segments.length))}
        ${statCard('Chapter distance', formatDistance(segments.reduce((total, segment) => total + getSegmentDistanceKm(model, segment), 0)))}
      </div>
      <h2>Chapter facts</h2>
      <ul>${facts}</ul>
      ${fact?.xyzEstimate ? `<p class="seo-muted">${escapeHtml(fact.xyzEstimate)}</p>` : ''}
      <h2>Mapped paths in this chapter</h2>
      <div class="seo-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Path</th>
              <th>From</th>
              <th>To</th>
              <th>Medium</th>
              <th>Distance</th>
            </tr>
          </thead>
          <tbody>${segmentRows}</tbody>
        </table>
      </div>
      <h2>Sources</h2>
      <ul class="seo-source-list">${sourceRefsForChapter(fact, segments)}</ul>
      <nav aria-label="Chapter navigation">
        ${prev ? `<a href="${chapterPath(book, prev.number)}">Previous chapter</a>` : ''}
        <a href="${bookPath(book)}">${escapeHtml(book.title)} overview</a>
        ${next ? `<a href="${chapterPath(book, next.number)}">Next chapter</a>` : ''}
      </nav>`,
    jsonLd: [
      webPageJson(chapterPath(book, chapterNumber), `${book.title} chapter ${chapterNumber} map`, book.title),
      breadcrumbJson([
        { label: 'Home', href: '/' },
        { label: 'Books', href: '/books/' },
        { label: book.title, href: bookPath(book) },
        { label: `Chapter ${chapterNumber}`, href: chapterPath(book, chapterNumber) },
      ]),
    ],
  }
}

function authorPages(activeModels) {
  return getAuthorGroups(activeModels).map(({ author, authorModels }) => {
    const cards = authorModels
      .map(
        (model) => `
          <article class="seo-card">
            <h3><a href="${bookPath(model.book)}">${escapeHtml(model.book.title)}</a></h3>
            <p>${model.book.chapters.length} chapters, ${model.routeSegments.length} mapped segments, ${formatDistance(getCumulativeDistanceKm(model))}.</p>
            <div class="seo-actions">
              <a class="seo-action" href="${bookPath(model.book)}">Open map</a>
              <a class="seo-action-secondary" href="${routePath(model.book)}">Route table</a>
            </div>
          </article>`,
      )
      .join('')
    const mappedDistance = authorModels.reduce(
      (total, model) => total + getCumulativeDistanceKm(model),
      0,
    )

    return {
      route: authorPath(author),
      title: `${author} Maps and Literary Routes | Mapped Fiction`,
      description: truncate(
        `Interactive 3D route maps for ${author}, including ${authorModels.map((model) => model.book.title).join(', ')}.`,
      ),
      body: `
        ${breadcrumb([
          { label: 'Home', href: '/' },
          { label: 'Authors', href: '/authors/' },
          { label: author, href: authorPath(author) },
        ])}
        <p class="seo-kicker">Author atlas</p>
        <h1>${escapeHtml(author)} maps and literary routes</h1>
        <p>Every mapped ${escapeHtml(author)} book is listed here with direct map and route-table actions.</p>
        <div class="seo-summary-grid">
          ${statCard('Mapped books', String(authorModels.length))}
          ${statCard('Route segments', String(authorModels.reduce((total, model) => total + model.routeSegments.length, 0)))}
          ${statCard('Chapter pages', String(authorModels.reduce((total, model) => total + model.book.chapters.length, 0)))}
          ${statCard('Mapped distance', formatDistance(mappedDistance))}
        </div>
        <div class="seo-card-grid">${cards}</div>`,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: author,
          url: `${siteUrl}${authorPath(author)}`,
        },
        breadcrumbJson([
          { label: 'Home', href: '/' },
          { label: 'Authors', href: '/authors/' },
          { label: author, href: authorPath(author) },
        ]),
      ],
    }
  })
}

function locationPages(activeModels) {
  return collectLocations(activeModels).map((location) => {
    const first = location.appearances[0]
    const segmentRows = location.appearances
      .flatMap(({ model }) =>
        model.routeSegments
          .filter((segment) => segment.from === location.id || segment.to === location.id)
          .map(
            (segment) => `
              <tr>
                <td><a href="${chapterPath(model.book, segment.chapterStart)}">${escapeHtml(model.book.title)}</a></td>
                <td>${escapeHtml(segment.title)}</td>
                <td>${escapeHtml(segment.from === location.id ? waypointName(model, segment.to) : waypointName(model, segment.from))}</td>
                <td>${formatDistance(getSegmentDistanceKm(model, segment))}</td>
              </tr>`,
          ),
      )
      .join('')
    const appearanceList = location.appearances
      .map(
        ({ model, waypoint }) =>
          `<li><a href="${chapterPath(model.book, waypoint.chapter)}">${escapeHtml(model.book.title)}, chapter ${waypoint.chapter}</a>: ${escapeHtml(waypoint.notes ?? `Mapped with ${waypoint.confidence} confidence.`)}</li>`,
      )
      .join('')

    return {
      route: locationPath(location.id),
      title: `${location.name} Literary Map Location | Mapped Fiction`,
      description: truncate(
        `${location.name} in Mapped Fiction: coordinates ${formatCoordinate(location.position.lat, 'lat')}, ${formatCoordinate(location.position.lon, 'lon')} and route appearances across mapped books.`,
      ),
      body: `
        ${breadcrumb([
          { label: 'Home', href: '/' },
          { label: 'Locations', href: '/locations/' },
          { label: location.name, href: locationPath(location.id) },
        ])}
        <p class="seo-kicker">Literary map location</p>
        <h1>${escapeHtml(location.name)} literary map location</h1>
        <p>${escapeHtml(location.name)} is a mapped waypoint in Mapped Fiction. The location is placed at ${formatCoordinate(location.position.lat, 'lat')}, ${formatCoordinate(location.position.lon, 'lon')}${location.position.depthKm ? ` with ${location.position.depthKm} km modeled depth` : ''}. Its map confidence is ${escapeHtml(location.confidence)}.</p>
        <div class="seo-summary-grid">
          ${statCard('Latitude', formatCoordinate(location.position.lat, 'lat'))}
          ${statCard('Longitude', formatCoordinate(location.position.lon, 'lon'))}
          ${statCard('Depth', location.position.depthKm ? `${location.position.depthKm} km` : 'surface')}
          ${statCard('First book', first.model.book.title)}
        </div>
        <h2>Appearances</h2>
        <ul>${appearanceList}</ul>
        <h2>Connected route segments</h2>
        <div class="seo-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Book</th>
                <th>Path</th>
                <th>Connected waypoint</th>
                <th>Distance</th>
              </tr>
            </thead>
            <tbody>${segmentRows || '<tr><td colspan="4">This waypoint is used as a route control or chapter anchor rather than a segment endpoint.</td></tr>'}</tbody>
          </table>
        </div>`,
      jsonLd: [
        webPageJson(locationPath(location.id), `${location.name} literary map location`, first.model.book.title),
        {
          '@context': 'https://schema.org',
          '@type': 'Place',
          name: location.name,
          geo: {
            '@type': 'GeoCoordinates',
            latitude: location.position.lat,
            longitude: location.position.lon,
          },
          url: `${siteUrl}${locationPath(location.id)}`,
        },
        breadcrumbJson([
          { label: 'Home', href: '/' },
          { label: 'Locations', href: '/locations/' },
          { label: location.name, href: locationPath(location.id) },
        ]),
      ],
    }
  })
}

function writePage(page) {
  const html = renderHtml(page)
  const file = outputFileForRoute(page.route)

  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, html)
}

function renderHtml(page) {
  const canonical = `${siteUrl}${page.route}`
  const isCatalogRoute = isCatalogPageRoute(page.route)
  const bodyClass = isCatalogRoute ? 'seo-catalog-page' : 'seo-map-page'
  const jsonLd = page.jsonLd
    .map((item) => {
      const json = JSON.stringify(item).replace(/</g, '\\u003c')

      return `<script type="application/ld+json">${json}</script>`
    })
    .join('\n')
  const seoHead = `
    <link rel="canonical" href="${escapeAttr(canonical)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeAttr(page.title)}" />
    <meta property="og:description" content="${escapeAttr(page.description)}" />
    <meta property="og:url" content="${escapeAttr(canonical)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(page.title)}" />
    <meta name="twitter:description" content="${escapeAttr(page.description)}" />
    ${jsonLd}`
  const article = `
    <article class="seo-document">
      <div class="seo-shell">
        <img class="seo-logo" src="/mappedfiction-logo.svg" alt="Mapped Fiction" />
        ${page.body}
      </div>
    </article>`

  return template
    .replace('<body>', `<body class="${bodyClass}">`)
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(page.title)}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${escapeAttr(page.description)}" />`,
    )
    .replace('<!--seo-head-->', seoHead)
    .replace('<!--seo-body-->', article)
}

function outputFileForRoute(route) {
  if (route === '/') {
    return path.join(distDir, 'index.html')
  }

  return path.join(distDir, route.replace(/^\/|\/$/g, ''), 'index.html')
}

function isCatalogPageRoute(route) {
  return (
    route === '/books/' ||
    route === '/authors/' ||
    route === '/locations/' ||
    route.startsWith('/authors/')
  )
}

function breadcrumb(items) {
  return `
    <nav aria-label="Breadcrumb">
      ${items
        .map((item, index) =>
          index === items.length - 1
            ? `<span>${escapeHtml(item.label)}</span>`
            : `<a href="${item.href}">${escapeHtml(item.label)}</a>`,
        )
        .join('')}
    </nav>`
}

function breadcrumbJson(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: `${siteUrl}${item.href}`,
    })),
  }
}

function itemListJson(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: `${siteUrl}${item.href}`,
    })),
  }
}

function webPageJson(route, name, about) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    url: `${siteUrl}${route}`,
    about,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Mapped Fiction',
      url: siteUrl,
      logo: `${siteUrl}/mappedfiction-logo.svg`,
    },
  }
}

function getAuthorGroups(activeModels) {
  const byAuthor = new Map()

  for (const model of activeModels) {
    const modelsForAuthor = byAuthor.get(model.book.author) ?? []
    modelsForAuthor.push(model)
    byAuthor.set(model.book.author, modelsForAuthor)
  }

  return [...byAuthor.entries()]
    .map(([author, authorModels]) => ({ author, authorModels }))
    .sort((a, b) => a.author.localeCompare(b.author))
}

function collectLocations(activeModels) {
  const locations = new Map()

  for (const model of activeModels) {
    for (const waypoint of model.book.waypoints) {
      const current = locations.get(waypoint.id) ?? {
        id: waypoint.id,
        name: waypoint.name,
        position: waypoint.position,
        confidence: waypoint.confidence,
        notes: waypoint.notes,
        appearances: [],
      }
      current.appearances.push({ model, waypoint })
      locations.set(waypoint.id, current)
    }
  }

  return [...locations.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function statCard(label, value) {
  return `
    <div class="seo-stat">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>`
}

function sourceRefsForChapter(fact, segments) {
  const refs = new Map()

  for (const ref of fact?.sourceRefs ?? []) {
    refs.set(`${ref.url}-${ref.label}`, ref)
  }
  for (const segment of segments) {
    for (const ref of segment.sourceRefs) {
      refs.set(`${ref.url}-${ref.label}`, ref)
    }
  }

  if (refs.size === 0) {
    return '<li>No source reference is attached to this chapter yet.</li>'
  }

  return [...refs.values()]
    .map(
      (ref) =>
        `<li><a href="${escapeAttr(ref.url)}">Chapter ${ref.chapter}: ${escapeHtml(ref.label)}</a></li>`,
    )
    .join('')
}

function sourceLinks(refs) {
  return refs
    .map(
      (ref) =>
        `<a href="${escapeAttr(ref.url)}">Ch. ${ref.chapter}: ${escapeHtml(ref.label)}</a>`,
    )
    .join('<br />')
}

function bookPath(book) {
  return `/books/${book.id}/`
}

function authorPath(author) {
  return `/authors/${slugify(author)}/`
}

function locationPath(locationId) {
  return `/locations/${locationId}/`
}

function routePath(book) {
  return `/books/${book.id}/route/`
}

function chapterPath(book, chapter) {
  return `/books/${book.id}/chapter-${chapter}/`
}

function waypointName(model, waypointId) {
  return model.waypointById[waypointId]?.name ?? waypointId
}

function getCumulativeDistanceKm(model) {
  return model.routeSegments.reduce(
    (total, segment) => total + getSegmentDistanceKm(model, segment),
    0,
  )
}

function getSegmentDistanceKm(model, segment) {
  if (typeof segment.distanceKm === 'number') {
    return segment.distanceKm
  }

  const positions = [
    model.waypointById[segment.from].position,
    ...(segment.path ?? []),
    model.waypointById[segment.to].position,
  ]

  return positions.reduce((total, position, index) => {
    if (index === 0) {
      return total
    }

    return total + haversineDistanceKm(positions[index - 1], position)
  }, 0)
}

function haversineDistanceKm(a, b) {
  const earthRadiusKm = 6371
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)
  const deltaLat = toRadians(b.lat - a.lat)
  const deltaLon = toRadians(b.lon - a.lon)
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180
}

function formatDistance(km) {
  if (km >= 1000) {
    return `${Math.round(km).toLocaleString()} km`
  }

  if (km >= 10) {
    return `${Math.round(km)} km`
  }

  return `${km.toFixed(1)} km`
}

function formatCoordinate(value, axis) {
  const direction =
    axis === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W'

  return `${Math.abs(value).toFixed(3)}° ${direction}`
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function truncate(value, limit = 155) {
  const plainText = value.replace(/\s+/g, ' ').trim()

  if (plainText.length <= limit) {
    return plainText
  }

  return `${plainText.slice(0, limit - 1).replace(/\s+\S*$/, '')}.`
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;')
}
