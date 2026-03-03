// CarteScolaire.paris — Layer visibility, toggle functions, and spatial helpers

// Clear all popups
function clearPopups() {
    activePopups.forEach(popup => popup.remove());
    activePopups = [];
}

// Clear all routes
function clearRoutes() {
    activeRoutes.forEach((routeId) => {
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

    if (selected) {
        toggleMenu(item);
        hideLayer('colSecteurs-fill');
        hideLayer('colSecteurs-outline');
    } else {
        if (item.id === 'colleges-secto-btn') {
            toggleMenu(item);
            unselectMenu(document.getElementById('colleges-txreu-btn'));
            unselectMenu(document.getElementById('colleges-txmention-btn'));
            showLayer('colSecteurs-fill');
            showLayer('colSecteurs-outline');
            setColSecteurStyle('zone');
        }

        if (item.id === 'colleges-txreu-btn') {
            toggleMenu(item);
            unselectMenu(document.getElementById('colleges-secto-btn'));
            unselectMenu(document.getElementById('colleges-txmention-btn'));
            showLayer('colSecteurs-fill');
            showLayer('colSecteurs-outline');
            setColSecteurStyle('reussite');
        }

        if (item.id === 'colleges-txmention-btn') {
            toggleMenu(item);
            unselectMenu(document.getElementById('colleges-secto-btn'));
            unselectMenu(document.getElementById('colleges-txreu-btn'));
            showLayer('colSecteurs-fill');
            showLayer('colSecteurs-outline');
            setColSecteurStyle('mention');
        }
    }
}

// Clear affectation legend
function clearLegend() {
    document.getElementById('affectation-legend').classList.add('hidden');
}

// Find college sector containing a point using Turf.js.
// Falls back to nearest sector within 100m to handle geocoded points
// that land just outside a polygon boundary (~10-15m is common).
function findSectorForPoint(lng, lat) {
    const point = turf.point([lng, lat]);

    for (const feature of sectorsData.features) {
        if (turf.booleanPointInPolygon(point, feature)) {
            return feature;
        }
    }

    // Fallback: nearest sector within 100m
    let nearest = null;
    let nearestDist = Infinity;
    for (const feature of sectorsData.features) {
        const rings = feature.geometry.type === 'MultiPolygon'
            ? feature.geometry.coordinates.flat(1)
            : feature.geometry.coordinates;
        for (const ring of rings) {
            const line = turf.lineString(ring);
            const nearestPt = turf.nearestPointOnLine(line, point);
            const dist = turf.distance(point, nearestPt, { units: 'meters' });
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = feature;
            }
        }
    }
    return nearestDist <= 100 ? nearest : null;
}
