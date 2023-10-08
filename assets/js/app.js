$(window).resize(function () {
    sizeLayerControl();
});

$(document).on("click", ".feature-row", function (e) {
    $(document).off("mouseout", ".feature-row", clearHighlight);
    sidebarClick(parseInt($(this).attr("id"), 10));
});

if (!("ontouchstart" in window)) {
    $(document).on("mouseover", ".feature-row", function (e) {
        highlight.clearLayers().addLayer(L.circleMarker([$(this).attr("lat"), $(this).attr("lng")], highlightStyle));
    });
}

$(document).on("mouseout", ".feature-row", clearHighlight);

$("#about-btn").click(function () {
    $("#aboutModal").modal("show");
    $(".navbar-collapse.in").collapse("hide");
    return false;
});



/*On evite de collapser le dropdown au click*/
$('.dropdown-menu').on('click', function (event) {
    if (jQuery(window).height() > 700) {
        event.stopPropagation();
    }
});

/* Gestion des événements */

/* Format CSS lorsqu'une entrée est sélectionnée */

var selectedFormat = {
    'font-weight': 'bold',
    'background-color': '#D9D9DB'
}

var notSelectedFormat = {
    'font-weight': 'normal',
    'background-color': 'transparent'
}

var touchControl = {
    'width': '30px',
    'height': '30px'
}


/*Initialisation des menus */
if (jQuery(window).height() > 700) {
    $('#colleges-btn').data('selected', true);
} else {
    $('#colleges-btn').data('selected', false);
    $('#colleges-btn').css(notSelectedFormat);
}

$('#colleges-secto-btn').data('selected', true);
$('#colleges-txreu-btn').data('selected', false);
$('#colleges-txmention-btn').data('selected', false);
$('#lycees-secto-btn').data('selected', false);
$('#lycees-eg-btn').data('selected', false);
$('#lycees-tech-btn').data('selected', false);
$('#lycees-eg-tech-btn').data('selected', false);
$('#lycees-poly-btn').data('selected', false);
$('#lycees-pro-btn').data('selected', false);


function unselectMenu(item) {
    $(item).data('selected', false);
    $(item).css(notSelectedFormat);
}

function selectMenu(item) {
    $(item).data('selected', true);
    $(item).css(selectedFormat);
}

function toggleMenu(item) {
    var selected = $(item).data('selected');

    if (selected) {
        unselectMenu(item);
    } else {
        selectMenu(item);
    }
}


function toggleLayer(item) {

    var selected = $(item).data('selected');

    if (item.id == 'colleges-btn') {
        if (selected) {
            map.removeLayer(colleges);
        } else {
            map.addLayer(colleges);
        }
        toggleMenu(item);
    }

    if (item.id == 'lycees-eg-btn') {
        if (selected) {
            map.removeLayer(lycees_eg);
        } else {
            map.addLayer(lycees_eg);
        }
        toggleMenu(item);
    }

    if (item.id == 'lycees-tech-btn') {
        if (selected) {
            map.removeLayer(lycees_tech);
        } else {
            map.addLayer(lycees_tech);
        }
        toggleMenu(item);
    }

    if (item.id == 'lycees-eg-tech-btn') {
        if (selected) {
            map.removeLayer(lycees_eg_tech);
        } else {
            map.addLayer(lycees_eg_tech);
        }
        toggleMenu(item);
    }

    if (item.id == 'lycees-poly-btn') {
        if (selected) {
            map.removeLayer(lycees_poly);
        } else {
            map.addLayer(lycees_poly);
        }
        toggleMenu(item);
    }

    if (item.id == 'lycees-pro-btn') {
        if (selected) {
            map.removeLayer(lycees_pro);
        } else {
            map.addLayer(lycees_pro);
        }
        toggleMenu(item);
    }


}


