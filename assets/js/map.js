// CarteScolaire.paris — Map initialization, data loading, and event handlers

// Precomputed 20-step YlGnBu gradient: yellow (low) → dark blue (high)
const REUSSITE_GRADIENT = [
    '#ffffd9','#f7fcc8','#f0f9b7','#e3f4b2','#d3eeb3',
    '#bfe6b5','#a1dab8','#83cebb','#68c5be','#4ebbc2',
    '#39aec3','#2a9fc1','#1d8ebf','#1f79b5','#2163ab',
    '#2351a2','#243f99','#20308b','#142771','#081d58'
];

const ZONE_COLORS = [
    '#80b1d3','#8dd3c7','#b3de69','#bc80bd','#bebada',
    '#ccebc5','#d9d9d9','#fb8072','#fccde5','#fdb462',
    '#ffed6f','#ffffb3','#aec6cf','#b5e7a0','#f4a460',
    '#c9b1d9','#87ceeb','#f0e68c'
];

function percentileRank(value, values) {
    const sorted = [...values].sort((a, b) => a - b);
    const below = sorted.filter(v => v < value).length;
    const equal = sorted.filter(v => v === value).length;
    return (below + equal * 0.5) / sorted.length * 100;
}

function rateToColor(rate, allRates, gradient) {
    const pct = percentileRank(rate, allRates);
    return gradient[Math.min(gradient.length - 1, Math.floor((pct - 0.001) / 5))];
}

// Seeded LCG for deterministic zone color assignment (same seed as legacy pipeline)
function seededRandom(seed) {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return (s >>> 0) / 0xffffffff;
    };
}

function computeSectorColors(sectorsGeoJSON, schools) {
    const colleges = Object.values(schools).filter(s => s.nature_uai === 340 && s.txreussite != null);
    const allReussite = colleges.map(s => s.txreussite);
    const allMention  = colleges.map(s => s.txmention);
    const allIps      = Object.values(schools).filter(s => s.nature_uai === 340 && s.ips != null).map(s => s.ips);
    const rng = seededRandom(1234);

    sectorsGeoJSON.features.forEach(f => {
        const uais = f.properties.uais;
        const etabs = uais.map(u => schools[u]).filter(Boolean);
        const count = etabs.filter(e => e.txreussite != null).length;

        const txr = count > 0
            ? etabs.filter(e => e.txreussite != null).reduce((s, e) => s + e.txreussite, 0) / count
            : 0;
        const txm = count > 0
            ? etabs.filter(e => e.txmention  != null).reduce((s, e) => s + e.txmention,  0) / count
            : 0;

        const ipsEtabs = etabs.filter(e => e.ips != null);
        const avgIps = ipsEtabs.length > 0
            ? ipsEtabs.reduce((s, e) => s + e.ips, 0) / ipsEtabs.length
            : null;

        f.properties.colzone     = ZONE_COLORS[Math.floor(rng() * ZONE_COLORS.length)];
        f.properties.colreussite = (count > 0 && allReussite.length > 0) ? rateToColor(txr, allReussite, REUSSITE_GRADIENT) : '#cccccc';
        f.properties.colmention  = (count > 0 && allMention.length  > 0) ? rateToColor(txm, allMention,  REUSSITE_GRADIENT) : '#cccccc';
        f.properties.colips      = avgIps != null && allIps.length > 0 ? rateToColor(avgIps, allIps, REUSSITE_GRADIENT) : '#cccccc';
    });
}

function buildPointsGeoJSON(natureUaiCodes) {
    return {
        type: 'FeatureCollection',
        features: Object.entries(schoolsData)
            .filter(([, s]) => natureUaiCodes.includes(s.nature_uai))
            .map(([uai, s]) => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
                properties: {
                    uai,
                    nature_uai: s.nature_uai,
                    secteur_public_prive_libe: s.secteur_public_prive_libe
                }
            }))
    };
}

// Initialize the map
function initMap() {
    map = new maplibregl.Map({
        container: 'map',
        style: "https://d3iokjf2q3mli.cloudfront.net/style.json",
        center: [2.343920, 48.856515],
        zoom: 13
    });

    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    map.addControl(new RecenterControl(), 'bottom-right');
    map.addControl(new LocateControl(), 'bottom-right');
    map.addControl(new LayerControl(), 'top-right');
    map.addControl(new AboutControl(), 'top-right');

    // Fit to Paris bounds (tighter on mobile)
    const isMobile = window.innerWidth <= 768;
    map.fitBounds(isMobile ? parisBoundsMobile : parisBounds, { padding: 20 });

    // Load data and add layers when map is ready
    map.on('load', loadDataAndAddLayers);
}

