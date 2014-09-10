
jQuery.extend({
    getTrips:function(city, filters){
        var ajaxpythonresponse = null;
        $.ajax({
            type: "POST",
            url: "/cgi-bin/filter_bytime.py",
            data: filters,
            dataType: "json",
            async: false,
            error: function(xhr, status, error){
                alert(error)
            },
            success: function(data){
               var tripInfo = data;
               city['trips'] = tripInfo['trips'];
                //drawTrips(city, tripInfo['max_weight']);
           		updateTripCounts(city);
               console.log("getTrips completed");
            }
        });
        return ajaxpythonresponse;
    },
    getMaxClique:function(filters){
        var ajaxpythonresponse = null;
        $.ajax({
            type: "POST",
            url: "/cgi-bin/clique_algorithm.py",
            data: filters,
            async: false,
            error: function(xhr, status, error){
                alert(error)
            },
            success: function(data){
                ajaxpythonresponse = data;
            }
        });
        return ajaxpythonresponse;
    },
    getLouvain:function(city, filters){
        var ajaxpythonresponse = null;
        $.ajax({
            type: "POST",
            url: "/cgi-bin/louvain.py",
            data: filters,
            async: false,
            error: function(xhr, status, error){
                alert(error)
            },
            success: function(data){
                station_clusters = data;
                drawLouvainClusters(city, station_clusters);
            }
        });
        return ajaxpythonresponse;
    },
    getSTDBSCAN: function(city, filters){
         var ajaxpythonresponse = null;
         $.ajax({
             type: "POST",
             url: "/cgi-bin/stdbscan.py",
             data: filters,
             dataType: "json",
             async: false,
             error: function(xhr, status, error){
                 alert(error)
             },
             success: function(data){
                 clusters = data; 
                 drawSTDBSCAN(city, clusters);
                 }
         });
         return ajaxpythonresponse;
     }
});


function getFilters(city){
	var filters = {};
	var id = city['id'];
	filters["name"] = city['name'];
	filters["user"] = document.getElementById("user").value;
	filters["sex"] = document.getElementById("sex").value;
	filters['birthyear-start'] = $("#birthyear-start").val();
	if(filters['birthyear-start'] == "1932"){
		filters['birthyear-start'] = "min";
	}
	filters['birthyear-end'] = $("#birthyear-end").val();
	if(filters['birthyear-end'] == "1995"){
		filters['birthyear-end'] = "max";
	}
	filters["time-start"] = $(String.format("#time-start{0}",id)).val() + ":00";
	filters["time-end"] = $(String.format("#time-end{0}",id)).val() + ":59";
	filters["date-start"] = $(String.format("#start-date{0}",id)).val();
	filters["date-end"] = $(String.format("#end-date{0}",id)).val();
	filters["duration-start"] = DurationtoSeconds($("#duration-start").val());
	filters["duration-end"] = DurationtoSeconds($('#duration-end').val());
	return filters;
}

function updateTrips(city){
	var filters = getFilters(city);
	console.log("getting trips");
	$.getTrips(city, filters);
}


function updateTripCounts(city){
	var stations = city['stations'];
	var trips = city['trips'];
	var start_trips = {}, end_trips = {};
	$.each(stations, function(i){
		city['stations'][i]['startTotal'] = 0;
		city['stations'][i]['endTotal'] = 0;
	});
	$.each(trips, function(start_id, end_values){
		start_weight = 0;
		start_trips[start_id] = end_values;
		$.each(end_values, function(end_id, weight){
			start_weight += weight;
			stations[end_id]["endTotal"] += weight;
			if(! end_trips[end_id]){
				end_trips[end_id] = {};
			}
			end_trips[end_id][start_id] = weight;
		})
		stations[start_id]["startTotal"] = start_weight;
	})
	city['start_trips'] = start_trips;
	city['end_trips'] = end_trips;
	console.log("updateTripCounts completed");
	city['stations'] = stations;
}

function runSTDBSCAN(){
    var filters1 = getFilters(city1);
    var clusters1 = $.getSTDBSCAN(city1, filters1);
    var filters2 = getFilters(city2);
    var clusters2 = $.getSTDBSCAN(city2, filters2);
}

