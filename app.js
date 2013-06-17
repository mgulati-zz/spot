var express = require('express');

var app = express(),
  http = require('http'),
  server = http.createServer(app),
  io = require('socket.io').listen(server),
  stylus = require('stylus'),
  nib = require('nib'),
  path = require('path'),
  jade = require('jade'),
  url = require('url');

function compile(str, path) {
  return stylus(str)
    .set('filename', path)
    .set('compress', true)
    .use(nib());
}
  
app.configure(function() {
  app.set('port', process.env.PORT || 3000);
  app.use(express.favicon());
  app.use(app.router);
  app.set('views', __dirname + '/public');
  app.set('view engine', 'jade');
  app.set("view options", {layout: false});
  app.use(stylus.middleware({
    src: __dirname + '/public'
    , compile: compile}));
  app.use(express.static(__dirname + '/public'));
});

// Heroku won't actually allow us to use WebSockets
// so we have to setup polling instead.
// https://devcenter.heroku.com/articles/using-socket-io-with-node-js-on-heroku
io.configure(function () {
  // io.set("transports", ["xhr-polling"]);
  // io.set("polling duration", 10);
  io.set('log level', 1);

  //Set up handshake data for joining room
  io.set('authorization', function (handshakeData, callback) {
    callback(null, true); 
  });

});

//the entire database
var friends = {};
var colors = {};
var rooms = {};
var desination = {};

io.sockets.on('connection', function (socket) {

  //leave all current rooms on connection
  for (i in io.sockets.manager.roomClients[socket.id])
    if (io.sockets.manager.roomClients[socket.id][i] != "")
      socket.leave(io.sockets.manager.roomClients[socket.id][i]);

  //join the room you wanted to join based on pathname
  room = url.parse(socket.handshake.headers.referer).pathname;
  room = room.slice(1);
  if (room != "") {
    console.log(room);
    socket.join(room);
    rooms[socket.id] = room;
    //start off with friend data already existing
    if (friends[room])
      socket.emit('theOthers', friends[room], destination[room]);
  }

  //when the initial location is sent and room is made
  socket.on('makeRoom', function (room, myData) {
    if (io.sockets.manager.rooms['/'+room])
      socket.emit('roomExists', room);
    else {
      socket.join(room);
      friends[room] = {};
      friends[room][myData.color] = myData;
      colors[socket.id] = myData.color;
      rooms[socket.id] = room;
      socket.emit('roomCreated', room);
    }
  })

  //when a person updates their location
  socket.on('showLocation', function (room, myData) {
    friends[room][myData.color] = myData;
    colors[socket.id] = myData.color;
    io.sockets.in(room).emit('updateLocation', friends[room]);
  });

  //when anybody in the room updates the destination
  socket.on('updateDestination', function (latLong, room) {
    desination[room] = latLong;
    io.sockets.in(room).emit('updateDestination', desination[room]);
  });

  //take out person from room
  socket.on('disconnect', function () {
    if (friends[rooms[socket.id]] && friends[rooms[socket.id]][colors[socket.id]]) {
      delete friends[rooms[socket.id]][colors[socket.id]];
      io.sockets.in(rooms[socket.id]).emit('personLeft', colors[socket.id]);
    }
  });
});

app.get('/:room?', function(req, res, next){
  if (req.params.room && 
      (req.params.room.indexOf(".js", req.params.room.length - ".js".length) !== -1 ||
      req.params.room.indexOf(".css", req.params.room.length - ".css".length) !== -1))
        next();
  else {
    res.render('page.jade');
  }
});

server.listen(app.get('port'));
