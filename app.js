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


const DICTIONARY_FILE = 'words';
var dictionary = [];
var fs = require('fs')
  , dictionary = fs.readFileSync(DICTIONARY_FILE).toString().split("\n");
function randomWord() {
  i = Math.floor(Math.random() * (dictionary.length - 1));
  return dictionary[i];
}

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

//the entire database is just javascript variables
var friends = {};
var colors = {};
var rooms = {};
var destination = {};
var userCount = 0;

io.sockets.on('connection', function (socket) {

  //leave all current rooms on connection
  for (i in io.sockets.manager.roomClients[socket.id])
    if (io.sockets.manager.roomClients[socket.id][i] != "")
      socket.leave(io.sockets.manager.roomClients[socket.id][i]);

  //join the room you wanted to join based on pathname
  room = url.parse(socket.handshake.headers.referer).pathname;
  room = room.slice(1);
  // if (room === "") console.log(socket.id + " joined to the homepage");
  while (!room) {
    var possibleRoom = randomWord().toLowerCase();
    if (!io.sockets.manager.rooms['/'+possibleRoom] && possibleRoom != null && possibleRoom != "") {
      room = possibleRoom;
      socket.emit('roomCreated', room);
    }
  }
  socket.join(room);
  rooms[socket.id] = room;
  socket.emit('initialize', friends[room], destination[room], room);
    // console.log(socket.id + " joined " + room + ".");

  userCount++;
  // console.log('userCount: ' + userCount)

  //when the initial location is sent and room is made
  // socket.on('makeRoom', function (room) {
  //   if (io.sockets.manager.rooms['/'+room] || room == null || room == "")
  //     socket.emit('roomExists', room);
  //   else {
  //     socket.join(room);
  //     rooms[socket.id] = room;
  //     socket.emit('roomCreated', room);
  //     socket.emit('initialize', null, null, room)
  //   }
  // })

  // socket.on('checkRoom', function (room) {
  //   if (io.sockets.manager.rooms['/'+room] || room == null || room == "")
  //     socket.emit('roomExists', room);
  //   else 
  //     socket.emit('roomOK', room);
  // })

  //when a person updates their location
  socket.on('showLocation', function (room, myData) {
    if (room) {
      // console.log(myData.color + ' in ' + room + ' updated to ' + myData.position.jb + "," + myData.position.kb);
      if (!friends[room]) friends[room] = {};
      friends[room][myData.color] = myData;
      colors[socket.id] = myData.color;
      io.sockets.in(room).emit('updateLocation', friends[room]);
    }
  });

  //when anybody in the room updates the destination, update database and send to all
  socket.on('updateDestination', function (room, latLong) {
    if (room) {
      // console.log('destination in ' + room + ' updated to ' + latLong.jb + ',' + latLong.kb);
      destination[room] = latLong;
      io.sockets.in(room).emit('sendDestination', destination[room]);
    }
  });

  //take out person from room, delete in dataabse
  socket.on('disconnect', function () {
    // console.log(socket.id + " left " + rooms[socket.id]);
    // console.log('userCount: ' + --userCount)
    if (friends[rooms[socket.id]] && friends[rooms[socket.id]][colors[socket.id]]) {
      delete friends[rooms[socket.id]][colors[socket.id]];
      io.sockets.in(rooms[socket.id]).emit('personLeft', colors[socket.id]);
    }
  });
});

//routing, if css and javascript send file, otherwise render the page
app.get('/:room?', function(req, res, next){
  if (req.params.room && 
      (req.params.room.indexOf(".js", req.params.room.length - ".js".length) !== -1 ||
      req.params.room.indexOf(".css", req.params.room.length - ".css".length) !== -1 ||
      req.params.room.indexOf(".png", req.params.room.length - ".png".length) !== -1))
        next();
  else {
    res.render('page.jade');
  }
});

server.listen(app.get('port'));
