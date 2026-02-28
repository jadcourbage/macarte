// CarteScolaire.paris - MapLibre GL JS Implementation

// Global state
let map;
let collegesData = null;
let lyceesData = null;
let lycSecsData = null;
let activePopups = [];
let activeRoutes = [];
let activeMarkers = [];
let lastClickedSectorId = null;
let locationMarker = null;
let userLocationMarker = null;

// Paris bounds
const parisBounds = [[2.27, 48.815], [2.42, 48.905]];
const parisBoundsMobile = [[2.30, 48.83], [2.39, 48.88]];

// Mobile detection helper
function isMobile() {
    return window.innerWidth < 768;
}

// Colors for school markers
const COLORS = {
    college: '#779ECB',
    lyceeEG: '#C23B22',
    lyceeTech: '#317873',
    lyceeEGTech: '#FF8C00',
    lyceePoly: '#702963',
    lyceePro: '#F8DE7E',
    location: '#000000'
};

// Lycée sector colors by zone
function getLyceeSectorColor(zone) {
    switch (zone) {
        case 'ouest': return '#b3de69';
        case 'est': return '#80b1d3';
        case 'nord': return '#fb8072';
        case 'sud': return '#ffed6f';
        default: return '#FFFFB2';
    }
}

// CSS formats for selected/unselected menu items
const selectedFormat = {
    'font-weight': 'bold',
    'background-color': '#D9D9DB'
};

const notSelectedFormat = {
    'font-weight': 'normal',
    'background-color': 'transparent'
};

// Menu state management
function unselectMenu(item) {
    $(item).data('selected', false);
    $(item).css(notSelectedFormat);
}

function selectMenu(item) {
    $(item).data('selected', true);
    $(item).css(selectedFormat);
}

function toggleMenu(item) {
    if ($(item).data('selected')) {
        unselectMenu(item);
    } else {
        selectMenu(item);
    }
}

// Initialize menu states
function initMenuState() {
    if (!isMobile()) {
        $('#colleges-btn').data('selected', true);
    } else {
        $('#colleges-btn').data('selected', false);
        $('#colleges-btn').css(notSelectedFormat);
    }

    $('#colleges-secto-btn').data('selected', true);
    $('#colleges-txreu-btn').data('selected', false);
    $('#colleges-txmention-btn').data('selected', false);
    $('#lycees-secto-btn').data('selected', false);
    $('#lycees-eg-btn').data('selected', false);
    $('#lycees-tech-btn').data('selected', false);
    $('#lycees-eg-tech-btn').data('selected', false);
    $('#lycees-poly-btn').data('selected', false);
    $('#lycees-pro-btn').data('selected', false);
}

// Generate HTML content for college popup
function infoCol(nom, adresse, codepostal, txreu, txmention) {
    return '<h4></h4>' +
        '<b>' + nom + '</b><br/>' +
        adresse + '<br/> ' + codepostal + ' PARIS <br/>' +
        '<b>Taux de r&eacute;ussite* : </b>' + ((txreu == 999) ? "N/A" : txreu + '%') + '<br/>' +
        '<b>Taux de mentions* : </b>' + ((txmention == 999) ? "N/A" : txmention + '%') + '<br/>' +
        '*2024';
}

// Generate HTML content for college popup with walking distance
function infoColPath(nom, adresse, codepostal, txreu, txmention, time, distance) {
    return '<h4></h4>' +
        '<img src="./assets/img/walk.png" height="16" width="16"><b>  ' + distance + ' m / ' + time + ' mns </b><hr/>' +
        '<b>' + nom + '</b><br/>' +
        adresse + '<br/> ' + codepostal + ' PARIS <br/>' +
        '<b>Taux de r&eacute;ussite* : </b>' + ((txreu == 999) ? "N/A" : txreu + '%') + '<br/>' +
        '<b>Taux de mentions* : </b>' + ((txmention == 999) ? "N/A" : txmention + '%') + '<br/>' +
        '*2024';
}

