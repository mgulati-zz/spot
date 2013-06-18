var friends = {};

var destination
var map
var thisRoom
var thisColor

var initialized = false;

var socket;

var directionsService = new google.maps.DirectionsService();

var colors = ["Red", "Green", "Blue", "Purple"]

var friend = function(Color, Position, TravelMode) {
  this.color = Color;

  this.travelMode = TravelMode || google.maps.TravelMode.DRIVING;

  this.directionDisplay = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: true,
    suppressInfoWindows: true,
    preserveViewport: true,
    suppressBicyclingLayer: true,
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
    console.log('initialization hit for room ' + roomData)
    thisRoom = roomData;
    
    if (destinationData) 
      destination.setPosition(new google.maps.LatLng(destinationData.jb, destinationData.kb));

    for (x in friendsData) {
      newPosition = new google.maps.LatLng(friendsData[x].position.jb, friendsData[x].position.kb)
      currentFriend = new friend(x, newPosition, friendsData[x].travelMode);
      friends[x] = currentFriend;
      console.log('friend ' + x + ' added during initialization')
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
      if (friends[x]){
        friends[x].marker.animation = null;
        friends[x].marker.position = newPosition;
        friends[x].TravelMode = friendsData[x].travelMode;
      }
      else {
        currentFriend = new friend(x, newPosition, friendsData[x].travelMode);
        friends[x] = currentFriend;
      }
    }
  })

  socket.on('sendDestination', function(newDestination) {
    console.log('somebody updated destination');
    destination.setPosition(new google.maps.LatLng(newDestination.jb, newDestination.kb));
    for (i in friends) {
      console.log('updating directions for ' + i)
      friends[i].showDirections();
    }
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

  console.log('choosing color between ' + friends.length + ' friends')
  if (!thisColor) {
    for (x in colors) {
      if (!friends[colors[x]]) {
        thisColor = colors[x]
        break;
      }
    }
  }
  console.log('sending position to server');
  socket.emit('showLocation', thisRoom, {color: thisColor, position: latlng});
}

function changeDest(location) {
  socket.emit('updateDestination', thisRoom, location);
}