function toggleSecteurs(item) {

    var selected = $(item).data('selected');
    var layerExiste = map.hasLayer(colSecteurs);

    if (selected) {
        toggleMenu(item);
        map.removeLayer(colSecteurs);
    } else {

        map.removeLayer(lycSecteurs);

        if (item.id == 'colleges-secto-btn') {
            toggleMenu(item);
            unselectMenu(document.getElementById("colleges-txreu-btn"));
            unselectMenu(document.getElementById("colleges-txmention-btn"));
            unselectMenu(document.getElementById("lycees-secto-btn"));
            if (layerExiste) {
                colSecteurs.setStyle(style);
            } else {
                map.addLayer(colSecteurs);
                colSecteurs.setStyle(style);
            }
        }

        if (item.id == 'colleges-txreu-btn') {
            toggleMenu(item);
            unselectMenu(document.getElementById("colleges-secto-btn"));
            unselectMenu(document.getElementById("colleges-txmention-btn"));
            unselectMenu(document.getElementById("lycees-secto-btn"));
            if (layerExiste) {
                colSecteurs.setStyle(styleres);
            } else {
                map.addLayer(colSecteurs);
                colSecteurs.setStyle(styleres);
            }
        }

        if (item.id == 'colleges-txmention-btn') {
            toggleMenu(item);
            unselectMenu(document.getElementById("colleges-secto-btn"));
            unselectMenu(document.getElementById("colleges-txreu-btn"));
            unselectMenu(document.getElementById("lycees-secto-btn"));
            if (layerExiste) {
                colSecteurs.setStyle(stylemention);
            } else {
                map.addLayer(colSecteurs);
                colSecteurs.setStyle(stylemention);
            }
        }
    }
}


function toggleSecteursLyc(item) {

    var selected = $(item).data('selected');

    if (selected) {
        toggleMenu(item);
        map.removeLayer(lycSecteurs);
    } else {
        toggleMenu(item);
        unselectMenu(document.getElementById("colleges-secto-btn"));
        unselectMenu(document.getElementById("colleges-txreu-btn"));
        unselectMenu(document.getElementById("colleges-txmention-btn"));
        map.removeLayer(colSecteurs);
        map.addLayer(lycSecteurs);
    }
}

$('#colleges-txmention-btn, #colleges-secto-btn, #colleges-txreu-btn').click(function () {
    toggleSecteurs(this);
});

$('#colleges-btn, #lycees-eg-btn, #lycees-tech-btn, #lycees-eg-tech-btn, #lycees-poly-btn, #lycees-pro-btn').click(function () {
    toggleLayer(this);
});

$('#lycees-secto-btn').click(function () {
    toggleSecteursLyc(this);
});


$("#nav-btn").click(function () {
    $(".navbar-collapse").collapse("toggle");
    return false;
});



function clearHighlight() {
    highlight.clearLayers();
}

/* Génère le contenu HTML avec les infos sur un collège*/
function infoCol(nom, adresse, codepostal, txreu, txmention) {
    return '<h4></h4>' +
        '<b>' + nom + '</b><br/>' +
        adresse + '<br/> ' + codepostal + ' PARIS <br/>' +
        '<b>Taux de r&eacute;ussite* : </b>' + ((txreu == 999) ? "N/A" : txreu + '%') + '<br/>' +
        '<b>Taux de mentions* : </b>' + ((txmention == 999) ? "N/A" : txmention + '%') + '<br/>' +
        '*2021';
}

/* Génère le contenu HTML avec les infos sur un collège et la distance à l'adresse définie*/
function infoColPath(nom, adresse, codepostal, txreu, txmention, lycee, time, distance) {
    return '<h4></h4>' +
        '<img src="./assets/img/walk.png" height="16" width="16"><b>  ' + distance + ' m / ' + time + ' mns </b><hr/>' +
        '<b>' + nom + '</b><br/>' +
        adresse + '<br/> ' + codepostal + ' PARIS <br/>' +
        '<b>Taux de r&eacute;ussite* : </b>' + ((txreu == 999) ? "N/A" : txreu + '%') + '<br/>' +
        '<b>Taux de mentions* : </b>' + ((txmention == 999) ? "N/A" : txmention + '%') + '<br/>' +
        '*2021';
}


/* Génère le contenu HTML avec les infos sur un lycée*/
function infoLyc(nom, adresse, codepostal, type) {
    return '<h4></h4>' +
        '<b>' + nom + '</b><br/>' +
        '(' + type + ')<br/>' +
        adresse + '<br/>' +
        codepostal + ' PARIS <br/>';
}


function getColorLycee(zone) {
    return zone == "ouest" ? '#b3de69' : //Vert
        zone == "est" ? '#80b1d3' : //Bleu
            zone == "nord" ? '#fb8072' : //Rouge
                zone == "sud" ? '#ffed6f' : //Jaune
                    '#FFFFB2';
}


/*Style layer secteurs collèges*/
function style(feature) {

    return {
        weight: 1,
        opacity: 0.5,
        color: 'grey',
        dashArray: '3',
        fillOpacity: 0.6,
        fillColor: feature.properties['colzone']
    };
}