// Generate HTML content for lycée popup
function infoLyc(nom, adresse, codepostal, type) {
    return '<h4></h4>' +
        '<b>' + nom + '</b><br/>' +
        '(' + type + ')<br/>' +
        adresse + '<br/>' +
        codepostal + ' PARIS <br/>';
}

// Clear all popups
function clearPopups() {
    activePopups.forEach(popup => popup.remove());
    activePopups = [];
}

// Clear all routes
function clearRoutes() {
    activeRoutes.forEach((routeId, i) => {
        if (map.getLayer(routeId)) {
            map.removeLayer(routeId);
        }
        if (map.getSource(routeId)) {
            map.removeSource(routeId);
        }
    });
    activeRoutes = [];
}

// Clear active markers
function clearMarkers() {
    activeMarkers.forEach(marker => marker.remove());
    activeMarkers = [];
}

// Set college sector style
function setColSecteurStyle(mode) {
    let colorProp;
    switch (mode) {
        case 'zone':
            colorProp = ['get', 'colzone'];
            break;
        case 'reussite':
            colorProp = ['get', 'colreussite'];
            break;
        case 'mention':
            colorProp = ['get', 'colmention'];
            break;
        default:
            colorProp = ['get', 'colzone'];
    }
    map.setPaintProperty('colSecteurs-fill', 'fill-color', colorProp);
}

// Layer visibility helpers
function showLayer(layerId) {
    if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', 'visible');
    }
}

function hideLayer(layerId) {
    if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', 'none');
    }
}

function isLayerVisible(layerId) {
    if (map.getLayer(layerId)) {
        return map.getLayoutProperty(layerId, 'visibility') !== 'none';
    }
    return false;
}

// Toggle layer visibility
function toggleLayerVisibility(layerId) {
    if (isLayerVisible(layerId)) {
        hideLayer(layerId);
    } else {
        showLayer(layerId);
    }
}

// Toggle college marker layer
function toggleColleges() {
    toggleLayerVisibility('colleges-points');
    toggleMenu(document.getElementById('colleges-btn'));
}

// Toggle lycée layers by type
function toggleLyceesEG() {
    toggleLayerVisibility('lycees-eg');
    toggleMenu(document.getElementById('lycees-eg-btn'));
}

function toggleLyceesTech() {
    toggleLayerVisibility('lycees-tech');
    toggleMenu(document.getElementById('lycees-tech-btn'));
}

function toggleLyceesEGTech() {
    toggleLayerVisibility('lycees-eg-tech');
    toggleMenu(document.getElementById('lycees-eg-tech-btn'));
}

function toggleLyceesPoly() {
    toggleLayerVisibility('lycees-poly');
    toggleMenu(document.getElementById('lycees-poly-btn'));
}

function toggleLyceesPro() {
    toggleLayerVisibility('lycees-pro');
    toggleMenu(document.getElementById('lycees-pro-btn'));
}

// Toggle college sectors
function toggleSecteurs(item) {
    const selected = $(item).data('selected');
    const layerVisible = isLayerVisible('colSecteurs-fill');

    if (selected) {
        toggleMenu(item);
        hideLayer('colSecteurs-fill');
        hideLayer('colSecteurs-outline');
    } else {
        // Hide lycée sectors
        hideLayer('lycSecteurs-fill');
        hideLayer('lycSecteurs-outline');

        if (item.id === 'colleges-secto-btn') {
            toggleMenu(item);
            unselectMenu(document.getElementById('colleges-txreu-btn'));
            unselectMenu(document.getElementById('colleges-txmention-btn'));
            unselectMenu(document.getElementById('lycees-secto-btn'));
            showLayer('colSecteurs-fill');
            showLayer('colSecteurs-outline');
            setColSecteurStyle('zone');
        }

        if (item.id === 'colleges-txreu-btn') {
            toggleMenu(item);
            unselectMenu(document.getElementById('colleges-secto-btn'));
            unselectMenu(document.getElementById('colleges-txmention-btn'));
            unselectMenu(document.getElementById('lycees-secto-btn'));
            showLayer('colSecteurs-fill');
            showLayer('colSecteurs-outline');
            setColSecteurStyle('reussite');
        }

        if (item.id === 'colleges-txmention-btn') {
            toggleMenu(item);
            unselectMenu(document.getElementById('colleges-secto-btn'));
            unselectMenu(document.getElementById('colleges-txreu-btn'));
            unselectMenu(document.getElementById('lycees-secto-btn'));
            showLayer('colSecteurs-fill');
            showLayer('colSecteurs-outline');
            setColSecteurStyle('mention');
        }
    }
}

