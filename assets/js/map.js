// CarteScolaire.paris — Map initialization, data loading, and event handlers

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

// Load GeoJSON data and add layers
async function loadDataAndAddLayers() {
    try {
        // Load all GeoJSON data
        const [collegesResponse, lyceesResponse, lycSecsResponse] = await Promise.all([
            fetch('data/colleges.geojson'),
            fetch('data/lycees.geojson'),
            fetch('data/secteurs_lyc.geojson')
        ]);

        collegesData = await collegesResponse.json();
        lyceesData = await lyceesResponse.json();
        lycSecsData = await lycSecsResponse.json();

        // Add sources
        map.addSource('colleges', {
            type: 'geojson',
            data: collegesData
        });

        map.addSource('lycees', {
            type: 'geojson',
            data: lyceesData
        });

        map.addSource('lycSecteurs', {
            type: 'geojson',
            data: lycSecsData
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

        // Add lycée sector fill layer (hidden initially)
        map.addLayer({
            id: 'lycSecteurs-fill',
            type: 'fill',
            source: 'lycSecteurs',
            paint: {
                'fill-color': [
                    'match',
                    ['get', 'secteur'],
                    'ouest', '#b3de69',
                    'est', '#80b1d3',
                    'nord', '#fb8072',
                    'sud', '#ffed6f',
                    '#FFFFB2'
                ],
                'fill-opacity': 0.6
            },
            layout: {
                visibility: 'none'
            }
        });

        // Add lycée sector outline layer (hidden initially)
        map.addLayer({
            id: 'lycSecteurs-outline',
            type: 'line',
            source: 'lycSecteurs',
            paint: {
                'line-color': 'grey',
                'line-width': 1,
                'line-dasharray': [3, 3],
                'line-opacity': 0.5
            },
            layout: {
                visibility: 'none'
            }
        });

        // Add college points layer
        map.addLayer({
            id: 'colleges-points',
            type: 'circle',
            source: 'colleges',
            filter: ['==', ['geometry-type'], 'Point'],
            paint: {
                'circle-radius': 6,
                'circle-color': COLORS.college,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 1
            },
            layout: {
                visibility: isMobile() ? 'none' : 'visible'
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

        const etabs = typeof feature.properties.etabs === 'string'
            ? JSON.parse(feature.properties.etabs)
            : feature.properties.etabs;

        // Use original GeoJSON geometry (click event geometry may be clipped to tile boundaries)
        const fullFeature = collegesData.features.find(f =>
            f.geometry.type === 'MultiPolygon' && f.properties.etabs[0].nom === etabs[0].nom);
        const geom = fullFeature ? fullFeature.geometry : feature.geometry;
        const coordinates = geom.coordinates.flat(2);
        const bounds = coordinates.reduce((bounds, coord) => {
                    return bounds.extend(coord);
                }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));

        // Clear previous popups
        clearPopups();
        clearMarkers();
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
                .setHTML(infoCol(etab.nom, etab.adresse, etab.code_postal, etab.txreussite, etab.txmention))
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

        // Clear previous popups
        clearPopups();

        const popup = new maplibregl.Popup()
            .setLngLat(coords)
            .setHTML(infoCol(props.nom, props.adresse, props.code_postal, props.txreussite, props.txmention))
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

            // Clear previous popups
            clearPopups();

            const popup = new maplibregl.Popup()
                .setLngLat(coords)
                .setHTML(infoLyc(props.patronyme_uai, props.adresse_uai, props.code_postal_uai, props.nature_uai_libe))
                .addTo(map);

            activePopups.push(popup);
        });
    });

    // Click on lycée sector
    map.on('click', 'lycSecteurs-fill', (e) => {
        if (e.features.length === 0) return;

        const feature = e.features[0];
        // Use original GeoJSON geometry (click event geometry may be clipped to tile boundaries)
        const fullFeature = lycSecsData.features.find(f =>
            f.properties.cartodb_id === feature.properties.cartodb_id);
        const bounds = turf.bbox(fullFeature || feature);

        map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 50 });
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
        'lycees-pro',
        'lycSecteurs-fill'
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
