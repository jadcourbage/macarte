// CarteScolaire.paris — Address autocomplete and walking route

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
