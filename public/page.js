var friends = [];

var destination
var map
var thisRoom

var initialized = false;

var socket;

var directionsService = new google.maps.DirectionsService();

var colors = ["Red", "Yellow", "Green", "Blue", "Purple"]

var friend = function(Color, Position, TravelMode) {
  this.color = Color;

  this.travelMode = TravelMode || google.maps.TravelMode.DRIVING;

  this.directionDisplay = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: true,
    suppressInfoWindows: true,
    polylineOptions: new google.maps.Polyline({
      strokeColor: this.color
    })
  });

  this.duration = 0;

  this.marker = new google.maps.Marker({
    map: map,
    animation: google.maps.Animation.DROP,
    position: Position,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: this.color,
      fillOpacity: 1,
      strokeColor: "black",
      strokeWeight: 1,
      scale: 4
    },
  });

  this.showDirections();
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
  socket = io.connect(window.location.hostname);

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

  socket.on('initialize', function(friendsData, destinationData, roomData) {
    thisRoom = roomData;
    destination.setPosition(destinationData);
    for (x in friendsData) {
      currentFriend = new friend(x, friendsData[x].position, friendsData[x].travelMode);
      friends[x] = currentFriend;
    }
    
    if (navigator.geolocation) navigator.geolocation.watchPosition(updateGeo, error);
    else error('not supported');
  })

  socket.on('roomExists', function(room) {

  })

  socket.on('roomCreated', function(room) {
    thisRoom = room;
    window.history.pushState(null, room, '/' + room);
  })

  socket.on('updateLocation', function(friendsData) {
    console.log('location updated');
    for (x in friendsData) {
      newPosition = new google.maps.LatLng(friendsData[x].position.jb, friendsData[x].position.kb)
      currentFriend = new friend(x, newPosition, friendsData[x].travelMode);
      friends[x] = currentFriend;
    }
  })

  socket.on('sendDestination', function(newDestination) {
    console.log('somebody updated destination');
    destination.setPosition(new google.maps.LatLng(newDestination.jb, newDestination.kb));
    for (i in friends) friends[i].showDirections();
  })

  socket.on('personLeft', function(leaveColor) {
    if (friends[leaveColor])
      delete friends[leaveColor];
  })
});

function error(msg) {
  console.log(msg);
}

function updateGeo(position) {
  var latlng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
  if (!initialized) {
    $('#showLocation').hide();
    $('#obfuscateMap').hide();
    map.setCenter(latlng)
    map.setZoom(13)
    initialized = true;
  }
  color = "red";
  socket.emit('showLocation', thisRoom, {color: color, position: latlng});
}

function changeDest(location) {
  socket.emit('updateDestination', thisRoom, location);
}