// CarteScolaire.paris — Global state, constants, and helpers

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
