// CarteScolaire.paris — Entry point: event wiring and initialization

// Event handlers setup
function setupEventHandlers() {
    // College sectors
    $('#colleges-txmention-btn, #colleges-secto-btn, #colleges-txreu-btn').click(function() {
        toggleSecteurs(this);
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
            clearLegend();
            hideListToggle();
            if (locationMarker) { locationMarker.remove(); locationMarker = null; }
            input.focus();
        });
    }
    setupClearBtn('searchbox-desktop', 'clear-desktop');
    setupClearBtn('searchbox-mobile', 'clear-mobile');
    setupListView();
}

// Initialize everything when DOM is ready
$(document).ready(function() {
    initMap();
    setupAddressSearch();
    setupEventHandlers();
});