function styleres(feature) {

    return {
        weight: 1,
        opacity: 0.5,
        color: 'grey',
        dashArray: '3',
        fillOpacity: 0.6,
        fillColor: feature.properties['colreussite']
    };
}

function stylemention(feature) {
    return {
        weight: 1,
        opacity: 0.5,
        color: 'grey',
        dashArray: '3',
        fillOpacity: 0.6,
        fillColor: feature.properties['colmention']
    };
}

function styleLycee(feature) {
    return {
        weight: 1,
        opacity: 0.5,
        color: 'grey',
        dashArray: '3',
        fillOpacity: 0.6,
        fillColor: getColorLycee(feature.properties.secteur)
    };
}


/*Initialisation secteurs */
var colSecteurs = new L.GeoJSON.AJAX(null, '');


/*Icones*/
var icone = "circle";

var iconeBleue = L.MakiMarkers.icon({ icon: icone, color: "#779ECB", size: "s" });
var iconeRouge = L.MakiMarkers.icon({ icon: icone, color: "#C23B22", size: "s" });
var iconeVert = L.MakiMarkers.icon({ icon: icone, color: "#317873", size: "s" });
var iconeOrange = L.MakiMarkers.icon({ icon: icone, color: "#FF8C00", size: "s" });
var iconeJaune = L.MakiMarkers.icon({ icon: icone, color: "#F8DE7E", size: "s" });
var iconeViolet = L.MakiMarkers.icon({ icon: icone, color: "#702963", size: "s" });
var iconeNoire = L.MakiMarkers.icon({ icon: icone, color: "#000000", size: "m" });
var iconeCollege = L.MakiMarkers.icon({ icon: "college", color: "#000000", size: "m" });
var iconeBuilding = L.MakiMarkers.icon({ icon: "building", color: "#000000", size: "m" });


/* Overlay Layers */
var highlight = L.geoJson(null);
var highlightStyle = {
    stroke: false,
    fillColor: "#00FFFF",
    fillOpacity: 0.7,
    radius: 10
};


/* Gestion du click sur une zone */

var lastClickedLayer; // Variable to store last layer 

var layerList = [];
var popupList = []; //Array of popups - to help clearing 

function clickFeature(e) {

    if (lastClickedLayer) {

        if ($('#colleges-secto-btn').data('selected')) { colSecteurs.resetStyle(lastClickedLayer); }
        if ($('#colleges-txreu-btn').data('selected')) { colSecteurs.setStyle(styleres); }
        if ($('#colleges-txmention-btn').data('selected')) { colSecteurs.setStyle(stylemention); }

        //lastClickedLayer.eachLayer(function(l){lastClickedLayer.resetStyle(l);});
    }

    zoomToFeature(e);

    /* Clear existing popups*/
    for (var i = 0; i < popupList.length; i++) {
        map.removeLayer(popupList[i]);
    }

    for (var j = 0; j < layerList.length; j++) {
        map.removeLayer(layerList[j]);
    }


    this.setStyle({
        weight: 5,
        color: '#666',
        dashArray: '',
        fillOpacity: 0.9
    });

    if (!L.Browser.ie && !L.Browser.opera) {
        this.bringToFront();
    }

    var popup;

    for (var i = 0; i < e.target.feature.properties['etabs'].length; i++) {
        popup = L.popup()
            .setLatLng([e.target.feature.properties['etabs'][i]['lat'], e.target.feature.properties['etabs'][i]['lng']])
            .setContent(infoCol(e.target.feature.properties['etabs'][i]['nom'], e.target.feature.properties['etabs'][i]['adresse'], e.target.feature.properties['etabs'][i]['code_postal'], e.target.feature.properties['etabs'][i]['txreussite'], e.target.feature.properties['etabs'][i]['txmention'], false))
        map.addLayer(popup);
        popupList.push(popup);
    }


    lastClickedLayer = this;
}


var lastClickedLayerLyc;

function clickFeatureLyc(e) {

    if (lastClickedLayerLyc) {
        lycSecteurs.resetStyle(lastClickedLayerLyc);
    }

    zoomToFeature(e);


    this.setStyle({
        weight: 1,
        color: '#666',
        dashArray: '',
        fillOpacity: 0.9
    });

    if (!L.Browser.ie && !L.Browser.opera) {
        this.bringToFront();
    }

    lastClickedLayer = this;
}



