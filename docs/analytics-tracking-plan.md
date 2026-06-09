# Mapped Fiction Tracking Plan

Last updated: 2026-06-09

## Overview

- Tools: Google Tag Manager, GA4
- Site: https://www.mappedfiction.com
- Implementation: Vite loads GTM when `VITE_GTM_ID` is set at build time.
- Data policy: Do not send PII. Link tracking strips query strings and hashes before pushing URLs to `dataLayer`.

## Deployment

Set the GTM container ID before building:

```sh
VITE_GTM_ID=GTM-XXXXXXX npm run build
```

In hosted environments, add `VITE_GTM_ID` as a production build environment variable. The value is not secret, but it must be present during the Vite build because client env variables are baked into the static bundle.

## GTM Setup

1. Create a GA4 Google Tag in GTM using the GA4 measurement ID.
2. Fire the GA4 Google Tag on Initialization or All Pages.
3. Create one GTM Custom Event trigger per event listed below.
4. Create GA4 Event tags that use the same event names and map the listed data layer variables as event parameters.
5. Test with GTM Preview and GA4 DebugView before publishing.

## Events

| Event Name | Description | Key Properties | Trigger |
| --- | --- | --- | --- |
| `page_context_viewed` | Page loaded with route metadata. | `page_path`, `page_title`, `route_kind`, `book_id`, `chapter_number`, `location_id`, `author_slug`, `route_catalog` | Every page load |
| `map_viewed` | Interactive 3D map mounted. | `route_kind`, `book_id`, `chapter_number`, `has_deep_link` | Map-capable page load |
| `book_selected` | Visitor selected a different book. | `book_id`, `book_title`, `previous_book_id`, `method` | Book selector change |
| `chapter_selected` | Visitor moved to a different chapter. | `book_id`, `book_title`, `chapter_number`, `chapter_title`, `previous_chapter`, `method` | Previous/next buttons or committed chapter slider change |
| `chapter_playback_started` | Visitor started chapter playback. | `book_id`, `book_title`, `chapter_number` | Playback button |
| `chapter_playback_paused` | Visitor paused chapter playback. | `book_id`, `book_title`, `chapter_number` | Playback button |
| `route_segment_selected` | Visitor selected a route segment. | `book_id`, `book_title`, `segment_id`, `segment_title`, `chapter_start`, `chapter_end`, `medium`, `medium_label`, `distance_km`, `method` | Segment list or 3D route tube |
| `depth_mode_toggled` | Visitor toggled exaggerated depth mode. | `book_id`, `book_title`, `chapter_number`, `depth_exaggerated` | Depth checkbox |
| `map_reset` | Visitor reset the map controls. | `book_id`, `previous_chapter`, `chapter_number`, `previous_depth_exaggerated`, `depth_exaggerated` | Reset button |
| `context_panel_opened` | Visitor opened focused context. | `route_kind`, `book_id`, `chapter_number`, `location_id`, `author_slug` | Context chip |
| `context_panel_closed` | Visitor closed focused context. | `route_kind`, `book_id`, `chapter_number`, `location_id`, `author_slug` | Context close button |
| `location_appearance_selected` | Visitor switched to a location's appearance in another book/chapter. | `location_id`, `location_name`, `book_id`, `book_title`, `chapter_number` | Location context appearance button |
| `source_link_clicked` | Visitor opened a source/reference link. | `link_text`, `link_url`, `link_domain`, `link_path`, `link_outbound`, `link_location` | Gutenberg/source links |
| `navigation_link_clicked` | Visitor used an explicit app navigation link. | `link_text`, `link_url`, `link_domain`, `link_path`, `link_outbound`, `link_location` | App navigation links |
| `link_clicked` | Visitor clicked a static SEO document link. | `link_text`, `link_url`, `link_domain`, `link_path`, `link_outbound`, `link_location` | Links in prerendered SEO content |

## Recommended GA4 Custom Dimensions

| Name | Scope | Parameter |
| --- | --- | --- |
| Route kind | Event | `route_kind` |
| Book ID | Event | `book_id` |
| Chapter number | Event | `chapter_number` |
| Segment ID | Event | `segment_id` |
| Interaction method | Event | `method` |
| Travel medium | Event | `medium` |
| Link location | Event | `link_location` |
| Link outbound | Event | `link_outbound` |

## Recommended Key Events

| Key Event | Why |
| --- | --- |
| `book_selected` | Indicates exploration beyond the default loaded book. |
| `route_segment_selected` | Indicates active route inspection. |
| `chapter_playback_started` | Indicates high-intent map engagement. |
| `source_link_clicked` | Indicates source verification or outbound research intent. |

## UTM Convention

- Use lowercase values.
- Use underscores for multiword campaign names.
- Recommended pattern: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`.
- Example: `?utm_source=newsletter&utm_medium=email&utm_campaign=june_book_launch&utm_content=hero_cta`

## Validation Checklist

- GTM Preview shows the container loading on the homepage and prerendered catalog pages.
- GA4 DebugView receives `page_context_viewed` and `map_viewed`.
- Book selector, route segment, playback, depth toggle, and source link events fire once per action.
- Event parameters populate in GA4.
- No email addresses, names from forms, query strings, or other PII appear in event parameters.
