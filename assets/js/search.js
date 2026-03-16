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

function setSearchLoading(loading) {
    document.querySelectorAll('.search-icon').forEach(el => {
        el.className = loading
            ? 'fa fa-spinner fa-spin search-icon'
            : 'fa fa-search search-icon';
    });
}

function showSearchFilters() {
    // Set sectorisation year in tab (uses metadata if loaded, else default)
    document.querySelectorAll('.mode-tab[data-mode-tab="secteur"]').forEach(t => {
        t.textContent = `Sectorisation ${getMeta('secto_year')}`;
    });
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
                        .setHTML(infoColPath(etab.nom, etab.adresse, etab.code_postal, etab.nature_uai_libe, etab.txreussite, etab.txmention, time, length, etab.brevet_session))
                        .addTo(map);
                    activePopups.push(popup);
                    resolve();
                })
                .fail(function() {
                    routeBounds.extend([etab.lng, etab.lat]);
                    const popup = new maplibregl.Popup({ closeOnClick: false })
                        .setLngLat([etab.lng, etab.lat])
                        .setHTML(infoCol(etab.nom, etab.adresse, etab.code_postal, etab.nature_uai_libe, etab.txreussite, etab.txmention, etab.brevet_session))
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

function getAffectationData(sector) {
    if (!sector) return { colleges: [], lyceesBySecteur: { '1': [], '2': [], '3': [] } };
    const uais = typeof sector.properties.uais === 'string'
        ? JSON.parse(sector.properties.uais) : sector.properties.uais;
    const colleges = uais.map(uai => schoolsData[uai]).filter(Boolean);
    const lyceesBySecteur = { '1': [], '2': [], '3': [] };
    uais.forEach(collegeUai => {
        const aff = lyceeAffectation[collegeUai];
        if (!aff) return;
        ['1', '2', '3'].forEach(s => {
            (aff[s] || []).forEach(uai => {
                if (!lyceesBySecteur[s].includes(uai)) lyceesBySecteur[s].push(uai);
            });
        });
    });
    return { colleges, lyceesBySecteur };
}

function renderMarkersMode(sector, mode) {
    if (!sector) {
        map.flyTo({ center: [lastSearch.lng, lastSearch.lat], zoom: 17 });
        return;
    }

    const { colleges, lyceesBySecteur } = getAffectationData(sector);

    const bounds = new maplibregl.LngLatBounds();
    bounds.extend([lastSearch.lng, lastSearch.lat]);

    const collegeCoordKeys = new Set();

    if (mode === 'both') {
        colleges.forEach(school => {
            if (!school.lng || !school.lat) return;
            collegeCoordKeys.add(`${school.lng},${school.lat}`);
            const el = createCircleMarker(COLORS_AFFECTATION.college);
            attachMarkerPopup(el, [school.lng, school.lat],
                infoCol(school.nom, school.adresse, school.code_postal, school.nature_uai_libe, school.txreussite, school.txmention, school.brevet_session));
            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([school.lng, school.lat])
                .addTo(map);
            activeMarkers.push(marker);
            bounds.extend([school.lng, school.lat]);
        });
    }

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
                infoLyc(school.nom, school.adresse, school.code_postal, school.nature_uai_libe, school.txreussite, school.txmention, school.bac_annee));
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

function placeHomePin(lng, lat, label) {
    clearTimeout(_hoverCloseTimer);
    clearPopups();
    clearMarkers();
    clearRoutes();
    clearLegend();
    locationMarker = null;
    const el = createPinMarker('home');
    locationMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .setPopup(new maplibregl.Popup().setHTML(escapeHtml(label)))
        .addTo(map);
    activeMarkers.push(locationMarker);
}

function showSecteurListToggle() { showListToggle(); }

function renderSearchResult() {
    if (!lastSearch) return;

    listViewActive = false;
    hideListPanel();
    syncAllListToggleButtons();

    const { lng, lat, label } = lastSearch;
    placeHomePin(lng, lat, label);

    if (advSearchActive) {
        applyAdvancedFilters();
        return;
    }

    if (!activeSearchMode) {
        map.flyTo({ center: [lng, lat], zoom: 15 });
        showSecteurListToggle();
        return;
    }

    const sector = findSectorForPoint(lng, lat);
    activeSearchMode === 'colleges'
        ? renderCollegesMode(sector, lng, lat)
        : renderMarkersMode(sector, activeSearchMode);

    showSecteurListToggle();
}

// ====================================
// List View
// ====================================

function formatDist(km) {
    if (km < 1) return Math.round(km * 1000) + '\u00a0m';
    return km.toFixed(1).replace('.', ',') + '\u00a0km';
}

function listCardHtml(school, borderColor, examLabel, distance, uai) {
    const borderStyle = borderColor ? `border-left: 4px solid ${borderColor};` : '';
    const coordAttrs = (school.lng != null && school.lat != null)
        ? ` data-lng="${school.lng}" data-lat="${school.lat}"` : '';
    const uaiAttr = uai ? ` data-uai="${uai}"` : '';
    const distHtml = distance != null
        ? ` <span class="list-card-dist">(${formatDist(distance)})</span>` : '';
    const hasResults = school.txreussite != null;
    const examYear = (examLabel === 'bac' ? school.bac_annee : school.brevet_session)
        || (examLabel === 'bac' ? getMeta('bac_annee') : getMeta('brevet_session'))
        || '';
    const resultsHtml = hasResults
        ? `<div class="list-card-rates">
             <span>R\u00e9ussite&#160;<b>${formatRate(school.txreussite)}</b></span>
             <span>Mentions&#160;<b>${formatRate(school.txmention)}</b></span>
           </div>
           <p class="list-card-exam-label">R\u00e9sultats ${escapeHtml(examLabel)} ${examYear}</p>` : '';
    return `<div class="list-card" style="${borderStyle}"${coordAttrs}${uaiAttr}>
      <p class="list-card-name">${escapeHtml(school.nom)}${distHtml}</p>
      <p class="list-card-type">${escapeHtml(formatSchoolType(school.nature_uai_libe))}</p>
      <p class="list-card-address">${escapeHtml(school.adresse)}, ${escapeHtml(school.code_postal)} Paris</p>
      ${resultsHtml}
    </div>`;
}

function buildListHtml(data, mode) {
    const effectiveMode = mode || 'both';
    mode = effectiveMode;
    let html = '';
    const secteurColors = {
        '1': COLORS_AFFECTATION.lycee1,
        '2': COLORS_AFFECTATION.lycee2,
        '3': COLORS_AFFECTATION.lycee3
    };
    const secteurLabels = {
        '1': 'Lyc\u00e9es \u2014 secteur 1',
        '2': 'Lyc\u00e9es \u2014 secteur 2',
        '3': 'Lyc\u00e9es \u2014 secteur 3'
    };

    function distFrom(school) {
        if (!school || school.lng == null || school.lat == null || !lastSearch) return Infinity;
        return turf.distance([lastSearch.lng, lastSearch.lat], [school.lng, school.lat], { units: 'kilometers' });
    }

    if (mode === 'colleges' || mode === 'both') {
        const borderColor = mode === 'both' ? COLORS_AFFECTATION.college : null;
        html += `<div class="list-section-header" style="border-left: 4px solid ${COLORS_AFFECTATION.college};">Coll\u00e8ge</div>`;
        if (data.colleges.length === 0) {
            html += `<div class="list-card"><p class="list-card-name" style="color:#999">Aucun coll\u00e8ge trouv\u00e9</p></div>`;
        } else {
            [...data.colleges].sort((a, b) => distFrom(a) - distFrom(b)).forEach(school => {
                const d = distFrom(school);
                const uai = Object.keys(schoolsData).find(k => schoolsData[k] === school);
                html += listCardHtml(school, borderColor, 'brevet', isFinite(d) ? d : null, uai);
            });
        }
    }

    if (mode === 'both' || mode === 'lycees') {
        ['1', '2', '3'].forEach(s => {
            if (data.lyceesBySecteur[s].length === 0) return;
            html += `<div class="list-section-header" style="border-left: 4px solid ${secteurColors[s]};">${secteurLabels[s]}</div>`;
            [...data.lyceesBySecteur[s]]
                .sort((a, b) => distFrom(schoolsData[a]) - distFrom(schoolsData[b]))
                .forEach(uai => {
                    const school = schoolsData[uai];
                    if (!school) return;
                    const d = distFrom(school);
                    html += listCardHtml(school, secteurColors[s], 'bac', isFinite(d) ? d : null, uai);
                });
        });
    }

    return html || `<div class="list-card"><p class="list-card-name" style="color:#999">Aucune donn\u00e9e disponible</p></div>`;
}

function placeSelectedSchoolMarker(uai, lng, lat) {
    clearSelectedSchoolMarker();
    const school = schoolsData[uai];
    if (!school) return;
    const isCollege = school.nature_uai === 340;
    const el = createPinMarker('school');
    const html = isCollege
        ? infoCol(school.nom, school.adresse, school.code_postal, school.nature_uai_libe, school.txreussite, school.txmention, school.brevet_session)
        : infoLyc(school.nom, school.adresse, school.code_postal, school.nature_uai_libe, school.txreussite, school.txmention, school.bac_annee);
    const popup = new maplibregl.Popup({ closeOnClick: false, offset: 38 })
        .setHTML(html);
    selectedSchoolMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map);
    selectedSchoolMarker.togglePopup();
}

function attachListHoverHandlers() {
    let lastHighlightedEl = null;

    function clearHighlight() {
        if (lastHighlightedEl) {
            lastHighlightedEl.classList.remove('marker-highlight');
            lastHighlightedEl = null;
        }
    }

    function highlightAtCoords(lng, lat) {
        clearHighlight();
        const marker = activeMarkers.find(m => {
            const pos = m.getLngLat();
            return Math.abs(pos.lng - lng) < 0.00005 && Math.abs(pos.lat - lat) < 0.00005;
        });
        if (!marker) return;
        lastHighlightedEl = marker.getElement();
        lastHighlightedEl.classList.add('marker-highlight');
    }

    document.querySelectorAll('#list-panel-desktop-content .list-card[data-lng]').forEach(card => {
        const lng = parseFloat(card.dataset.lng);
        const lat = parseFloat(card.dataset.lat);
        const uai = card.dataset.uai;
        card.addEventListener('mouseenter', () => highlightAtCoords(lng, lat));
        card.addEventListener('mouseleave', clearHighlight);
        card.addEventListener('click', () => {
            const existingMarker = activeMarkers.find(m => {
                const pos = m.getLngLat();
                return Math.abs(pos.lng - lng) < 0.00005 && Math.abs(pos.lat - lat) < 0.00005;
            });
            if (existingMarker) {
                highlightAtCoords(lng, lat);
                clearSelectedSchoolMarker();
            } else if (uai) {
                placeSelectedSchoolMarker(uai, lng, lat);
            }
            map.flyTo({ center: [lng, lat], zoom: 16, speed: 1.5 });
        });
    });
}

function refitBoundsForListPanel() {
    const schoolMarkers = activeMarkers.filter(m => m !== locationMarker);
    if (schoolMarkers.length === 0) return;
    const bounds = new maplibregl.LngLatBounds();
    activeMarkers.forEach(m => bounds.extend(m.getLngLat()));
    const panelWidth = document.getElementById('list-panel-desktop')?.offsetWidth || 400;
    map.fitBounds(bounds, {
        padding: { left: panelWidth + 32, top: 80, right: 80, bottom: 80 },
        maxZoom: 14
    });
}

function attachMobileListClickHandlers() {
    document.querySelectorAll('#list-panel-mobile-content .list-card[data-lng]').forEach(card => {
        const lng = parseFloat(card.dataset.lng);
        const lat = parseFloat(card.dataset.lat);
        const uai = card.dataset.uai;
        card.addEventListener('click', () => {
            hideListPanel();
            listViewActive = false;
            syncAllListToggleButtons();
            if (uai) placeSelectedSchoolMarker(uai, lng, lat);
            map.flyTo({ center: [lng, lat], zoom: 16, speed: 1.5 });
        });
    });
}

function showListPanel(html) {
    if (isMobile()) {
        document.getElementById('list-panel-mobile-content').innerHTML = html;
        document.getElementById('list-panel-mobile').classList.add('open');
        requestAnimationFrame(() => document.getElementById('list-panel-backdrop').classList.add('open'));
        attachMobileListClickHandlers();
    } else {
        document.getElementById('list-panel-desktop-content').innerHTML = html;
        document.getElementById('list-panel-desktop').classList.remove('hidden');
        attachListHoverHandlers();
        refitBoundsForListPanel();
    }
}

function hideListPanel() {
    document.getElementById('list-panel-desktop').classList.add('hidden');
    document.getElementById('list-panel-mobile').classList.remove('open');
    document.getElementById('list-panel-backdrop').classList.remove('open');
}

function showListToggle() {
    document.getElementById('list-toggle-desktop').classList.remove('hidden');
    document.getElementById('list-toggle-mobile').classList.remove('hidden');
}

function hideListToggle() {
    listViewActive = false;
    hideListPanel();
    document.getElementById('list-toggle-desktop').classList.add('hidden');
    document.getElementById('list-toggle-mobile').classList.add('hidden');
}

function syncListToggleButtons() {
    ['list-toggle-desktop', 'list-toggle-mobile'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.querySelector('i').className = listViewActive ? 'fa fa-map' : 'fa fa-list';
        btn.childNodes[btn.childNodes.length - 1].textContent = listViewActive ? ' Carte' : ' Liste';
        btn.classList.toggle('active', listViewActive);
    });
}