/* Zoom sur un secteur */
function zoomToFeature(e) {
    map.fitBounds(e.target.getBounds());
}

/* A remplacer */
function onEachFeature(feature, layer) {
    layer.on({
        click: clickFeature,
    });
}

function onEachFeatureLyc(feature, layer) {
    layer.on({
        click: clickFeatureLyc,
    });
}

/* Declaration map object */
var map = new L.Map("map", {
    center: new L.LatLng(48.856515, 2.343920),
    zoom: 13,
    zoomControl: false,
    zoomAnimation: true,
    attributionControl: true
});

map.spin(true);

map.fitBounds([
    [48.89, 2.413865],
    [48.816353, 2.251302]
]);

/* Contrôle du zoom */
var zoomControl = L.control.zoom({
    position: "bottomright"
}).addTo(map);

/*Bouton pour recentrer */

var recenter = L.easyButton({
    id: 'recenter',
    leafletClasses: true,
    states: [{
        icon: 'glyphicon glyphicon-resize-full',
        onClick: function () {
            map.fitBounds([
                [48.89, 2.413865],
                [48.816353, 2.251302]
            ]);
        }
    }]
});
recenter.addTo(map);

if (L.Browser.touch) {
    $('#recenter').css(touchControl);
}


// Ajout du base layer 

map.addLayer(new L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}.png', {
    attribution: `&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a>
    &copy; <a href="https://stamen.com/" target="_blank">Stamen Design</a>
    &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a>
    &copy; <a href="https://www.openstreetmap.org/about/" target="_blank">OpenStreetMap contributors</a>`,
    detectRetina: false
}))


/* Geolocalisation */
var locateControl = L.control.locate({
    position: "bottomright",
    drawCircle: true,
    follow: true,
    setView: true,
    keepCurrentZoomLevel: false,
    markerStyle: {
        weight: 1,
        opacity: 0.8,
        fillOpacity: 0.8
    },
    circleStyle: {
        weight: 1,
        clickable: false
    },
    icon: "fa fa-location-arrow",
    metric: false,
    strings: {
        title: "Ma position",
        popup: "You are within {distance} {unit} from this point",
        outsideMapBoundsMsg: "Il semblerait que vous soyez à l'extérieur des limites de cette carte"
    },
    locateOptions: {
        maxZoom: 17,
        watch: false,
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 10000
    }
}).addTo(map);

/* Overlays*/

/* Collèges */

var colleges = new L.GeoJSON.AJAX("data/colleges.geojson", {
    filter: function (feature, layer) {
        return feature.geometry.type == "Point"
    },
    pointToLayer: function (feature, latlng) {
        return L.marker(latlng, { icon: iconeBleue }).bindPopup(infoCol(feature.properties['nom'], feature.properties['adresse'], feature.properties['code_postal'], feature.properties['txreussite'], feature.properties['txmention'], false));
    }
});

/* Lycées */
var lycees = new L.GeoJSON.AJAX("data/lycees.geojson", {
    pointToLayer: function (feature, latlng) {
        return L.marker(latlng, { icon: iconeRouge }).bindPopup(infoLyc(feature.properties.patronyme_uai, feature.properties.adresse_uai, feature.properties.code_postal_uai, feature.properties.nature_uai_libe));
    }
});


/* Lycées d'enseignement général*/
var lycees_eg = new L.GeoJSON.AJAX("data/lycees.geojson", {
    filter: function (feature, layer) {
        return feature.properties.nature_uai == 302 && feature.properties.secteur_public_prive_libe == "Public";
    },
    pointToLayer: function (feature, latlng) {
        return L.marker(latlng, { icon: iconeRouge }).bindPopup(infoLyc(feature.properties.patronyme_uai, feature.properties.adresse_uai, feature.properties.code_postal_uai, feature.properties.nature_uai_libe));
    }
});

/* Lycées d'enseignement technologique */
var lycees_tech = new L.GeoJSON.AJAX("data/lycees.geojson", {
    filter: function (feature, layer) {
        return feature.properties.nature_uai == 301;
    },
    pointToLayer: function (feature, latlng) {
        return L.marker(latlng, { icon: iconeVert }).bindPopup(infoLyc(feature.properties.patronyme_uai, feature.properties.adresse_uai, feature.properties.code_postal_uai, feature.properties.nature_uai_libe));
    }
});

