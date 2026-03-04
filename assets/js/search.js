// CarteScolaire.paris — Address autocomplete and walking route

function createPinMarker(type) {
    const color = type === 'home' ? '#4A7FB5' : '#C23B22';
    const icon = type === 'home'
        ? `<path d="M9,13.5 L14,8.5 L19,13.5" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
           <rect x="10.5" y="13.5" width="7" height="5" fill="${color}" rx="0.5"/>
           <rect x="12.5" y="15.5" width="3" height="3" fill="white" rx="0.5"/>`
        : `<path d="M9,12.5 L14,8.5 L19,12.5 Z" fill="${color}"/>
           <rect x="9" y="12.5" width="10" height="6.5" fill="${color}" rx="0.5"/>
           <rect x="11" y="14.5" width="2.5" height="2" fill="white" rx="0.3"/>
           <rect x="14.5" y="14.5" width="2.5" height="2" fill="white" rx="0.3"/>`;
    const el = document.createElement('div');
    el.className = type === 'home' ? 'location-marker' : 'school-marker';
    el.style.cssText = 'width:28px;height:38px;cursor:pointer;';
    el.innerHTML = `<svg width="28" height="38" viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14,1 C7.4,1 2,6.4 2,13 C2,22 14,37 14,37 C14,37 26,22 26,13 C26,6.4 20.6,1 14,1 Z" fill="${color}" stroke="white" stroke-width="1"/>
        <circle cx="14" cy="13" r="7" fill="white"/>
        ${icon}
    </svg>`;
    return el;
}

function createCircleMarker(color) {
    const el = document.createElement('div');
    el.style.cssText = `width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:pointer;`;
    return el;
}

function attachMarkerPopup(el, lngLat, html) {
    const mobile = isMobile();
    if (!mobile) {
        el.addEventListener('click', (e) => e.stopPropagation());
        el.addEventListener('mouseenter', (e) => {
            clearTimeout(_hoverCloseTimer);
            e.stopPropagation();
            clearPopups();
            const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 })
                .setLngLat(lngLat)
                .setHTML(html)
                .addTo(map);
            activePopups.push(popup);
            // Keep popup alive when mouse moves onto it
            const popupEl = popup.getElement();
            if (popupEl) {
                popupEl.addEventListener('mouseenter', () => clearTimeout(_hoverCloseTimer));
                popupEl.addEventListener('mouseleave', () => {
                    _hoverCloseTimer = setTimeout(() => clearPopups(), 150);
                });
            }
        });
        el.addEventListener('mouseleave', () => {
            _hoverCloseTimer = setTimeout(() => clearPopups(), 150);
        });
    } else {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            clearPopups();
            const popup = new maplibregl.Popup({ closeOnClick: false })
                .setLngLat(lngLat)
                .setHTML(html)
                .addTo(map);
            activePopups.push(popup);
        });
    }
}

let _geocodeTimer = null;
let _hoverCloseTimer = null;

function showSearchFilters() {
    document.getElementById('search-filters').classList.remove('hidden');
    document.getElementById('search-filters-mobile').classList.remove('hidden');
    if (isMobile()) {
        // Push top-right controls below the filter bar after reflow
        requestAnimationFrame(() => {
            const h = document.getElementById('mobile-search').offsetHeight;
            document.querySelectorAll('.maplibregl-ctrl-top-right').forEach(el => {
                el.style.top = (h + 8) + 'px';
            });
        });
    }
}

function showLegend(mode) {
    document.getElementById('affectation-legend').classList.remove('hidden');
    const legendCollege = document.getElementById('legend-college');
    if (mode === 'both') {
        legendCollege.classList.remove('hidden');
    } else {
        legendCollege.classList.add('hidden');
    }
}

