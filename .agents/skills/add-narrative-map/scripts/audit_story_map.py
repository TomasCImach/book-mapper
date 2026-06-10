#!/usr/bin/env python3
"""Lightweight audit for book-mapper narrative JSON files."""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path
from typing import Any

EARTH_RADIUS_KM = 6371
VALID_CONFIDENCE = {"confirmed", "geocoded", "textual", "estimated", "fictional", "book"}
VALID_DISTANCE_SOURCE = {"geodesic", "book", "estimated", "cinematic"}
VALID_MOVEMENT = {
    "stationary",
    "surface",
    "sea",
    "ascent",
    "descent",
    "wrong-turn",
    "subterranean",
    "raft",
    "volcanic",
    "return",
}


def haversine_km(a: dict[str, Any], b: dict[str, Any]) -> float:
    lat1 = math.radians(a["lat"])
    lat2 = math.radians(b["lat"])
    delta_lat = math.radians(b["lat"] - a["lat"])
    delta_lon = math.radians(b["lon"] - a["lon"])
    h = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.atan2(math.sqrt(h), math.sqrt(1 - h))


def route_distance_km(path: dict[str, Any], waypoints: dict[str, dict[str, Any]]) -> float:
    start = waypoints[path["start"]["waypointId"]]["position"]
    end = waypoints[path["end"]["waypointId"]]["position"]
    positions = [start, *path.get("points", []), end]
    return sum(
        haversine_km(positions[index - 1], position)
        for index, position in enumerate(positions)
        if index
    )


def require(condition: bool, errors: list[str], message: str) -> None:
    if not condition:
        errors.append(message)