/* Lycées d'enseignement général et technologique*/
var lycees_eg_tech = new L.GeoJSON.AJAX("data/lycees.geojson", {
    filter: function (feature, layer) {
        return feature.properties.nature_uai == 300 && feature.properties.secteur_public_prive_libe == "Public";
    },
    pointToLayer: function (feature, latlng) {
        return L.marker(latlng, { icon: iconeOrange }).bindPopup(infoLyc(feature.properties.patronyme_uai, feature.properties.adresse_uai, feature.properties.code_postal_uai, feature.properties.nature_uai_libe));
    }
});

/* Lycées polyvalents*/
var lycees_poly = new L.GeoJSON.AJAX("data/lycees.geojson", {
    filter: function (feature, layer) {
        return feature.properties.nature_uai == 306 && feature.properties.secteur_public_prive_libe == "Public";
    },
    pointToLayer: function (feature, latlng) {
        return L.marker(latlng, { icon: iconeViolet }).bindPopup(infoLyc(feature.properties.patronyme_uai, feature.properties.adresse_uai, feature.properties.code_postal_uai, feature.properties.nature_uai_libe));
    }
});

/* Lycées professionnels*/
var lycees_pro = new L.GeoJSON.AJAX("data/lycees.geojson", {
    filter: function (feature, layer) {
        return feature.properties.nature_uai == 320 && feature.properties.secteur_public_prive_libe == "Public";
    },
    pointToLayer: function (feature, latlng) {
        return L.marker(latlng, { icon: iconeJaune }).bindPopup(infoLyc(feature.properties.patronyme_uai, feature.properties.adresse_uai, feature.properties.code_postal_uai, feature.properties.nature_uai_libe));
    }
});


/* Secteurs collèges */

colSecteurs = L.geoJson.ajax("data/colleges.geojson", {
    filter: function (feature, layer) {
        return feature.geometry.type == "MultiPolygon"
    },
    style: style,
    onEachFeature: onEachFeature
});



/* indexation pour la recherche */
//var indexSecteurs = leafletKnn(colSecteurs);

/* Secteurs lycees */
var lycSecteurs = new L.GeoJSON.AJAX("data/secteurs_lyc.geojson", {
    style: styleLycee,
    onEachFeature: onEachFeatureLyc
});

/* Ajout des overlays secteur collèges et collèges */
map.addLayer(colSecteurs);

if (jQuery(window).height() > 700) {
    map.addLayer(colleges);
}



/*Recherche adresse autocomplete*/
var collegeLocation = [];
var markerLocation;
var markerCollege = [];
var popupCollege = [];
var pathToSchool = [];

var base = 'https://api.openrouteservice.org/v2/directions/foot-walking?api_key=5b3ce3597851110001cf6248ee803844fe274e8ebed6859bd79ec801&';
var path = {};
var depart = {};
var arrivee = {};

