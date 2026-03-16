// CarteScolaire.paris — Global state, constants, and helpers

// Global state
let map;
let siteMetadata = null;
let schoolsData = null;   // keyed by UAI
let sectorsData = null;   // college sector GeoJSON (polygons only)
let activePopups = [];
let activeRoutes = [];
let activeMarkers = [];
let lastClickedSectorId = null;
let locationMarker = null;
let userLocationMarker = null;
let lyceeAffectation = null;   // { college_uai: { "1": [...], "2": [...], "3": [...] } }
let lastSearch = null;          // { lng, lat, label }
let activeSearchMode = null; // null | 'colleges' | 'both' | 'lycees'
let listViewActive = false;

const METADATA_DEFAULTS = { secto_year: '2025-2026', brevet_session: 2024, bac_annee: 2024 };
function getMeta(key) { return (siteMetadata && siteMetadata[key] != null) ? siteMetadata[key] : METADATA_DEFAULTS[key]; }

// Paris bounds
const parisBounds = [[2.27, 48.815], [2.42, 48.905]];
const parisBoundsMobile = [[2.30, 48.83], [2.39, 48.88]];

// Mobile detection helper
function isMobile() {
    return window.innerWidth < 768;
}

// Colors for affectation mode markers
const COLORS_AFFECTATION = {
    college: '#4A7FB5',
    lycee1:  '#C23B22',
    lycee2:  '#4CAF50',
    lycee3:  '#F5C518'
};

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