function renderCollegesMode(sector, lng, lat) {
    if (!sector) {
        map.flyTo({ center: [lng, lat], zoom: 17 });
        return;
    }

    const uais = typeof sector.properties.uais === 'string'
        ? JSON.parse(sector.properties.uais)
        : sector.properties.uais;
    const etabs = uais.map(uai => schoolsData[uai]).filter(Boolean);

    const routeBounds = new maplibregl.LngLatBounds();
    routeBounds.extend([lng, lat]);

    document.getElementById('route-loader').classList.remove('hidden');

    const routePromises = etabs.map((etab, index) => {
        const routeUrl = `/.netlify/functions/route?start=${lng},${lat}&end=${etab.lng},${etab.lat}`;

        return new Promise((resolve) => {
            $.getJSON(routeUrl)
                .done(function(response) {
                    const routeCoords = response.features[0].geometry.coordinates;
                    const duration = response.features[0].properties.summary.duration;
                    const distance = response.features[0].properties.summary.distance;

                    const time = Math.round(duration / 60);
                    const length = Math.round(distance);

                    routeCoords.forEach(coord => routeBounds.extend(coord));

                    const routeId = `route-${index}`;

                    map.addSource(routeId, {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            geometry: { type: 'LineString', coordinates: routeCoords }
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

                    const schoolEl = createPinMarker('school');
                    const schoolMarker = new maplibregl.Marker({ element: schoolEl, anchor: 'bottom' })
                        .setLngLat([etab.lng, etab.lat])
                        .addTo(map);
                    activeMarkers.push(schoolMarker);

                    const popup = new maplibregl.Popup({ closeOnClick: false })
                        .setLngLat([etab.lng, etab.lat])
                        .setHTML(infoColPath(etab.nom, etab.adresse, etab.code_postal, etab.nature_uai_libe, etab.txreussite, etab.txmention, time, length))
                        .addTo(map);
                    activePopups.push(popup);
                    resolve();
                })
                .fail(function() {
                    routeBounds.extend([etab.lng, etab.lat]);
                    const popup = new maplibregl.Popup({ closeOnClick: false })
                        .setLngLat([etab.lng, etab.lat])
                        .setHTML(infoCol(etab.nom, etab.adresse, etab.code_postal, etab.nature_uai_libe, etab.txreussite, etab.txmention))
                        .addTo(map);
                    activePopups.push(popup);
                    resolve();
                });
        });
    });

    Promise.all(routePromises).then(() => {
        document.getElementById('route-loader').classList.add('hidden');
        map.fitBounds(routeBounds, { padding: 80 });
    });
}

function renderMarkersMode(sector, mode) {
    if (!sector) {
        map.flyTo({ center: [lastSearch.lng, lastSearch.lat], zoom: 17 });
        return;
    }

    const uais = typeof sector.properties.uais === 'string'
        ? JSON.parse(sector.properties.uais)
        : sector.properties.uais;

    const bounds = new maplibregl.LngLatBounds();
    bounds.extend([lastSearch.lng, lastSearch.lat]);

    const collegeCoordKeys = new Set();

    if (mode === 'both') {
        uais.forEach(collegeUai => {
            const school = schoolsData[collegeUai];
            if (!school || !school.lng || !school.lat) return;

            collegeCoordKeys.add(`${school.lng},${school.lat}`);

            const el = createCircleMarker(COLORS_AFFECTATION.college);
            attachMarkerPopup(el, [school.lng, school.lat],
                infoCol(school.nom, school.adresse, school.code_postal, school.nature_uai_libe, school.txreussite, school.txmention));

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([school.lng, school.lat])
                .addTo(map);
            activeMarkers.push(marker);
            bounds.extend([school.lng, school.lat]);
        });
    }

    // Union lycée affectation for all college UAIs in sector
    const lyceesBySecteur = { '1': [], '2': [], '3': [] };
    uais.forEach(collegeUai => {
        const aff = lyceeAffectation[collegeUai];
        if (!aff) return;
        ['1', '2', '3'].forEach(s => {
            (aff[s] || []).forEach(uai => {
                if (!lyceesBySecteur[s].includes(uai)) {
                    lyceesBySecteur[s].push(uai);
                }
            });
        });
    });

    const secteurColors = {
        '1': COLORS_AFFECTATION.lycee1,
        '2': COLORS_AFFECTATION.lycee2,
        '3': COLORS_AFFECTATION.lycee3
    };

    ['1', '2', '3'].forEach(s => {
        lyceesBySecteur[s].forEach(uai => {
            const school = schoolsData[uai];
            if (!school || !school.lng || !school.lat) return;

            const el = createCircleMarker(secteurColors[s]);
            attachMarkerPopup(el, [school.lng, school.lat],
                infoLyc(school.nom, school.adresse, school.code_postal, school.nature_uai_libe, school.txreussite, school.txmention));

            const overlapsCollege = collegeCoordKeys.has(`${school.lng},${school.lat}`);
            const marker = new maplibregl.Marker({ element: el, ...(overlapsCollege ? { offset: [20, 0] } : {}) })
                .setLngLat([school.lng, school.lat])
                .addTo(map);
            activeMarkers.push(marker);
            bounds.extend([school.lng, school.lat]);
        });
    });

    showLegend(mode);
    map.fitBounds(bounds, { padding: 60 });
}

function renderSearchResult() {
    if (!lastSearch) return;

    clearTimeout(_hoverCloseTimer);
    clearPopups();
    clearMarkers();
    clearRoutes();
    clearLegend();
    locationMarker = null;

    const { lng, lat } = lastSearch;

    // Place home pin
    const el = createPinMarker('home');
    locationMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .setPopup(new maplibregl.Popup().setHTML(escapeHtml(lastSearch.label)))
        .addTo(map);
    activeMarkers.push(locationMarker);

    if (!activeSearchMode) {
        map.flyTo({ center: [lng, lat], zoom: 15 });
        return;
    }

    const sector = findSectorForPoint(lng, lat);

    if (activeSearchMode === 'colleges') {
        renderCollegesMode(sector, lng, lat);
    } else {
        renderMarkersMode(sector, activeSearchMode);
    }
}

function getAutocompleteConfig() {
    return {
        source: function(request, response) {
            const term = request.term.trim();
            if (term.length < 3) { response([]); return; }
            clearTimeout(_geocodeTimer);
            _geocodeTimer = setTimeout(function() { $.ajax({
                url: "https://data.geopf.fr/geocodage/search",
                dataType: "json",
                data: {
                    'q': term,
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
            clearPopups(); clearMarkers(); clearRoutes(); clearLegend();
            if (locationMarker) { locationMarker.remove(); locationMarker = null; }
            lastSearch = { lng: ui.item.lon, lat: ui.item.lat, label: ui.item.label };
            showSearchFilters();
            renderSearchResult();
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

    // Wire filter buttons (both desktop and mobile)
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            activeSearchMode = btn.dataset.mode;
            // Sync all filter buttons to same active state
            document.querySelectorAll('.filter-btn').forEach(b =>
                b.classList.toggle('active', b.dataset.mode === activeSearchMode));
            renderSearchResult();
        });
    });
}
