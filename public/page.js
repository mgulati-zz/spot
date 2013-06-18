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
      strokeColor: this.color,
      strokeOpacity: 0.6
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

  if (destination.position) this.showDirections();
}

friend.prototype.showDirections = function(){
  var dfd = $.Deferred();
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
      dfd.resolve();
    }
    else dfd.reject();
  });
  return dfd.promise();
}

$(function() {
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

  socket = io.connect(window.location.hostname);
  socket.on('initialize', function(friendsData, destinationData, roomData) {
    // console.log('initialization hit for room ' + roomData)
    thisRoom = roomData;

    $('#joinRoom').hide();
    $('#showLocation').show();

    if (destinationData) 
      destination.setPosition(new google.maps.LatLng(destinationData.jb, destinationData.kb));

    for (x in friendsData) {
      newPosition = new google.maps.LatLng(friendsData[x].position.jb, friendsData[x].position.kb)
      friends[x] = new friend(x, newPosition, friendsData[x].travelMode);
      // console.log('friend ' + x + ' added during initialization')
    }
    
    if (navigator.geolocation) navigator.geolocation.watchPosition(updateGeo, error);
    else error('not supported');

  })

  socket.on('roomExists', function(room) {
    if (room == $('.roomBox').text())
      $('.roomEnter').hide();
  })

  socket.on('roomOK', function(room) {
    if (room == $('.roomBox').text());
      $('.roomEnter').show();
  })

  socket.on('roomCreated', function(room) {
    window.history.pushState(null, room, '/' + room);
  })

  socket.on('updateLocation', function(friendsData) {
    // console.log('location updated');
    for (x in friendsData) {
      populate(x, friendsData);
    }
  })

  socket.on('sendDestination', function(newDestination) {
    // console.log('somebody updated destination');
    destination.setPosition(new google.maps.LatLng(newDestination.jb, newDestination.kb));
    for (i in friends) {
      // console.log('updating directions for ' + i)
      friends[i].showDirections()
    }
  })

  socket.on('personLeft', function(leaveColor) {
    if (friends[leaveColor]) {
      friends[leaveColor].marker.setMap(null);
      friends[leaveColor].directionDisplay.setMap(null);
      delete friends[leaveColor]; 
    }
  })

  $('.roomBox').keyup(function() {
    $('.roomEnter').hide();
    socket.emit('checkRoom', $('.roomBox').val());
  });  

  $('.roomEnter').click(function() {
    socket.emit('makeRoom', $('.roomBox').val());
  });

});

function error(msg) {
  // console.log(msg);
}

function populate (x, friendsData) {
  var dfd = $.Deferred();
  newPosition = new google.maps.LatLng(friendsData[x].position.jb, friendsData[x].position.kb)     
  if (friends[x]){
    friends[x].marker.animation = null;
    if (newPosition.jb != friends[x].marker.position.jb ||
        newPosition.kb != friends[x].marker.position.kb ||  
        friendsData[x].travelMode != friends[x].travelMode) {
      friends[x].marker.position = newPosition;
      friends[x].marker.setMap(null);
      friends[x].marker.setMap(map);
      friends[x].travelMode = friendsData[x].travelMode; 
      if (destination.position) friends[x].showDirections();
      dfd.resolve();
    }
    else dfd.resolve();
  }
  else {
    friends[x] = new friend(x, newPosition, friendsData[x].travelMode);
    dfd.resolve();
  }
  return dfd.promise();
}

function updateGeo(position) {
  var latlng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
  
  if (!initialized) {
    $('#showLocation').hide();
    $('#obfuscateMap').hide();
    map.setCenter(latlng)
    map.setZoom(13)

    for (x in colors) {
      if (!friends[colors[x]]) {
        // console.log('choose color number ' + x);
        thisColor = colors[x]
        break;
      }
    }

    initialized = true;
  }

  // console.log('sending position to server');
  socket.emit('showLocation', thisRoom, {color: thisColor,
                                         position: latlng, 
                                         travelMode: friends[thisColor]? friends[thisColor].travelMode : google.maps.TravelMode.DRIVING});
}

function changeDest(location) {
  socket.emit('updateDestination', thisRoom, location);
}