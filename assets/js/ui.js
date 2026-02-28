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
