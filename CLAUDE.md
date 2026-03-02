# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CarteScolaire.paris** — An interactive map application for visualizing Paris school districts (collèges and lycées), including school locations, sector boundaries, and Brevet exam results (pass rates and distinction rates).

The site is a static website hosted at https://cartescolaire.netlify.app

## Architecture

### Frontend (Static Site)
- **index.html**: Single-page application using MapLibre GL JS for mapping
- **assets/js/**: Application logic split across focused modules:
  - `config.js`: Global state (`schoolsData`, `sectorsData`), constants, helpers
  - `map.js`: Map initialization, data loading, layer setup, click handlers
  - `layers.js`: Layer visibility toggles, `findSectorForPoint()`
  - `search.js`: Address autocomplete and walking route display
  - `ui.js`: Menu state helpers and popup HTML builders
  - `controls.js`: Custom MapLibre controls (recenter, locate, layer panel, about)
- **data/**: Data files loaded at runtime
  - `schools_data.json`: All Paris schools keyed by UAI — single source of truth for names, addresses, coordinates, and exam results
  - `colleges_sectors.geojson`: College sector polygons only, each with a `uais` array referencing schools by UAI

### Data Pipeline (Python)
Located in `python-pipeline/`:
- **run_pipeline.py**: Fetches data from opendata.paris.fr and data.education.gouv.fr APIs, outputs `data/schools_data.json` and `data/colleges_sectors.geojson`
- **uai_mapping.csv**: Hand-curated mapping of Paris open data school names → UAI codes (used to link sector polygons to schools)

## Commands

### Update School Data
```bash
cd python-pipeline
pip install -r requirements.txt
python run_pipeline.py
```
This regenerates `data/schools_data.json` and `data/colleges_sectors.geojson`.

### Run Locally
```bash
python -m http.server 8000
# Then open http://localhost:8000
```
A local server is required because the app loads JSON/GeoJSON files via fetch.

## User Features

- **Address search**: Autocomplete geocoding identifies the college sector for an address
- **College views**: Toggle between sector map, pass rate choropleth (YlGnBu), or distinction rate choropleth
- **Lycée views**: Filter by school type (general, tech, polyvalent, professional)
- **Sector click**: Shows popup with assigned school(s) and their Brevet results
- **Walking route**: When searching an address, displays walking distance/time to assigned school(s)
- **Geolocation**: Locate user position on map

## Key Technical Details

### Data Pipeline
- `get_all_paris_schools()` paginates the national API (`fr-en-adresse-et-geolocalisation-etablissements-premier-et-second-degre`) to fetch all ~1297 Paris schools
- `merge_brevet_results()` joins Brevet CSV results to college entries (nature_uai=340) by UAI code
- `generate_geojson_college_sectors()` uses `uai_mapping.csv` to map sector polygon school names → UAI codes; outputs polygons only (no Point features)
- School year is configured via the `id_projet` parameter (e.g., `"COLLEGES (année scolaire 2025/2026)"`)
- Geometry simplification reduces GeoJSON size while maintaining ~1m precision

### Frontend Map
- Uses MapLibre GL JS with vector tiles (style from CloudFront CDN)
- Dependencies: MapLibre GL JS v4.7.1, Turf.js v7 (for point-in-polygon operations)
- Address geocoding via data.geopf.fr
- Walking route calculation via OpenRouteService API (Netlify function proxy)
- College and lycée point layers are built at runtime from `schools_data.json` via `buildPointsGeoJSON()`
- Sector colors (colzone/colreussite/colmention) are computed at runtime in `computeSectorColors()` using a 20-step YlGnBu gradient
- Point-in-polygon lookup uses `turf.booleanPointInPolygon()` for address search
- Coordinates use `[lng, lat]` format (MapLibre convention)
- College points filtered to `secteur_public_prive_libe === 'Public'`

## Browser Automation

Use `agent-browser` for web automation. Run `agent-browser --help` for all commands.

Core workflow:
1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes
