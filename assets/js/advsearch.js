// CarteScolaire.paris — Advanced search (Recherche avancée)

const ADV_COLORS = {
    public: '#4A7FB5',
    prive:  '#C87533'
};

const COLLEGE_UAI_CODE = 340;
const LYCEE_UAI_CODES  = [300, 301, 302, 306, 320];
const DIST_VALUES      = [null, 0.5, 1, 2, 5]; // km; null = no limit

function initAdvancedSearch() {
    // Mode tab strip
    document.addEventListener('click', function(e) {
        const tab = e.target.closest('.mode-tab');
        if (!tab) return;
        if (tab.dataset.modeTab === 'advsearch') showAdvancedMode();
        else if (tab.dataset.modeTab === 'secteur') showSecteurMode();
    });

    // Type buttons
    document.addEventListener('click', function(e) {
        const btn = e.target.closest('.advsearch-type-btn');
        if (!btn) return;
        advSearchState.type = btn.dataset.type;
        document.querySelectorAll('.advsearch-type-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.type === advSearchState.type));
        scheduleApply();
    });

    // Sector buttons (multi-toggle, no "Tous")
    document.addEventListener('click', function(e) {
        const btn = e.target.closest('.advsearch-sector-btn');
        if (!btn) return;
        const sec = btn.dataset.sector;
        const idx = advSearchState.sectors.indexOf(sec);
        if (idx >= 0) advSearchState.sectors.splice(idx, 1);
        else advSearchState.sectors.push(sec);
        document.querySelectorAll('.advsearch-sector-btn').forEach(b =>
            b.classList.toggle('active', advSearchState.sectors.includes(b.dataset.sector)));
        scheduleApply();
    });

    // Distance sliders (discrete: 0=all, 1=500m, 2=1km, 3=2km, 4=5km)
    ['advsearch-dist-desktop', 'advsearch-dist-mobile'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        function onDistChange() {
            advSearchState.maxDist = DIST_VALUES[parseInt(this.value)];
            ['advsearch-dist-desktop', 'advsearch-dist-mobile'].forEach(sid => {
                const s = document.getElementById(sid);
                if (s && s !== this) s.value = this.value;
            });
            scheduleApply();
        }
        el.addEventListener('input', onDistChange);
        el.addEventListener('change', onDistChange);
    });

    // Réussite sliders — listen to both 'input' and 'change' (iOS Safari
    // may only fire 'change' for touch-driven range interactions)
    ['advsearch-reussite-desktop', 'advsearch-reussite-mobile'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        function onReussiteChange() {
            advSearchState.minReussite = parseInt(this.value);
            ['advsearch-reussite-desktop', 'advsearch-reussite-mobile'].forEach(sid => {
                const s = document.getElementById(sid);
                if (s && s !== this) s.value = this.value;
            });
            ['advsearch-reussite-val-desktop', 'advsearch-reussite-val-mobile'].forEach(vid => {
                const v = document.getElementById(vid);
                if (v) v.textContent = this.value + '%';
            });
            scheduleApply();
        }
        el.addEventListener('input', onReussiteChange);
        el.addEventListener('change', onReussiteChange);
    });

    // Mention sliders
    ['advsearch-mention-desktop', 'advsearch-mention-mobile'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        function onMentionChange() {
            advSearchState.minMention = parseInt(this.value);
            ['advsearch-mention-desktop', 'advsearch-mention-mobile'].forEach(sid => {
                const s = document.getElementById(sid);
                if (s && s !== this) s.value = this.value;
            });
            ['advsearch-mention-val-desktop', 'advsearch-mention-val-mobile'].forEach(vid => {
                const v = document.getElementById(vid);
                if (v) v.textContent = this.value + '%';
            });
            scheduleApply();
        }
        el.addEventListener('input', onMentionChange);
        el.addEventListener('change', onMentionChange);
    });

    // Advsearch list toggle buttons
    ['list-toggle-advsearch-desktop', 'list-toggle-advsearch-mobile'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', toggleAdvListView);
    });

    // Mobile sheet: filters toggle + close
    document.getElementById('advsearch-filters-toggle')?.addEventListener('click', toggleAdvSheet);
    document.getElementById('advsearch-sheet-close-btn')?.addEventListener('click', closeAdvSheet);

    // Sheet list toggle: close filter sheet, then open list
    document.getElementById('list-toggle-advsearch-sheet')?.addEventListener('click', () => {
        closeAdvSheet();
        toggleAdvListView();
    });
}