function applyMetadataLabels() {
    const year = getMeta('secto_year');
    document.querySelectorAll('.filter-label').forEach(el => {
        el.textContent = `Sectorisation (${year}) :`;
    });
    document.querySelectorAll('[data-label="brevet-year"]').forEach(el => {
        el.textContent = `Brevet ${getMeta('brevet_session')}`;
    });
    document.querySelectorAll('[data-label="results-year"]').forEach(el => {
        el.textContent = `Résultats au Brevet et au Baccalauréat ${getMeta('bac_annee')}`;
    });
}

// Load GeoJSON data and add layers
async function loadDataAndAddLayers() {
    try {
        const [sectorsRes, schoolsRes, lyceeAffectRes, metaRes] = await Promise.all([
            fetch('data/colleges_sectors.geojson'),
            fetch('data/schools_data.json'),
            fetch('data/lycee_affectation.json'),
            fetch('data/metadata.json').catch(() => null)
        ]);

        sectorsData = await sectorsRes.json();
        schoolsData = await schoolsRes.json();
        lyceeAffectation = await lyceeAffectRes.json();
        if (metaRes) siteMetadata = await metaRes.json().catch(() => null);
        applyMetadataLabels();

        // Compute and inject sector colors at runtime
        computeSectorColors(sectorsData, schoolsData);

        // Assign numeric IDs required for setFeatureState (not present in generated GeoJSON)
        sectorsData.features.forEach((f, i) => { f.id = i; });

        // Add sources
        map.addSource('colleges', {
            type: 'geojson',
            data: sectorsData
        });

        map.addSource('college-points', {
            type: 'geojson',
            data: buildPointsGeoJSON([340])
        });

        map.addSource('lycees', {
            type: 'geojson',
            data: buildPointsGeoJSON([300, 301, 302, 306, 320])
        });

        // Add college sector fill layer
        map.addLayer({
            id: 'colSecteurs-fill',
            type: 'fill',
            source: 'colleges',
            filter: ['==', '$type', 'Polygon'],
            paint: {
                'fill-color': ['get', 'colzone'],
                'fill-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'clicked'], false],
                    1,
                    0.6
                ]
            }
        });

        // Add college sector outline layer
        map.addLayer({
            id: 'colSecteurs-outline',
            type: 'line',
            source: 'colleges',
            filter: ['==', '$type', 'Polygon'],
            paint: {
                'line-color': 'grey',
                'line-width': 1,
                'line-dasharray': [3, 3],
                'line-opacity': 0.5
            }
        });

        // Add college points layer
        map.addLayer({
            id: 'colleges-points',
            type: 'circle',
            source: 'college-points',
            filter: ['==', ['get', 'secteur_public_prive_libe'], 'Public'],
            paint: {
                'circle-radius': 6,
                'circle-color': COLORS.college,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 1
            },
            layout: {
                visibility: 'none'
            }
        });

        // Add lycée layers by type (all hidden initially)
        // Lycées d'enseignement général (nature_uai == 302, public)
        map.addLayer({
            id: 'lycees-eg',
            type: 'circle',
            source: 'lycees',
            filter: ['all',
                ['==', ['get', 'nature_uai'], 302],
                ['==', ['get', 'secteur_public_prive_libe'], 'Public']
            ],
            paint: {
                'circle-radius': 6,
                'circle-color': COLORS.lyceeEG,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 1
            },
            layout: {
                visibility: 'none'
            }
        });

        // Lycées d'enseignement technologique (nature_uai == 301)
        map.addLayer({
            id: 'lycees-tech',
            type: 'circle',
            source: 'lycees',
            filter: ['==', ['get', 'nature_uai'], 301],
            paint: {
                'circle-radius': 6,
                'circle-color': COLORS.lyceeTech,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 1
            },
            layout: {
                visibility: 'none'
            }
        });

        // Lycées d'enseignement général et technologique (nature_uai == 300, public)
        map.addLayer({
            id: 'lycees-eg-tech',
            type: 'circle',
            source: 'lycees',
            filter: ['all',
                ['==', ['get', 'nature_uai'], 300],
                ['==', ['get', 'secteur_public_prive_libe'], 'Public']
            ],
            paint: {
                'circle-radius': 6,
                'circle-color': COLORS.lyceeEGTech,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 1
            },
            layout: {
                visibility: 'none'
            }
        });

        // Lycées polyvalents (nature_uai == 306, public)
        map.addLayer({
            id: 'lycees-poly',
            type: 'circle',
            source: 'lycees',
            filter: ['all',
                ['==', ['get', 'nature_uai'], 306],
                ['==', ['get', 'secteur_public_prive_libe'], 'Public']
            ],
            paint: {
                'circle-radius': 6,
                'circle-color': COLORS.lyceePoly,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 1
            },
            layout: {
                visibility: 'none'
            }
        });

        // Lycées professionnels (nature_uai == 320, public)
        map.addLayer({
            id: 'lycees-pro',
            type: 'circle',
            source: 'lycees',
            filter: ['all',
                ['==', ['get', 'nature_uai'], 320],
                ['==', ['get', 'secteur_public_prive_libe'], 'Public']
            ],
            paint: {
                'circle-radius': 6,
                'circle-color': COLORS.lyceePro,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 1
            },
            layout: {
                visibility: 'none'
            }
        });

        // Add click handlers
        setupClickHandlers();

        // Add cursor change on hover
        setupHoverHandlers();

    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Setup click handlers for layers
function setupClickHandlers() {
    // Click on college sector
    map.on('click', 'colSecteurs-fill', (e) => {
        if (e.features.length === 0) return;

        const feature = e.features[0];

        const uais = typeof feature.properties.uais === 'string'
            ? JSON.parse(feature.properties.uais)
            : feature.properties.uais;

        const etabs = uais.map(uai => schoolsData[uai]).filter(Boolean);

        // Use original GeoJSON geometry (click event geometry may be clipped to tile boundaries)
        const fullFeature = sectorsData.features.find(f =>
            f.properties.uais && f.properties.uais[0] === uais[0]);
        const geom = fullFeature ? fullFeature.geometry : feature.geometry;
        const coordinates = geom.coordinates.flat(2);
        const bounds = coordinates.reduce((bounds, coord) => {
                    return bounds.extend(coord);
                }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));

        // Clear previous popups and routes (keep affectation markers)
        clearPopups();
        clearRoutes();

        // Reset previous sector highlight
        if (lastClickedSectorId !== null) {
            map.setFeatureState(
                { source: 'colleges', id: lastClickedSectorId },
                { clicked: false }
            );
        }

        // Highlight clicked sector
        lastClickedSectorId = feature.id;
        map.setFeatureState(
            { source: 'colleges', id: feature.id },
            { clicked: true }
        );

        etabs.forEach(etab => {
            // Create popup for each school
            const popup = new maplibregl.Popup({ closeOnClick: false })
                .setLngLat([etab.lng, etab.lat])
                .setHTML(infoCol(etab.nom, etab.adresse, etab.code_postal, etab.nature_uai_libe, etab.txreussite, etab.txmention, etab.brevet_session))
                .addTo(map);

            activePopups.push(popup);
        });

        // Zoom to bounds
        map.fitBounds(bounds, { padding: 100 });
    });

    // Click on college point
    map.on('click', 'colleges-points', (e) => {
        if (e.features.length === 0) return;

        const feature = e.features[0];
        const props = feature.properties;
        const coords = feature.geometry.coordinates;
        const school = schoolsData[props.uai];

        if (!school) return;

        // Clear previous popups
        clearPopups();

        const popup = new maplibregl.Popup()
            .setLngLat(coords)
            .setHTML(infoCol(school.nom, school.adresse, school.code_postal, school.nature_uai_libe, school.txreussite, school.txmention, school.brevet_session))
            .addTo(map);

        activePopups.push(popup);
    });

    // Click on lycée layers
    const lyceeLayers = ['lycees-eg', 'lycees-tech', 'lycees-eg-tech', 'lycees-poly', 'lycees-pro'];

    lyceeLayers.forEach(layerId => {
        map.on('click', layerId, (e) => {
            if (e.features.length === 0) return;

            const feature = e.features[0];
            const props = feature.properties;
            const coords = feature.geometry.coordinates;
            const school = schoolsData[props.uai];

            if (!school) return;

            // Clear previous popups
            clearPopups();

            const popup = new maplibregl.Popup()
                .setLngLat(coords)
                .setHTML(infoLyc(school.nom, school.adresse, school.code_postal, school.nature_uai_libe, school.txreussite, school.txmention, school.bac_annee))
                .addTo(map);

            activePopups.push(popup);
        });
    });

}

// Setup hover handlers for cursor change
function setupHoverHandlers() {
    const interactiveLayers = [
        'colSecteurs-fill',
        'colleges-points',
        'lycees-eg',
        'lycees-tech',
        'lycees-eg-tech',
        'lycees-poly',
        'lycees-pro'
    ];

    interactiveLayers.forEach(layerId => {
        map.on('mouseenter', layerId, () => {
            map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', layerId, () => {
            map.getCanvas().style.cursor = '';
        });
    });
}
