var friends = {};

var destination
var map
var thisRoom
var thisColor

var initialized = false;
var firstBounds;

increment = 1800;

var socket;

var directionsService = new google.maps.DirectionsService();
google.maps.visualRefresh = true;

var colors = ["4574b5","bb293c","019191","e77a05","a63f5d"]

$.tinysort.defaults.order = 'desc';
$.tinysort.defaults.attr = 'seconds';

var styles = [
  {
    "stylers": [
      { "saturation": -100 }
    ]
  }
]

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
      strokeColor: '#' + this.color,
      strokeOpacity: 0.9,
      strokeWeight: 5
    })
  });

  this.duration = 0;

  this.marker = new google.maps.Marker({
    map: map,
    animation: google.maps.Animation.DROP,
    position: Position,
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: '#' + this.color,
      fillOpacity: 1,
      strokeColor: "black",
      strokeWeight: 1,
      scale: 4
    }
  });
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

      if ($('#' + current.color + 'progress').length == 0)
        $('<div>').attr('id',current.color + 'progress').addClass('progress')
          .css('width', current.duration + 'px').css('background-color', '#' + current.color)
          .appendTo($('#timeline'));

      timeToShow = (current.duration < 100)? current.duration + 's' :
                   (current.duration < 6000)? Math.ceil(current.duration/60) + 'm' :
                   Math.ceil(current.duration/3600) + 'h' 

      $('#' + current.color + 'progress').attr('time', timeToShow);
      $('#' + current.color + 'progress').attr('seconds', current.duration);

      dfd.resolve();
    }
    else dfd.reject();
  });
  return dfd.promise();
}

$(function() {
  var mapOptions = {
    center: new google.maps.LatLng(32.52828936482526,-118.32275390625),
    zoom: 7,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    mapTypeControl: false,
    streetViewControl: false,
  };
  
  map = new google.maps.Map(document.getElementById("mapCanvas"), mapOptions);
  map.setOptions({styles: styles});
  google.maps.event.addListener(map, 'zoom_changed', function() {
    zoomChangeBoundsListener = 
      google.maps.event.addListener(map, 'bounds_changed', function(event) {
        if (this.getZoom() > 15 && this.initialZoom == true) {
            // Change max/min zoom here
            this.setZoom(15);
            this.initialZoom = false;
        }
        google.maps.event.removeListener(zoomChangeBoundsListener);
      });
  });
  map.initialZoom = true;

  destination = new google.maps.Marker({
    animation: google.maps.Animation.DROP,
    map: map
  });

  google.maps.event.addListener(map, 'click', function(event) {
    changeDest(event.latLng);
  });

  socket = io.connect(window.location.hostname, {'sync disconnect on unload' : true});
  socket.on('initialize', function(friendsData, destinationData, roomData) {
    thisRoom = roomData;

    $('#showLocation').show();

    firstBounds = new google.maps.LatLngBounds();
    var boundsExist = false;

    if (destinationData) {
      destination.setPosition(new google.maps.LatLng(destinationData.k, destinationData.A));
      firstBounds.extend(destination.position);
      boundsExist = true;
    }

    for (x in friendsData) {
      newPosition = new google.maps.LatLng(friendsData[x].position.k, friendsData[x].position.A)
      friends[x] = new friend(x, newPosition, friendsData[x].travelMode);
      friends[x].showDirections();
      firstBounds.extend(friends[x].marker.position);
      boundsExist = true;
    }

    if (boundsExist) {
      map.fitBounds(firstBounds);
      map.setCenter(firstBounds.getCenter());
    }
    
    if (navigator.geolocation) navigator.geolocation.watchPosition(updateGeo, error);
    else error('not supported');

  })

  socket.on('roomCreated', function(room) {
    window.history.pushState(null, room, '/' + room);
  })

  socket.on('updateLocation', function(friendsData) {
    // console.log('location updated');
    var promises = []
    
    for (x in friendsData) {
      promises.push(populate(x, friendsData));
    }

    if (Object.keys(friendsData).length < 2) $('#shareTooltip').show();
    else $('#shareTooltip').hide();

    $.when.apply($, promises).then(function() {
      var durations = $("div[id$='progress']").map(function() { return this.getAttribute('seconds') }).get();
      maxDuration = Math.max.apply(null, durations);
      currentWindow = (Math.ceil(maxDuration/increment)*increment);
      $("div[id$='progress']").tsort();       
      for (x in friends) {
        widthPercent = (friends[x].duration/currentWindow)*90;
        $('#' + x + 'progress').css('width', widthPercent.toString() + '%');  
      }  
    })

  })

  socket.on('sendDestination', function(newDestination) {
    // console.log('somebody updated destination');
    destination.setPosition(new google.maps.LatLng(newDestination.k, newDestination.A));
    $('#destTooltip').hide();
    var promises = []
    for (i in friends) {
      promises.push(friends[i].showDirections());
    }
    $.when.apply($, promises).then(function() {
      positionMap();
      var durations = $("div[id$='progress']").map(function() { return this.getAttribute('seconds') }).get();
      maxDuration = Math.max.apply(null, durations);
      currentWindow = (Math.ceil(maxDuration/increment)*increment);
      $("div[id$='progress']").tsort();       
      for (x in friends) {
        widthPercent = (friends[x].duration/currentWindow)*90;
        $('#' + x + 'progress').css('width', widthPercent.toString() + '%');  
      }  
    })
  })

  socket.on('personLeft', function(leaveColor) {
    if (friends[leaveColor]) {
      friends[leaveColor].marker.setMap(null);
      friends[leaveColor].directionDisplay.setMap(null);
      if ($('#' + friends[leaveColor].color + 'progress').length > 0)
        $('#' + friends[leaveColor].color + 'progress').remove();
      delete friends[leaveColor];
      if (Object.keys(friends).length < 2) $('#shareTooltip').show(); 
    }
  })

  modeSelector = $('#travelMode');
  modeSelector.click(function() {
    switch (modeSelector.attr('mode')) {
      case 'DRIVING':
        modeSelector.attr('mode','BICYCLING');
        modeSelector.css('background-position', '0px -2px');
        break;
      case 'BICYCLING':
        modeSelector.attr('mode','WALKING');
        modeSelector.css('background-position', '-120px -2px');
        break;
      case 'WALKING':
        modeSelector.attr('mode','DRIVING');
        modeSelector.css('background-position', '-60px -2px');       
        break;  
    }

    socket.emit('showLocation', thisRoom, {color: thisColor,
                                         position: friends[thisColor].marker.position, 
                                         travelMode: modeSelector.attr('mode')});
  });

  shareButton = $('#share');
  shareButton.click(function() {
    shareUrl = window.location.origin + window.location.pathname;
    window.location = "https://www.facebook.com/dialog/send?app_id=563099440406893&name=Join%20your%20friends%20trip&link=" + 
      shareUrl + "&redirect_uri=" + shareUrl;
  })

});