// ====================================
// Mode switching
// ====================================

function showAdvancedMode() {
    if (!lastSearch) return;
    advSearchActive = true;

    document.querySelectorAll('.mode-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.modeTab === 'advsearch'));

    // Desktop: swap panels
    document.getElementById('secteur-filters-desktop')?.classList.add('hidden');
    document.getElementById('advsearch-panel-desktop')?.classList.remove('hidden');

    // Mobile: show compact status bar; open filter sheet
    document.getElementById('secteur-filters-mobile')?.classList.add('hidden');
    document.getElementById('advsearch-status-mobile')?.classList.remove('hidden');
    if (isMobile()) openAdvSheet();

    // Clear secteur state
    clearPopups();
    clearMarkers();
    clearRoutes();
    clearLegend();
    hideListToggle();
    listViewActive = false;
    locationMarker = null;

    // Re-place home pin
    const el = createPinMarker('home');
    locationMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([lastSearch.lng, lastSearch.lat])
        .setPopup(new maplibregl.Popup().setHTML(escapeHtml(lastSearch.label)))
        .addTo(map);
    activeMarkers.push(locationMarker);

    applyAdvancedFilters();
}

function showSecteurMode() {
    advSearchActive = false;

    document.querySelectorAll('.mode-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.modeTab === 'secteur'));

    // Desktop
    document.getElementById('secteur-filters-desktop')?.classList.remove('hidden');
    document.getElementById('advsearch-panel-desktop')?.classList.add('hidden');

    // Mobile
    document.getElementById('secteur-filters-mobile')?.classList.remove('hidden');
    document.getElementById('advsearch-status-mobile')?.classList.add('hidden');
    closeAdvSheet();

    clearAdvancedResults();
    listViewActive = false;
    hideListPanel();
    syncAllListToggleButtons();
    renderSearchResult();
}

// ====================================
// Mobile sheet
// ====================================

function openAdvSheet() {
    document.getElementById('advsearch-sheet-mobile')?.classList.add('open');
    document.getElementById('advsearch-filters-toggle')?.classList.add('sheet-open');
}

function closeAdvSheet() {
    document.getElementById('advsearch-sheet-mobile')?.classList.remove('open');
    document.getElementById('advsearch-filters-toggle')?.classList.remove('sheet-open');
}

function toggleAdvSheet() {
    const sheet = document.getElementById('advsearch-sheet-mobile');
    if (sheet?.classList.contains('open')) closeAdvSheet();
    else openAdvSheet();
}

// ====================================
// Filter application
// ====================================

function applyAdvancedFilters() {
    if (!schoolsData) return;
    const { type, maxDist, sectors, minReussite, minMention } = advSearchState;
    const uaiCodes = type === 'college' ? [COLLEGE_UAI_CODE] : LYCEE_UAI_CODES;
    const allEntries = Object.entries(schoolsData);

    // Pre-rate filter: type + sector + distance
    function passesPreRate([uai, school]) {
        if (!uaiCodes.includes(school.nature_uai)) return false;
        if (!school.lng || !school.lat) return false;
        // Sector: 0 or 2 selected = all; 1 selected = filter
        if (sectors.length === 1) {
            const s = sectors[0];
            if (s === 'Public' && school.secteur_public_prive_libe !== 'Public') return false;
            if (s === 'Privé' && school.secteur_public_prive_libe === 'Public') return false;
        }
        if (maxDist != null && lastSearch) {
            const d = turf.distance(
                [lastSearch.lng, lastSearch.lat],
                [school.lng, school.lat],
                { units: 'kilometers' }
            );
            if (d > maxDist) return false;
        }
        return true;
    }

    const preRateEntries = allEntries.filter(passesPreRate);

    // Full filter: also apply rate thresholds
    let results = preRateEntries
        .filter(([uai, school]) => {
            if (advSearchState.minReussite > 0) {
                if (school.txreussite == null || school.txreussite < advSearchState.minReussite) return false;
            }
            if (advSearchState.minMention > 0) {
                if (school.txmention == null || school.txmention < advSearchState.minMention) return false;
            }
            return true;
        })
        .map(([uai, school]) => {
            const dist = lastSearch
                ? turf.distance([lastSearch.lng, lastSearch.lat], [school.lng, school.lat], { units: 'kilometers' })
                : Infinity;
            return { uai, school, dist };
        })
        .sort((a, b) => a.dist - b.dist);

    const totalCount = results.length;
    const capped = results.length > 200;
    if (capped) results = results.slice(0, 200);
    _lastAdvResults = results;

    advSearchMarkers.forEach(m => m.remove());
    advSearchMarkers = [];
    renderAdvancedMarkers(results);

    let counterText = '';
    if (totalCount === 0) {
        counterText = 'Aucun établissement';
    } else if (capped) {
        counterText = `${results.length} premiers résultats sur ${totalCount}`;
    } else {
        counterText = `${totalCount} établissement${totalCount > 1 ? 's' : ''}`;
    }
    document.querySelectorAll('.advsearch-counter').forEach(el => el.textContent = counterText);

    const hasResults = results.length > 0;
    ['list-toggle-advsearch-desktop', 'list-toggle-advsearch-mobile', 'list-toggle-advsearch-sheet'].forEach(id =>
        document.getElementById(id)?.classList.toggle('hidden', !hasResults));
    syncAllListToggleButtons();

    if (listViewActive) {
        showListPanel(buildAdvancedListHtml(results));
        if (isMobile()) attachMobileAdvListClickHandlers();
        else attachAdvancedListHandlers();
    }
}


function scheduleApply() {
    clearTimeout(advSearchDebounceTimer);
    advSearchDebounceTimer = setTimeout(applyAdvancedFilters, 200);
}

// ====================================
// Markers
// ====================================

function renderAdvancedMarkers(results) {
    const bounds = new maplibregl.LngLatBounds();
    if (lastSearch) bounds.extend([lastSearch.lng, lastSearch.lat]);

    results.forEach(({ uai, school }) => {
        const isPublic = school.secteur_public_prive_libe === 'Public';
        const color = isPublic ? ADV_COLORS.public : ADV_COLORS.prive;
        const el = createCircleMarker(color);
        const isCollege = school.nature_uai === COLLEGE_UAI_CODE;
        const popupHtml = isCollege
            ? infoCol(school.nom, school.adresse, school.code_postal, school.nature_uai_libe, school.txreussite, school.txmention, school.brevet_session)
            : infoLyc(school.nom, school.adresse, school.code_postal, school.nature_uai_libe, school.txreussite, school.txmention, school.bac_annee);
        attachMarkerPopup(el, [school.lng, school.lat], popupHtml);
        const marker = new maplibregl.Marker({ element: el })
            .setLngLat([school.lng, school.lat])
            .addTo(map);
        marker._uai = uai;
        advSearchMarkers.push(marker);
        bounds.extend([school.lng, school.lat]);
    });

    if (results.length > 0) {
        map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
    } else if (lastSearch) {
        map.flyTo({ center: [lastSearch.lng, lastSearch.lat], zoom: 14 });
    }
    document.getElementById('advsearch-legend')?.classList.remove('hidden');
}

function clearAdvancedResults() {
    advSearchMarkers.forEach(m => m.remove());
    advSearchMarkers = [];
    _lastAdvResults = [];
    document.getElementById('advsearch-legend')?.classList.add('hidden');
    ['list-toggle-advsearch-desktop', 'list-toggle-advsearch-mobile', 'list-toggle-advsearch-sheet'].forEach(id =>
        document.getElementById(id)?.classList.add('hidden'));
    document.querySelectorAll('.advsearch-counter').forEach(el => el.textContent = '');
}

// ====================================
// List view
// ====================================

function buildAdvancedListHtml(results) {
    if (results.length === 0) {
        return `<div class="list-card"><p class="list-card-name" style="color:#999">Aucun établissement trouvé</p></div>`;
    }
    return results.map(({ uai, school, dist }) => {
        const isPublic = school.secteur_public_prive_libe === 'Public';
        const color = isPublic ? ADV_COLORS.public : ADV_COLORS.prive;
        const isCollege = school.nature_uai === COLLEGE_UAI_CODE;
        return listCardHtml(school, color, isCollege ? 'brevet' : 'bac', isFinite(dist) ? dist : null, uai);
    }).join('');
}

function attachAdvancedListHandlers() {
    let lastHighlightedEl = null;

    function clearHighlight() {
        if (lastHighlightedEl) {
            lastHighlightedEl.classList.remove('marker-highlight');
            lastHighlightedEl = null;
        }
    }

    function highlightByUai(uai) {
        clearHighlight();
        const marker = advSearchMarkers.find(m => m._uai === uai);
        if (!marker) return;
        lastHighlightedEl = marker.getElement();
        lastHighlightedEl.classList.add('marker-highlight');
    }

    document.querySelectorAll('#list-panel-desktop-content .list-card[data-uai]').forEach(card => {
        const uai = card.dataset.uai;
        const lng = parseFloat(card.dataset.lng);
        const lat = parseFloat(card.dataset.lat);
        card.addEventListener('mouseenter', () => highlightByUai(uai));
        card.addEventListener('mouseleave', clearHighlight);
        card.addEventListener('click', () => {
            const marker = advSearchMarkers.find(m => m._uai === uai);
            if (marker) {
                highlightByUai(uai);
                clearSelectedSchoolMarker();
            } else {
                placeSelectedSchoolMarker(uai, lng, lat);
            }
            map.flyTo({ center: [lng, lat], zoom: 16, speed: 1.5 });
        });
    });
}

function attachMobileAdvListClickHandlers() {
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

function toggleAdvListView() {
    listViewActive = !listViewActive;
    syncAllListToggleButtons();
    if (!listViewActive) { hideListPanel(); return; }
    showListPanel(buildAdvancedListHtml(_lastAdvResults));
    if (isMobile()) attachMobileAdvListClickHandlers();
    else attachAdvancedListHandlers();
}

function syncAllListToggleButtons() {
    syncListToggleButtons();
    ['list-toggle-advsearch-desktop', 'list-toggle-advsearch-mobile', 'list-toggle-advsearch-sheet'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn || btn.classList.contains('hidden')) return;
        btn.querySelector('i').className = listViewActive ? 'fa fa-map' : 'fa fa-list';
        btn.childNodes[btn.childNodes.length - 1].textContent = listViewActive ? ' Carte' : ' Liste';
        btn.classList.toggle('active', listViewActive);
    });
}

// ====================================
// Reset
// ====================================

function resetAdvancedMode() {
    advSearchActive = false;
    clearAdvancedResults();
    closeAdvSheet();

    document.querySelectorAll('.mode-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.modeTab === 'secteur'));
    document.getElementById('secteur-filters-desktop')?.classList.remove('hidden');
    document.getElementById('advsearch-panel-desktop')?.classList.add('hidden');
    document.getElementById('secteur-filters-mobile')?.classList.remove('hidden');
    document.getElementById('advsearch-status-mobile')?.classList.add('hidden');

    advSearchState = { type: 'college', maxDist: null, sectors: [], minReussite: 50, minMention: 0 };

    document.querySelectorAll('.advsearch-type-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.type === 'college'));
    document.querySelectorAll('.advsearch-sector-btn').forEach(b =>
        b.classList.remove('active'));
    ['advsearch-dist-desktop', 'advsearch-dist-mobile'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = 0;
    });
    ['advsearch-reussite-desktop', 'advsearch-reussite-mobile'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = 50;
    });
    ['advsearch-mention-desktop', 'advsearch-mention-mobile'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = 0;
    });
    ['advsearch-reussite-val-desktop', 'advsearch-reussite-val-mobile'].forEach(id => {
        const el = document.getElementById(id); if (el) el.textContent = '50%';
    });
    ['advsearch-mention-val-desktop', 'advsearch-mention-val-mobile'].forEach(id => {
        const el = document.getElementById(id); if (el) el.textContent = '0%';
    });
}