$(function () {

    $("#searchbox").autocomplete({
        source: function (request, response) {
            $.ajax({
                url: "https://api-adresse.data.gouv.fr/search/",
                dataType: "json",
                data: {
                    'q': request.term + ' Paris',
                    'limit': 5
                },
                success: function (data) {


                    $.each(data.features, function (key, value) {
                        this.properties.lon = value.geometry.coordinates[0];
                        this.properties.lat = value.geometry.coordinates[1];
                        this.properties.label = value.properties.label;
                    });


                    var arr = $.map(data.features, function (key, value) {
                        return key.properties;
                    });


                    response(arr);
                }
            });
        },
        minLength: 3,
        select: function (event, ui) {

            if (typeof markerLocation !== 'undefined') {
                map.removeLayer(markerLocation);
            }

            if (typeof markerCollege !== 'undefined') {
                map.removeLayer(markerCollege);
            }

            if (typeof pathToSchool !== 'undefined') {
                map.removeLayer(pathToSchool);
            }

            $("#nav-btn").click();


            /* Clear existing layers*/
            for (var i = 0; i < layerList.length; i++) {
                map.removeLayer(layerList[i]);
            }


            var location = new L.LatLng(ui.item.lat, ui.item.lon);
            depart.lat = ui.item.lat;
            depart.lon = ui.item.lon;

            // Cherche le layer le plus proche
            var closestLayer = leafletPip.pointInLayer(location, colSecteurs);


            // Pour definir la zone de zoom
            var latMin = ui.item.lat;
            var latMax = ui.item.lat;
            var lonMin = ui.item.lon;
            var lonMax = ui.item.lon;



            if (closestLayer.length > 0) { //Si le secteur est trouvé

                //console.log(ui.item);

                markerLocation = L.marker(location, { icon: iconeBuilding }).bindPopup(ui.item.label);
                map.addLayer(markerLocation);
                layerList.push(markerLocation);


                // on cherche la bounding box de la zone de zoom
                for (let i = 0; i < closestLayer[0].feature.properties['etabs'].length; i++) {


                    var tmpLat = closestLayer[0].feature.properties['etabs'][i]['lat'];
                    var tmpLon = closestLayer[0].feature.properties['etabs'][i]['lng'];

                    if (tmpLat > latMax) { latMax = tmpLat; }
                    if (tmpLat < latMin) { latMin = tmpLat; }
                    if (tmpLon > lonMax) { lonMax = tmpLon; }
                    if (tmpLon < lonMin) { lonMin = tmpLon; }
                }

                // Zoom sur la bounding box calculée
                map.fitBounds([
                    [latMin, lonMin],
                    [latMax, lonMax]
                ], { padding: [100, 100] });


                // on itère sur les collèges de la zone (let pour scoper id et éviter fuite dans le callback)
                for (let id = 0; id < closestLayer[0].feature.properties['etabs'].length; id++) {


                    collegeLocation[id] = new L.LatLng(closestLayer[0].feature.properties['etabs'][id]['lat'], closestLayer[0].feature.properties['etabs'][id]['lng']);

                    arrivee.lat = closestLayer[0].feature.properties['etabs'][id]['lat'];
                    arrivee.lon = closestLayer[0].feature.properties['etabs'][id]['lng'];


                    // Recuperation du chemin à pied 
                    $.getJSON(base + 'start=' + depart.lon + "," + depart.lat + '&end=' + arrivee.lon + "," + arrivee.lat, function (response) {


                        var lngLat = response.features[0].geometry.coordinates;
                        var latLng = [];

                        // Switch coordinates

                        for (var i = 0; i < lngLat.length; i++) {

                            var oldCoordinate = lngLat[i];
                            var newCoordinate = [oldCoordinate[1], oldCoordinate[0]];

                            latLng.push(newCoordinate);

                        };


                        pathToSchool[id] = L.polyline(latLng, {
                            color: 'red',
                            dashArray: '5,10'
                        });

                        var polyline = L.polyline(response.features[0].geometry.coordinates).addTo(map);

                        path.shape = pathToSchool[id];
                        path.time = response.features[0].properties.summary.duration;
                        path.length = response.features[0].properties.summary.distance;

                        var time = Math.round(path.time / 60);
                        var length = Math.round(path.length);


                        markerCollege[id] = L.marker(collegeLocation[id], { icon: iconeCollege });
                        map.addLayer(markerCollege[id]);
                        layerList.push(markerCollege[id]);

                        popupCollege[id] = L.popup()
                            .setLatLng(collegeLocation[id])
                            .setContent(infoColPath(closestLayer[0].feature.properties['etabs'][id]['nom'], closestLayer[0].feature.properties['etabs'][id]['adresse'], closestLayer[0].feature.properties['etabs'][id]['code_postal'], closestLayer[0].feature.properties['etabs'][id]['txreussite'], closestLayer[0].feature.properties['etabs'][id]['txmention'], false, time, length));

                        map.addLayer(popupCollege[id]);
                        layerList.push(popupCollege[id]);

                        map.addLayer(pathToSchool[id]);
                        layerList.push(pathToSchool[id]);


                    });

                }


            } else {
                markerLocation = L.marker(location, { icon: iconeNoire });
                map.panTo(location);
                map.setZoom(17);
                map.addLayer(markerLocation);
            }


        },
        open: function () {
            $(this).removeClass("ui-corner-all").addClass("ui-corner-top");
        },
        close: function () {
            $(this).removeClass("ui-corner-top").addClass("ui-corner-all");
        }
    });
});

/* fin adresse*/


function sizeLayerControl() {
    $(".leaflet-control-layers").css("max-height", $("#map").height() - 50);
}

/* Highlight search box text on click */
$("#searchbox").click(function () {
    $(this).select();
});

/* Prevent hitting enter from refreshing the page */
$("#searchbox").keypress(function (e) {
    if (e.which == 13) {
        e.preventDefault();
    }
});


$("#featureModal").on("hidden.bs.modal", function (e) {
    $(document).on("mouseout", ".feature-row", clearHighlight);
});

map.spin(false);
