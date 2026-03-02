// CarteScolaire.paris — Menu state helpers and popup HTML builders

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
        selectMenu('#colleges-btn');
    } else {
        unselectMenu('#colleges-btn');
    }

    selectMenu('#colleges-secto-btn');
    unselectMenu('#colleges-txreu-btn');
    unselectMenu('#colleges-txmention-btn');
    unselectMenu('#lycees-eg-btn');
    unselectMenu('#lycees-tech-btn');
    unselectMenu('#lycees-eg-tech-btn');
    unselectMenu('#lycees-poly-btn');
    unselectMenu('#lycees-pro-btn');
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatRate(value) {
    if (!value) return 'Non disponible';
    return value + '%';
}

const LYCEE_TYPE_LABELS = {
    'LYCEE D ENSEIGNEMENT GENERAL':                 'Lycée général',
    'LYCEE D ENSEIGNEMENT TECHNOLOGIQUE':           'Lycée technologique',
    'LYCEE ENSEIGNT GENERAL ET TECHNOLOGIQUE':      'Lycée général et technologique',
    'LYCEE POLYVALENT':                             'Lycée polyvalent',
    'LYCEE PROFESSIONNEL':                          'Lycée professionnel',
};

function formatLyceeType(type) {
    return LYCEE_TYPE_LABELS[type] || type;
}

function popupRates(txreu, txmention) {
    return '<hr style="margin:6px 0">' +
        '<div style="display:flex;gap:12px">' +
        '<span>R\u00e9ussite\u00a0<b>' + formatRate(txreu) + '</b></span>' +
        '<span>Mentions\u00a0<b>' + formatRate(txmention) + '</b></span>' +
        '</div>' +
        '<p style="margin:4px 0 0;color:#999;font-size:11px">R\u00e9sultats session 2024</p>';
}

// Generate HTML content for college popup
function infoCol(nom, adresse, codepostal, txreu, txmention) {
    return '<p style="margin:0 0 2px;font-size:13px;font-weight:bold">' + escapeHtml(nom) + '</p>' +
        '<p style="margin:0 0 4px;color:#555">' + escapeHtml(adresse) + '<br>' + escapeHtml(codepostal) + ' PARIS</p>' +
        popupRates(txreu, txmention);
}

// Generate HTML content for college popup with walking distance
function infoColPath(nom, adresse, codepostal, txreu, txmention, time, distance) {
    return '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">' +
        '<img src="./assets/img/walk.png" height="16" width="16">' +
        '<b>' + escapeHtml(String(distance)) + ' m\u00a0/\u00a0' + escapeHtml(String(time)) + ' min</b>' +
        '</div>' +
        '<p style="margin:0 0 2px;font-size:13px;font-weight:bold">' + escapeHtml(nom) + '</p>' +
        '<p style="margin:0 0 4px;color:#555">' + escapeHtml(adresse) + '<br>' + escapeHtml(codepostal) + ' PARIS</p>' +
        popupRates(txreu, txmention);
}

// Generate HTML content for lycée popup
function infoLyc(nom, adresse, codepostal, type, txreu, txmention) {
    return '<p style="margin:0 0 1px;font-size:13px;font-weight:bold">' + escapeHtml(nom) + '</p>' +
        '<p style="margin:0 0 6px;color:#888;font-size:11px">' + escapeHtml(formatLyceeType(type)) + '</p>' +
        '<p style="margin:0;color:#555">' + escapeHtml(adresse) + '<br>' + escapeHtml(codepostal) + ' PARIS</p>' +
        (txreu != null ? popupRates(txreu, txmention) : '');
}