function positionMap() {
  var bounds = new google.maps.LatLngBounds();
  for (x in friends)
    bounds.extend(friends[x].marker.position);
  bounds.extend(destination.position);
  map.fitBounds(bounds);
  map.setCenter(bounds.getCenter());
}

function error(msg) {
  // console.log(msg);
}

function populate (x, friendsData) {
  var dfd = $.Deferred();
  newPosition = new google.maps.LatLng(friendsData[x].position.k, friendsData[x].position.A) 
  if (friends[x]){
    friends[x].marker.animation = null;
    if (newPosition.k != friends[x].marker.position.k ||
        newPosition.A != friends[x].marker.position.A ||  
        friendsData[x].travelMode != friends[x].travelMode) {
      friends[x].marker.position = newPosition;
      friends[x].marker.setMap(null);
      friends[x].marker.setMap(map);
      friends[x].travelMode = friendsData[x].travelMode; 
      if (destination.position) 
        $.when(friends[x].showDirections()).then(dfd.resolve());
    }
    else dfd.resolve();
  }
  else {
    friends[x] = new friend(x, newPosition, friendsData[x].travelMode);
    if (destination.position) $.when(friends[x].showDirections()).then(dfd.resolve());
  }
  return dfd.promise();
}

function updateGeo(position) {
  var latlng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
  if (!initialized) {

    for (x in colors) {
      if (!friends[colors[x]]) {
        thisColor = colors[x];
        break;
      }
    }

    if (firstBounds) {
      firstBounds.extend(latlng);
      map.setCenter(firstBounds.getCenter());
      map.fitBounds(firstBounds);
    }

    if (!destination.position) $('#destTooltip').show();
    if (Object.keys(friends).length < 2) $('#shareTooltip').show(); 

    initialized = true;
  }

  $('#travelMode').css('backgroundImage', "url('" + thisColor + ".png')");
  $('#travelMode').css('display', 'block');
  $('#showLocation').hide();
  $('#obfuscateMap').hide();
  $('#travelMode').show();
  $('#share').show();

  // console.log('sending position to server');
  socket.emit('showLocation', thisRoom, {color: thisColor,
                                         position: latlng, 
                                         travelMode: friends[thisColor]? friends[thisColor].travelMode : google.maps.TravelMode.DRIVING});
}

function changeDest(location) {
  socket.emit('updateDestination', thisRoom, location);
}