function toggleListView() {
    listViewActive = !listViewActive;
    syncAllListToggleButtons();
    if (!listViewActive) { hideListPanel(); return; }
    const sector = findSectorForPoint(lastSearch.lng, lastSearch.lat);
    showListPanel(buildListHtml(getAffectationData(sector), activeSearchMode));
}

function setupListView() {
    document.getElementById('list-sheet-close-btn')?.addEventListener('click', () => {
        listViewActive = false;
        syncAllListToggleButtons();
        hideListPanel();
    });
    document.getElementById('list-panel-backdrop')?.addEventListener('click', () => {
        listViewActive = false;
        syncAllListToggleButtons();
        hideListPanel();
    });
}

function getAutocompleteConfig() {
    return {
        source: function(request, response) {
            const term = request.term.trim();
            if (term.length < 3) { response([]); return; }
            clearTimeout(_geocodeTimer);
            _geocodeTimer = setTimeout(function() {
                setSearchLoading(true);
                $.ajax({
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
                    },
                    complete: function() {
                        setSearchLoading(false);
                    }
                });
            }, 250);
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

    // Wire filter buttons (both desktop and mobile) — independent toggles
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const nowActive = !btn.classList.contains('active');
            // Sync desktop + mobile buttons for this mode
            document.querySelectorAll(`.filter-btn[data-mode="${btn.dataset.mode}"]`).forEach(b =>
                b.classList.toggle('active', nowActive));
            // Derive combined mode from current active state
            const colActive = !!document.querySelector('.filter-btn[data-mode="colleges"].active');
            const lycActive = !!document.querySelector('.filter-btn[data-mode="lycees"].active');
            if (colActive && lycActive) activeSearchMode = 'both';
            else if (colActive) activeSearchMode = 'colleges';
            else if (lycActive) activeSearchMode = 'lycees';
            else activeSearchMode = null;
            renderSearchResult();
        });
    });

    // Wire list toggle buttons
    ['list-toggle-desktop', 'list-toggle-mobile'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', toggleListView);
    });
}
