---
name: add-narrative-map
description: Create or update narrative route datasets and their public crawlable surfaces for the 3D book/movie map app. Use when the user asks to add a new book, movie, story, route, journey, chapter-by-chapter map, scene-by-scene map, Project Gutenberg text, film itinerary, SEO route page, sitemap entry, or JSON dataset to the book-mapper app, especially when building accurate paths with media, waypoints, distances, source refs, and chapter/scene facts.
---

# Add Narrative Map

## Overview

Use this skill to add a new book or movie to the 3D narrative map app by creating one strict JSON dataset and wiring it into the app's interactive and crawlable surfaces. The data should carry the whole route: chapters or scenes, media, waypoints, paths, intermediate curve points, distances, notes, and source references.

## Workflow

1. Locate the app root. Prefer the current workspace when it contains `src/data/book-map.schema.json`; otherwise look for `/Users/tomas/Documents/book-mapper`.
2. Read the current schema and examples before editing:
   - `src/data/book-map.schema.json`
   - `src/data/journey.ts`
   - `scripts/prerender-seo.mjs` and `scripts/sitemap.mjs` when adding/removing books or changing public routes
   - one or more files in `src/data/books/`
   - `src/lib/geo.ts` and `src/lib/routeAnalysis.ts` when changing geometry or distances
3. Gather source material. For public-domain books, use the canonical text URL when available. For movies, use a user-provided source, official synopsis, screenplay, subtitles, or timestamped viewing notes. Browse when source details, editions, release data, or locations could be wrong or stale.
4. Build a route spine before writing JSON: ordered chapters/scenes, real or fictional anchors, travel medium, start/end points, text/cinematic evidence, explicit distances, inferred distances, and uncertainty.
5. Create `src/data/books/<slug>.json` using the schema. Each `paths[]` item is one modeled route segment; it may match one chapter/scene, span multiple units, or represent a branch such as a mistaken turn.
6. Add the JSON import to `src/data/journey.ts` and append it to `availableBooks`.
7. Register the dataset for public output. Add the JSON filename to any `bookFiles` arrays in SEO/sitemap scripts, currently `scripts/prerender-seo.mjs` and `scripts/sitemap.mjs`. Do not assume `availableBooks` alone updates generated pages.
8. Validate with the app tests and the bundled audit helper:
   - `python3 .agents/skills/add-narrative-map/scripts/audit_story_map.py src/data/books/<slug>.json`
   - `npm run test`
   - `npm run lint`
   - `npm run build` after adding/removing a book or changing routes, SEO, or public pages
9. Inspect generated public artifacts after a successful build:
   - confirm `dist/books/<slug>/index.html`, `dist/books/<slug>/route/index.html`, and representative chapter pages exist
   - confirm `dist/sitemap.xml` includes book, route, chapter, author, and location URLs for the new dataset
   - confirm `dist/robots.txt` points at the correct `Sitemap:` URL

## Modeling Rules

Read `references/route-data-guide.md` for the field contract and accuracy rules. Apply these defaults unless the user asks for a different model:

- Use decimal latitude/longitude and positive `depthKm` for below-surface positions.
- Use `points` to shape curves. Do not model underground, sea, rail, or voyage paths as straight vertical drops unless the source says they are vertical.
- Use `distanceKm` only when the text, film, or a defensible estimate should override computed geodesic distance. Otherwise omit it and let the app compute distance across endpoints and `points`.
- Mark source quality honestly with `distanceSource` and `confidence`; do not hide uncertainty.
- Add one `chapterFacts[]` entry for every chapter or movie scene unit, including stationary chapters.
- Reuse waypoint IDs for the same real-world location across books or movies when that cross-location link is intentional.
- Keep visible labels concise; put detailed caveats in `notes`, `chapterFacts`, and `sourceRefs`.
- Treat `id`, author slug, chapter numbers, and waypoint IDs as public URL inputs. Changing them can break deep links, prerendered pages, sitemap entries, and location/author aggregation.

## Movies

The current app labels the timeline as chapters. For a movie dataset, model scenes or sequences as numbered `chapters` until the UI/schema is explicitly generalized. Use titles like `Scene 1: ...` only if helpful; avoid changing shared UI language unless the user asks.

## Validation Notes

The bundled Python audit catches standalone data issues. The app tests catch project integration issues, relationship validation, route analysis, and any special route guards already present in the repository. If tests fail because of existing unrelated work, report that clearly and keep the new dataset changes scoped.