// Toggle lycée sectors
function toggleSecteursLyc(item) {
    const selected = $(item).data('selected');

    if (selected) {
        toggleMenu(item);
        hideLayer('lycSecteurs-fill');
        hideLayer('lycSecteurs-outline');
    } else {
        toggleMenu(item);
        unselectMenu(document.getElementById('colleges-secto-btn'));
        unselectMenu(document.getElementById('colleges-txreu-btn'));
        unselectMenu(document.getElementById('colleges-txmention-btn'));
        hideLayer('colSecteurs-fill');
        hideLayer('colSecteurs-outline');
        showLayer('lycSecteurs-fill');
        showLayer('lycSecteurs-outline');
    }
}

// Find sector containing a point using Turf.js
function findSectorForPoint(lng, lat, geojsonData) {
    const point = turf.point([lng, lat]);

    for (const feature of geojsonData.features) {
        if (feature.geometry.type === 'MultiPolygon' || feature.geometry.type === 'Polygon') {
            if (turf.booleanPointInPolygon(point, feature)) {
                return feature;
            }
        }
    }
    return null;
}

// Recenter control
class RecenterControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

        const button = document.createElement('button');
        button.className = 'maplibregl-ctrl-icon';
        button.type = 'button';
        button.title = 'Recentrer sur Paris';
        button.innerHTML = '<span class="glyphicon glyphicon-resize-full" style="font-size: 14px; line-height: 29px;"></span>';
        button.onclick = () => {
            const isMobile = window.innerWidth <= 768;
            map.fitBounds(isMobile ? parisBoundsMobile : parisBounds, { padding: 20 });
        };

        this._container.appendChild(button);
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}

// Locate control
class LocateControl {
    onAdd(map) {
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

        const button = document.createElement('button');
        button.className = 'maplibregl-ctrl-icon';
        button.type = 'button';
        button.title = 'Ma position';
        button.innerHTML = '<i class="fa fa-location-arrow" style="font-size: 14px; line-height: 29px;"></i>';
        button.onclick = () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const lng = position.coords.longitude;
                        const lat = position.coords.latitude;

                        // Remove existing user location marker
                        if (userLocationMarker) {
                            userLocationMarker.remove();
                        }

                        // Create user location marker
                        const el = document.createElement('div');
                        el.className = 'user-location-marker';
                        el.style.width = '20px';
                        el.style.height = '20px';
                        el.style.borderRadius = '50%';
                        el.style.backgroundColor = '#4285F4';
                        el.style.border = '3px solid white';
                        el.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';

                        userLocationMarker = new maplibregl.Marker(el)
                            .setLngLat([lng, lat])
                            .addTo(map);

                        map.flyTo({
                            center: [lng, lat],
                            zoom: 17
                        });
                    },
                    (error) => {
                        alert('Impossible de récupérer votre position: ' + error.message);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 10000
                    }
                );
            } else {
                alert('La géolocalisation n\'est pas supportée par votre navigateur');
            }
        };

        this._container.appendChild(button);
        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
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

// Address search autocomplete configuration
let _geocodeTimer = null;

