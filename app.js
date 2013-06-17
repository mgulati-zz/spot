var express = require('express');

var app = express(),
  http = require('http'),
  server = http.createServer(app),
  io = require('socket.io').listen(server),
  stylus = require('stylus'),
  nib = require('nib'),
  path = require('path'),
  jade = require('jade');

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
});

var colors = {}

io.sockets.on('connection', function (socket) {

  socket.on('joinRoom', function (room) {
    socket.join(room);
  })

  //when a person updates their location
  socket.on('showLocation', function (latLong, color, room) {
    if (!colors[room]) colors[room] = {};
    colors[room][color] = latLong 
    socket.broadcast.to(room).emit('updateLocation', colors[room]);
  });

  //when anybody in the room updates the destination
  socket.on('updateDestination', function (latLong, room) {
    socket.broadcast.to(room).emit('updateDestination', latLong);
  });
  
});

app.get('/', function(req, res){
  res.render('page.jade');
});

server.listen(app.get('port'));
