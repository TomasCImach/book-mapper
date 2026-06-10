# Narrative Route Data Guide

## Project Files

- Data schema: `src/data/book-map.schema.json`
- Dataset directory: `src/data/books/`
- Registry: `src/data/journey.ts`
- Geometry helpers: `src/lib/geo.ts`
- Chapter/scene fact analysis: `src/lib/routeAnalysis.ts`
- UI consumers: `src/components/MapControls.tsx`, `src/components/RouteContextPanel.tsx`, `src/components/BookMapScene.tsx`
- Public page generators: `scripts/prerender-seo.mjs`, `scripts/sitemap.mjs`

## JSON Contract

Top-level fields:

- `schemaVersion`: integer, currently `1`.
- `id`: stable kebab-case slug used in URLs and the book selector.
- `title`, `author`, `source`.
- `chapters`: ordered source units. For movies, use scenes/sequences as chapter-equivalent units.
- `media`: object keyed by medium ID. Each medium has `label` and `color`.
- `waypoints`: named anchors with `id`, `name`, `chapter`, `position`, `confidence`, optional `notes`.
- `paths`: modeled route segments. Each item has `id`, `title`, `medium`, `start`, `end`, `chapterStart`, `chapterEnd`, `distanceSource`, `confidence`, `notes`, `sourceRefs`, optional `distanceKm`, optional `points`.
- `chapterFacts`: one entry per chapter/scene with movement, prose facts, segment IDs, confidence, and source refs.

Allowed confidence values: `confirmed`, `geocoded`, `textual`, `estimated`, `fictional`, `book`.

Allowed distance sources: `geodesic`, `book`, `estimated`, `cinematic`.

Allowed movement values: `stationary`, `surface`, `sea`, `ascent`, `descent`, `wrong-turn`, `subterranean`, `raft`, `volcanic`, `return`.

## Geometry

Positions use:

```json
{ "lat": 64.8, "lon": -23.8, "depthKm": 3.2 }
```

`depthKm` is positive downward. Surface points omit it or set it to `0`. The renderer converts lat/lon/depth to a 3D globe and can exaggerate depth; the data should remain in real kilometers.

Use `points` for any route that needs shape:

- Sea routes should include offshore control points so interpolated paths do not cut across continents.
- Underground paths should include lateral and depth changes: descending shafts, sloping galleries, near-horizontal wrong turns, rises, and returns.
- Rail, road, and river routes can use intermediate real cities, ports, passes, canals, or bends when a great-circle curve would be misleading.
- Cinematic routes can use scene geography and screen direction, but label uncertainty as `cinematic` or `estimated`.

The app computes distance from start, `points`, and end when `distanceKm` is omitted. Add `distanceKm` when the source states a distance or when the modeled control points are schematic and would distort the intended total.

Useful conversions already used by the app:

- Mile: `1.609344 km`
- League: `4.828032 km`
- Earth radius: `6371 km`

## Accuracy Rules

- Prefer explicit source distances, then measured/geodesic routes, then cautious estimates.
- Attach `sourceRefs` to every path and every chapter fact. For books, link to the source chapter or source page. For movies, use a timestamped note, screenplay section, subtitle line, official synopsis, or user-provided evidence.
- Keep source quotes short or paraphrased. Store the evidence label, not long copied text.
- Use `confidence: confirmed` for exact named real places; `geocoded` for real places inferred from names; `textual` for source-supported but not exact locations; `book` for internally stated fiction geography; `fictional` for invented places; `estimated` for agent-estimated positions.
- Do not overclaim exactness for fictional interiors, underwater routes, montages, or off-screen travel.
- Use `notes` to explain why a path is schematic, why a distance is overridden, and what the source says.

## Dataset Construction Pattern

1. List all chapters/scenes first, preserving source order and titles.
2. Create media keys before paths. Use specific media when it matters: `rail`, `steamer`, `submarine`, `foot`, `raft`, `wrong-turn`, `volcanic`, `carriage`, `airship`, etc.
3. Create waypoints only for meaningful anchors, not every control point. Use `points` for unlabeled curve shaping.
4. Split route segments by narrative meaning, not only by distance:
   - change of medium
   - change of source confidence
   - arrival at a named location
   - branch or wrong turn
   - major depth or altitude transition
   - chapter/scene span that users will expect to inspect
5. Add `chapterFacts` after paths so `segmentIds` can point to real path IDs. Stationary chapters can have an empty `segmentIds` array but still need location, delta, and slope facts.

## Example Path

```json
{
  "id": "fork-eastern-blind-alley",
  "title": "Mistaken eastern gallery",
  "medium": "wrong-turn",
  "start": { "waypointId": "eastern-western-gallery-fork" },
  "end": { "waypointId": "eastern-blind-alley" },
  "chapterStart": 19,
  "chapterEnd": 20,
  "distanceKm": 58,
  "distanceSource": "book",
  "confidence": "book",
  "notes": "The tunnel is modeled as a near-horizontal wrong turn rather than another vertical descent.",
  "sourceRefs": [
    {
      "chapter": 19,
      "label": "Eastern tunnel chosen at random",
      "url": "https://www.gutenberg.org/cache/epub/3748/pg3748-images.html"
    }
  ],
  "points": [
    { "lat": 64.76, "lon": -23.82, "depthKm": 4.8 },
    { "lat": 64.72, "lon": -23.7, "depthKm": 4.7 }
  ]
}
```

## Integration Checklist

- File name: `src/data/books/<id>.json`.
- Top-level `id` matches the slug and URL route.
- Add import in `src/data/journey.ts`.
- Append imported JSON to `availableBooks`.
- Add the JSON filename to `bookFiles` in `scripts/prerender-seo.mjs` and `scripts/sitemap.mjs`.
- Confirm every path medium exists in `media`.
- Confirm every path endpoint exists in `waypoints`.
- Confirm every path and chapter fact has at least one source ref.
- Run the audit script, `npm run test`, `npm run lint`, and `npm run build`.
- After build, verify the generated book, route, and chapter pages under `dist/books/<id>/`.
- After build, verify `dist/sitemap.xml` includes the new book, route, chapter, author, and location URLs.
- After build, verify `dist/robots.txt` references the expected production sitemap URL.