function drawSTDBSCAN(city, data){
    city['trip_layers'].clearLayers();
    city['station_layers'].clearLayers();
    var trips = data;

    var trip_layers = new L.LayerGroup();
    var colorScale = d3.scale.category20c();

    for (var property in trips) {
        var category = +property;
        var stations = city['stations'];
        var num_trips = Object.keys(trips[property]).length;    
        var lowBound = 50 / num_trips;
        var highBound = 500 / num_trips;
        var weightRange = d3.scale.pow(3)
                            .domain([0,3000])
                            .range([lowBound, highBound]);


        $.each(trips[property], function(start_st_id, end_st_ids){
            if(start_st_id != ""){
                var start_station = stations[start_st_id];
                var st_latlong = L.latLng(start_station.st_lat, start_station.st_long);
                $.each(end_st_ids, function(end_st_id, weight){
                    if(end_st_id != ""){
                        var end_station = stations[end_st_id];
                        var end_latlong = L.latLng(end_station.st_lat, end_station.st_long);
                        var trip = L.polyline([st_latlong, end_latlong], 
                                {color: colorScale(category),
                                weight: 0.1 * weightRange(trips[property][start_st_id][end_st_id])});
                        trip_layers.addLayer(trip);
                    }
                })
            }
        });
    }

    
    city['trip_layers'] = trip_layers;
    trip_layers.addTo(city['map']);
    uodateTripCounts(city);
    drawStations(city);
}

function runLouvain(){
    var filters1 = getFilters(city1);
    var station_clusters1 = $.getLouvain(city1, filters1);
    var filters2 = getFilters(city2);
    var station_clusters2 = $.getLouvain(city2, filters2);
}

function drawLouvainClusters(city,station_clusters){
    city['station_layers'].clearLayers();
    city['trip_layers'].clearLayers();
    var stations = city['stations'];
    var clusterLayer = new L.LayerGroup();
    var colorRange = d3.scale.category20c();
    for(c_id in station_clusters){
         var c_stations = station_clusters[c_id];
         var c_i = 0, c_total = c_stations.length;
         var c_station = c_stations[c_i];
         $.each(stations, function(i){
            var station = stations[i]; 
            var circle;
             if((c_i < c_total) && (station.st_id === c_stations[c_i])){ 
                circle = L.circle([station.st_lat, station.st_long], 50, {
                    color: colorRange(c_id),
                    fillColor: colorRange(c_id),
                    opacity: 1,
                    fillOpacity: 1
                });
                circle.bindPopup(station.st_name);
                clusterLayer.addLayer(circle);
                c_i += 1;
                c_station = c_stations[c_i];    
        } 
    })
    }
    city['station_layers'] = clusterLayer;
    clusterLayer.addTo(city['map']);
}

function runMaxClique(){
    var filters1 = getFilters(city1);
    var clique_stations1 = $.getMaxClique(filters1);
    drawCliqueStations(city1, clique_stations1);
    var filters2 = getFilters(city2);
    var clique_stations2 = $.getMaxClique(filters2);
    drawCliqueStations(city2, clique_stations2);
}


function drawCliqueStations(city, clique_stations){
    var stations = city['stations'];
    city['station_layers'].clearLayers();
    city['trip_layers'].clearLayers();
    var clique_layer = new L.LayerGroup();
    var c_i = 0;
    var c_max = clique_stations.length;
    //console.log(stations);
    //console.log(c_max);
    $.each(stations, function(i){
        var station = stations[i];
        var circle;
       if((c_i < c_max) && (station.st_id === clique_stations[c_i])){ 
            circle = L.circle([station.st_lat, station.st_long], 50, {
                color: '#fb6a4a',
                fillColor: '#fb6a4a',
                opacity: 1,
                fillOpacity: 1
            });
            c_i += 1;
       }
       else{
            circle = L.circle([station.st_lat, station.st_long], 50, {
                color: '#737373',
                fillColor: '#737373',
                opacity: 1,
                fillOpacity: 1
            });
       }
        circle.bindPopup(station.st_name);
        clique_layer.addLayer(circle);
  });
    city['station_layers'] = clique_layer;
        clique_layer.addTo(city['map']);
}