function getAutocompleteConfig() {
    return {
        source: function(request, response) {
            clearTimeout(_geocodeTimer);
            _geocodeTimer = setTimeout(function() { $.ajax({
                url: "https://data.geopf.fr/geocodage/search",
                dataType: "json",
                data: {
                    'q': request.term,
                    'index': 'address',
                    'citycode': '75056',
                    'limit': 5
                },
                success: function(data) {
                    $.each(data.features, function(key, value) {
                        this.properties.lon = value.geometry.coordinates[0];
                        this.properties.lat = value.geometry.coordinates[1];
                        this.properties.label = value.properties.label;
                    });

                    var arr = $.map(data.features, function(key, value) {
                        return key.properties;
                    });

                    response(arr);
                }
            }); }, 250);
        },
        minLength: 3,
        select: function(event, ui) {
            // Clear existing layers
            clearPopups();
            clearMarkers();
            clearRoutes();

            if (locationMarker) {
                locationMarker.remove();
                locationMarker = null;
            }

            // Close mobile navbar if open
            $(".navbar-collapse.in").collapse("hide");

            const lng = ui.item.lon;
            const lat = ui.item.lat;

            // Find the sector containing this point
            const matchingSector = findSectorForPoint(lng, lat, collegesData);

            if (matchingSector) {
                // Create marker at search location
                const el = document.createElement('div');
                el.className = 'location-marker';
                el.style.width = '24px';
                el.style.height = '24px';
                el.style.borderRadius = '50%';
                el.style.backgroundColor = COLORS.location;
                el.style.border = '3px solid white';
                el.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';

                locationMarker = new maplibregl.Marker(el)
                    .setLngLat([lng, lat])
                    .setPopup(new maplibregl.Popup().setHTML(ui.item.label))
                    .addTo(map);

                activeMarkers.push(locationMarker);

                const etabs = typeof matchingSector.properties.etabs === 'string'
                    ? JSON.parse(matchingSector.properties.etabs)
                    : matchingSector.properties.etabs;

                // Get walking routes for each school and fit bounds to routes
                const routeBounds = new maplibregl.LngLatBounds();
                routeBounds.extend([lng, lat]);

                const routePromises = etabs.map((etab, index) => {
                    const routeUrl = `/.netlify/functions/route?start=${lng},${lat}&end=${etab.lng},${etab.lat}`;

                    return $.getJSON(routeUrl).then(function(response) {
                        const routeCoords = response.features[0].geometry.coordinates;
                        const duration = response.features[0].properties.summary.duration;
                        const distance = response.features[0].properties.summary.distance;

                        const time = Math.round(duration / 60);
                        const length = Math.round(distance);

                        // Extend bounds with all route coordinates
                        routeCoords.forEach(coord => routeBounds.extend(coord));

                        // Add route line
                        const routeId = `route-${index}`;

                        map.addSource(routeId, {
                            type: 'geojson',
                            data: {
                                type: 'Feature',
                                geometry: {
                                    type: 'LineString',
                                    coordinates: routeCoords
                                }
                            }
                        });

                        map.addLayer({
                            id: routeId,
                            type: 'line',
                            source: routeId,
                            paint: {
                                'line-color': '#C23B22',
                                'line-width': 3,
                                'line-dasharray': [2, 2]
                            }
                        });

                        activeRoutes.push(routeId);

                        // Create school marker
                        const schoolEl = document.createElement('div');
                        schoolEl.className = 'school-marker';
                        schoolEl.style.width = '24px';
                        schoolEl.style.height = '24px';
                        schoolEl.style.borderRadius = '50%';
                        schoolEl.style.backgroundColor = COLORS.college;
                        schoolEl.style.border = '3px solid white';
                        schoolEl.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';

                        const schoolMarker = new maplibregl.Marker(schoolEl)
                            .setLngLat([etab.lng, etab.lat])
                            .addTo(map);

                        activeMarkers.push(schoolMarker);

                        // Create popup with distance info
                        const popup = new maplibregl.Popup({ closeOnClick: false })
                            .setLngLat([etab.lng, etab.lat])
                            .setHTML(infoColPath(etab.nom, etab.adresse, etab.code_postal, etab.txreussite, etab.txmention, time, length))
                            .addTo(map);

                        activePopups.push(popup);
                    });
                });

                // Fit bounds after all routes are loaded
                Promise.all(routePromises).then(() => {
                    map.fitBounds(routeBounds, { padding: 80 });
                });

            } else {
                // Point not in any sector - just show marker
                const el = document.createElement('div');
                el.className = 'location-marker';
                el.style.width = '24px';
                el.style.height = '24px';
                el.style.borderRadius = '50%';
                el.style.backgroundColor = COLORS.location;
                el.style.border = '3px solid white';
                el.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';

                locationMarker = new maplibregl.Marker(el)
                    .setLngLat([lng, lat])
                    .addTo(map);

                map.flyTo({
                    center: [lng, lat],
                    zoom: 17
                });
            }
        },
        open: function() {
            $(this).removeClass("ui-corner-all").addClass("ui-corner-top");
        },
        close: function() {
            $(this).removeClass("ui-corner-top").addClass("ui-corner-all");
        }
    };
}

