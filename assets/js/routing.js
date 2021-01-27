var base = 'http://valhalla.mapzen.com/route?';

var params = {
  api_key: 'valhalla-wb-yvbM'
};

var json = {
  costing:"pedestrian",
  directions_options: {
    units: "meters"
  }
};

var path={};



function findRoute(points) {
  json.locations = [];

  $.each(points, function (i, point) {
    json.locations.push({
      lat: point.lat,
      lon: point.lon
    });
  });

  $.getJSON(base + $.param(params) + '&json=' + JSON.stringify(json), function (response) {
    path.shape=L.polyline(L.PolylineUtil.decode(response.trip.legs[0].shape, 6));
    path.time=response.trip.summary.time;
    path.length=response.trip.summary.length;

    console.log(path);
    //map.addLayer(shape);
    //console.log(path);

  }
  );
}