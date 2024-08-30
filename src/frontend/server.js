import express from 'express';
import sprightly from 'sprightly';
import http from 'http';
import { v4 as uuidv4 } from 'uuid';
import { createRequire } from 'module';
import io from 'socket.io';

const require = createRequire(import.meta.url);
require('dotenv').config();
const upload = require('express-fileupload');

const MODE = process.env.MODE || 'demo';
const PORT = process.env.PORT || 3000;
console.log('Environment: ' + MODE);

const app = express();
app.engine('spy', sprightly);
app.set('views', './views');
app.set('view engine', 'spy');
app.use(express.static('./public')); // serve the 'public' directory
app.use('/libs', express.static('./node_modules'));
app.use(upload());

const http_ = http.createServer(app);
const io_ = io(http_);

const title = 'pmc-vis';
const titleOverview = 'overview';

// pages
app.get('/', (req, res) => {
  const id = req.query.id;
  renderMain(req, res);
});

app.get('/overview', (req, res) => {
  renderOverview(req, res);
});

function renderOverview(req, res) {
  res.render('overview/overview.spy', {
    titleOverview,
    uuid: uuidv4(),
  });
}

function renderMain(req, res) {
  res.render('main/main.spy', {
    title,
    uuid: uuidv4(),
  });
}

// 141.76.67.176
http_.listen(PORT, function () {
  console.log(`Server is listening on port http://localhost:${PORT}`);
});

// listening on the connection event for incoming sockets
io_.on('connection', function (socket) {
  // Handle data received from clients
  // socket.on('pane data updated', (data) => {
  //   io_.emit('pane data updated', data);
  // });

  socket.on('pane added', (data) => {
    io_.emit('handle pane added', data);
  });

  socket.on('pane removed', (data) => {
    io_.emit('handle pane removed', data);
  });

  socket.on('overview node clicked', (data) => {
    io_.emit('handle overview node clicked', data);
  });

  socket.on('overview nodes selected', (data) => {
    io_.emit('handle overview nodes selected', data);
  });

  socket.on('handle selection', (data) => {
    io_.emit('handle selection', data);
  });

  socket.on('duplicate pane ids', (data) => {
    io_.emit('handle duplicate pane ids', data);
  });

  socket.on('active pane', (data) => {
    io_.emit('handle active pane', data);
  });

  socket.on('reset pane-node markings', (data) => {
    io_.emit('handle reset pane-node markings', data);
  });

  socket.on('disconnect', function () {
    console.log('client disconnected');
    io_.emit('disconnect');
  });
});
