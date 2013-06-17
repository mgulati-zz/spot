var friends = [];

var myColor

var destination
var map

var directionsService = new google.maps.DirectionsService();

var colors = ["Red", "Yellow", "Green", "Blue", "Purple"]

var friend = function(Color, Position) {
  this.color = Color;

  this.travelMode = google.maps.TravelMode.DRIVING;

  this.directionDisplay = new google.maps.DirectionsRenderer();
  this.directionDisplay.setMap(map);

  this.duration = 0;

  this.marker = new google.maps.Marker({
    map: map,
    animation: google.maps.Animation.DROP,
    position: Position,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 3
    },
  });
}

friend.prototype.showDirections = function(){
  var current = this;

  var request = {
    origin: current.marker.position,
    destination: destination.position,
    travelMode: current.travelMode
  };

  directionsService.route(request, function(result, status) {
    if (status == google.maps.DirectionsStatus.OK) {
      current.duration = result.routes[0].legs[0].duration.value;
      current.directionDisplay.setDirections(result);
    }
  });
}

$(function() {
  var socket = io.connect(window.location.hostname);

  var mapOptions = {
    center: new google.maps.LatLng(-34.397, 150.644),
    zoom: 4,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    disableDefaultUI: true
  };
  
  map = new google.maps.Map(document.getElementById("mapCanvas"), mapOptions);

  destination = new google.maps.Marker({
    animation: google.maps.Animation.DROP,
    map: map
  });

  google.maps.event.addListener(map, 'click', function(event) {
    changeDest(event.latLng);
  });

  if (navigator.geolocation) navigator.geolocation.getCurrentPosition(getGeo, error);
  else error('not supported');
});

function error(msg) {
  console.log(msg);
}

function getGeo(position) {
  $('#showLocation').hide();
  $('#obfuscateMap').hide();
  
  var latlng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
  map.setCenter(latlng)
  map.setZoom(13)

  myColor = "Black";
  me = new friend(myColor,latlng);
  friends.push(me);
}

function changeDest(location) {
  destination.setPosition(location);
  for (i in friends) friends[i].showDirections();
}