// Address search with autocomplete
function setupAddressSearch() {
    const config = getAutocompleteConfig();

    // Legacy desktop search box (navbar - hidden but kept for compatibility)
    $("#searchbox").autocomplete(config);

    // Mobile search box
    $("#searchbox-mobile").autocomplete(config);

    // New desktop search panel - Google Maps style
    const desktopConfig = $.extend({}, config, {
        appendTo: "#desktop-search .search-panel",
        open: function() {
            $(this).removeClass("ui-corner-all").addClass("ui-corner-top");
            $("#desktop-search .search-panel").addClass("autocomplete-open");
        },
        close: function() {
            $(this).removeClass("ui-corner-top").addClass("ui-corner-all");
            $("#desktop-search .search-panel").removeClass("autocomplete-open");
        }
    });
    $("#searchbox-desktop").autocomplete(desktopConfig);
}

// Event handlers setup
function setupEventHandlers() {
    // About modal
    $("#about-btn").click(function() {
        $("#aboutModal").modal("show");
        $(".navbar-collapse.in").collapse("hide");
        return false;
    });

    // Prevent dropdown from closing on click (desktop only)
    $('.dropdown-menu').on('click', function(event) {
        if (!isMobile()) {
            event.stopPropagation();
        }
    });

    // College layers
    $('#colleges-btn').click(function() {
        toggleColleges();
    });

    // College sectors
    $('#colleges-txmention-btn, #colleges-secto-btn, #colleges-txreu-btn').click(function() {
        toggleSecteurs(this);
    });

    // Lycée layers
    $('#lycees-eg-btn').click(function() {
        toggleLyceesEG();
    });

    $('#lycees-tech-btn').click(function() {
        toggleLyceesTech();
    });

    $('#lycees-eg-tech-btn').click(function() {
        toggleLyceesEGTech();
    });

    $('#lycees-poly-btn').click(function() {
        toggleLyceesPoly();
    });

    $('#lycees-pro-btn').click(function() {
        toggleLyceesPro();
    });

    // Lycée sectors
    $('#lycees-secto-btn').click(function() {
        toggleSecteursLyc(this);
    });

    // Nav toggle
    $("#nav-btn").click(function() {
        $(".navbar-collapse").collapse("toggle");
        return false;
    });

    // Search box handlers (desktop and mobile)
    $("#searchbox, #searchbox-mobile, #searchbox-desktop").click(function() {
        $(this).select();
    });

    $("#searchbox, #searchbox-mobile, #searchbox-desktop").keypress(function(e) {
        if (e.which == 13) {
            e.preventDefault();
        }
    });

    // Clear buttons: show when typing, hide when empty
    function setupClearBtn(inputId, btnId) {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(btnId);
        if (!input || !btn) return;
        input.addEventListener('input', function() {
            btn.classList.toggle('hidden', this.value === '');
        });
        btn.addEventListener('click', function() {
            input.value = '';
            btn.classList.add('hidden');
            clearPopups();
            clearMarkers();
            clearRoutes();
            if (locationMarker) { locationMarker.remove(); locationMarker = null; }
            input.focus();
        });
    }
    setupClearBtn('searchbox-desktop', 'clear-desktop');
    setupClearBtn('searchbox-mobile', 'clear-mobile');
}

// Initialize everything when DOM is ready
$(document).ready(function() {
    initMenuState();
    initMap();
    setupAddressSearch();
    setupEventHandlers();
});