def audit(data: dict[str, Any]) -> tuple[list[str], float]:
    errors: list[str] = []
    required_top = {
        "schemaVersion",
        "id",
        "title",
        "author",
        "source",
        "chapters",
        "media",
        "waypoints",
        "paths",
        "chapterFacts",
    }
    missing = sorted(required_top - set(data))
    require(not missing, errors, f"Missing top-level fields: {', '.join(missing)}")

    chapters = data.get("chapters", [])
    chapter_numbers = [
        chapter.get("number") for chapter in chapters if isinstance(chapter, dict)
    ]
    chapter_set = set(chapter_numbers)

    media = data.get("media", {})
    for medium_id, medium in media.items():
        require(isinstance(medium, dict), errors, f"Medium {medium_id} is not an object")
        if isinstance(medium, dict):
            color = medium.get("color")
            require(
                bool(re.match(r"^#[0-9a-fA-F]{6}$", str(color))),
                errors,
                f"Medium {medium_id} has invalid color",
            )

    waypoint_by_id: dict[str, dict[str, Any]] = {}
    for waypoint in data.get("waypoints", []):
        waypoint_id = waypoint.get("id")
        require(bool(waypoint_id), errors, "Waypoint missing id")
        require(
            waypoint_id not in waypoint_by_id,
            errors,
            f"Duplicate waypoint id: {waypoint_id}",
        )
        if waypoint_id:
            waypoint_by_id[waypoint_id] = waypoint
        require(
            waypoint.get("confidence") in VALID_CONFIDENCE,
            errors,
            f"Waypoint {waypoint_id} has invalid confidence",
        )
        require(
            waypoint.get("chapter") in chapter_set,
            errors,
            f"Waypoint {waypoint_id} references missing chapter",
        )
        position = waypoint.get("position", {})
        require(
            -90 <= position.get("lat", 999) <= 90,
            errors,
            f"Waypoint {waypoint_id} has invalid latitude",
        )
        require(
            -180 <= position.get("lon", 999) <= 180,
            errors,
            f"Waypoint {waypoint_id} has invalid longitude",
        )
        require(
            position.get("depthKm", 0) >= 0,
            errors,
            f"Waypoint {waypoint_id} has negative depth",
        )

    path_ids: set[str] = set()
    total_distance = 0.0
    for path in data.get("paths", []):
        path_id = path.get("id")
        require(bool(path_id), errors, "Path missing id")
        require(path_id not in path_ids, errors, f"Duplicate path id: {path_id}")
        if path_id:
            path_ids.add(path_id)

        start_id = path.get("start", {}).get("waypointId")
        end_id = path.get("end", {}).get("waypointId")
        require(
            start_id in waypoint_by_id,
            errors,
            f"Path {path_id} has missing start waypoint {start_id}",
        )
        require(
            end_id in waypoint_by_id,
            errors,
            f"Path {path_id} has missing end waypoint {end_id}",
        )
        require(
            path.get("medium") in media,
            errors,
            f"Path {path_id} uses missing medium {path.get('medium')}",
        )
        require(
            path.get("distanceSource") in VALID_DISTANCE_SOURCE,
            errors,
            f"Path {path_id} has invalid distanceSource",
        )
        require(
            path.get("confidence") in VALID_CONFIDENCE,
            errors,
            f"Path {path_id} has invalid confidence",
        )
        require(
            path.get("chapterStart") in chapter_set,
            errors,
            f"Path {path_id} has missing chapterStart",
        )
        require(
            path.get("chapterEnd") in chapter_set,
            errors,
            f"Path {path_id} has missing chapterEnd",
        )
        require(
            path.get("chapterStart", 0) <= path.get("chapterEnd", 0),
            errors,
            f"Path {path_id} has inverted chapter range",
        )
        require(bool(path.get("sourceRefs")), errors, f"Path {path_id} has no sourceRefs")
        for point_index, point in enumerate(path.get("points", []), start=1):
            require(
                -90 <= point.get("lat", 999) <= 90,
                errors,
                f"Path {path_id} point {point_index} has invalid latitude",
            )
            require(
                -180 <= point.get("lon", 999) <= 180,
                errors,
                f"Path {path_id} point {point_index} has invalid longitude",
            )
            require(
                point.get("depthKm", 0) >= 0,
                errors,
                f"Path {path_id} point {point_index} has negative depth",
            )

        if start_id in waypoint_by_id and end_id in waypoint_by_id:
            total_distance += float(
                path.get("distanceKm") or route_distance_km(path, waypoint_by_id)
            )

    fact_chapters: set[int] = set()
    for fact in data.get("chapterFacts", []):
        chapter = fact.get("chapter")
        require(chapter in chapter_set, errors, f"Chapter fact references missing chapter {chapter}")
        require(chapter not in fact_chapters, errors, f"Duplicate chapter fact {chapter}")
        if isinstance(chapter, int):
            fact_chapters.add(chapter)
        require(
            fact.get("movement") in VALID_MOVEMENT,
            errors,
            f"Chapter {chapter} has invalid movement",
        )
        require(bool(fact.get("locationFacts")), errors, f"Chapter {chapter} has no locationFacts")
        require(bool(fact.get("deltaFacts")), errors, f"Chapter {chapter} has no deltaFacts")
        require(bool(fact.get("slopeFacts")), errors, f"Chapter {chapter} has no slopeFacts")
        require(bool(fact.get("sourceRefs")), errors, f"Chapter {chapter} has no sourceRefs")
        require(
            fact.get("confidence") in VALID_CONFIDENCE,
            errors,
            f"Chapter {chapter} has invalid confidence",
        )
        for segment_id in fact.get("segmentIds", []):
            require(
                segment_id in path_ids,
                errors,
                f"Chapter {chapter} references missing segment {segment_id}",
            )

    missing_facts = sorted(chapter_set - fact_chapters)
    require(
        not missing_facts,
        errors,
        f"Missing chapterFacts for chapters: {', '.join(map(str, missing_facts))}",
    )
    return errors, total_distance


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit a book-mapper narrative JSON file.")
    parser.add_argument("json_file", type=Path)
    args = parser.parse_args()

    data = json.loads(args.json_file.read_text())
    errors, total_distance = audit(data)

    print(f"{data.get('title', args.json_file.name)}")
    print(f"  id: {data.get('id')}")
    print(f"  chapters/scenes: {len(data.get('chapters', []))}")
    print(f"  waypoints: {len(data.get('waypoints', []))}")
    print(f"  paths: {len(data.get('paths', []))}")
    print(f"  chapter facts: {len(data.get('chapterFacts', []))}")
    print(f"  audited distance: {round(total_distance):,} km")

    if errors:
        print("\nErrors:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("  audit: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
