'use strict'
const got = require('got');
const csv = require('csv');
const leftPad = require('left-pad');
const ENDPOINT_BASE_URL_TEMPLATE = "http://www.efa-bw.de/nvbw/XSLT_COORD_REQUEST?&jsonp=&boundingBox=&boundingBoxLU={minx}%3A{miny}%3AWGS84%5BDD.DDDDD%5D&boundingBoxRL={maxx}%3A{maxy}%3AWGS84%5BDD.DDDDD%5D&coordOutputFormat=WGS84%5BGGZHTXX%5D&type_1=STOP&outputFormat=json&inclFilter=1";
const EPSILON = Math.pow(2, -2);
const MAX_STOPS = 1000;
const RS = [
	"07334",
	"08111",
	"08115",
	"08116",
	"08117",
	"08118",
	"08119",
	"08121",
	"08125",
	"08126",
	"08127",
	"08135",
	"08136",
	"08211",
	"08212",
	"08215",
	"08216",
	"08231",
	"08235",
	"08236",
	"08237",
	"08311",
	"08315",
	"08316",
	"08317",
	"08325",
	"08326",
	"08327",
	"08335",
	"08336",
	"08337",
	"08415",
	"08416",
	"08417",
	"08421",
	"08425",
	"08426",
	"08435",
	"08436",
	"08437",
	"09775",
].reduce((rs, r) => Object.assign(rs, { [r]: true }), {});

const queryStops = function(minx, miny, maxx, maxy, callback) {
	const url = ENDPOINT_BASE_URL_TEMPLATE
		.replace("{minx}", minx)
		.replace("{miny}", miny)
		.replace("{maxx}", maxx)
		.replace("{maxy}", maxy);
	const requery = function() {
		const midx = (minx + maxx) / 2;
		const midy = (miny + maxy) / 2;
		queryStops(minx, miny, midx, midy, callback);
		queryStops(midx, miny, maxx, midy, callback);
		queryStops(minx, midy, midx, maxy, callback);
		queryStops(midx, midy, maxx, maxy, callback);
	};
	// console.log("Querying " + url + ".");
	got(url).then(response => {
		const result = JSON.parse(response.body);
		// console.log("Got " + result.pins.length + " results from " + url + ".");
		if (result.pins.length > 0 && result.pins.length <= MAX_STOPS) {
			result.pins.forEach(callback);
		}
		else if (maxx - minx > EPSILON)
		{
			requery();
		}
	}).catch(error =>{
		requery;
	});
};

const exportStops = function(stops) {
	csv.stringify(stops, {header: true, quotedString: true, columns: ["stop_id", "stop_name", "stop_lon", "stop_lat", "stop_code"]}, function(err, data){
		process.stdout.write(data);
	});
}

const retrieveStops = function(minx, miny, maxx, maxy) {
	const stops = [];
	const stopsById = {};
	const callback = s => {
		if (!s.attrs) { s.attrs = []; }
		var attributes = s.attrs.reduce((attibutes, attribute) => Object.assign(attibutes, { [attribute.name]: attribute.value }), {});

		var stopId = s.stateless;
		var stop = {};	
		stop.stop_id = stopId;
		stop.stop_name = s.locality + ", " + s.desc;
		var lonLat = s.coords.split(",");
		stop.stop_lon = Number(lonLat[0]/100000);
		stop.stop_lat = Number(lonLat[1]/100000);
		stop.stop_code = attributes.STOP_GLOBAL_ID || "";

		var rs = leftPad((stop.stop_code.match(/^de:(\d+):/)||['', ''])[1], 5, '0');
		if (RS[rs] && stop.stop_lon && stop.stop_lat) {
			const existingStop = stopsById[stopId]
			if (existingStop) {
				if (stop.stop_id !== existingStop.stop_id ||
					stop.stop_name !== existingStop.stop_name ||
					stop.stop_lon !== existingStop.stop_lon ||
					stop.stop_lat !== existingStop.stop_lat)
				{
//					console.log("Duplicate but different stop.");
//					console.log("Existing stop:", existingStop);
//					console.log("Duplicate stop:", stop);
				}
			}
			else {
				stopsById[stopId] = stop;
				stops.push(stop);
			}
		}
	};
	queryStops(minx, miny, maxx, maxy, callback);
	setTimeout(function () { exportStops(stops); }, 150000);
};

retrieveStops(5, 47, 15, 56);