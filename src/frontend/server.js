import express from 'express';
import sprightly from 'sprightly';
import http from 'http';
import { v4 as uuidv4 } from 'uuid';
import { createRequire } from "module";

const require = createRequire(import.meta.url);
require('dotenv').config();
const upload = require('express-fileupload');

const MODE = process.env.MODE || 'demo';
const PORT = process.env.PORT || 3000;
console.log("Environment: " + MODE);

const app = express();
app.engine('spy', sprightly);
app.set('views', './views');
app.set('view engine', 'spy');
app.use(express.static('./public')); // serve the "public" directory
app.use('/libs', express.static('./node_modules'));
app.use(upload());

const http_ = http.createServer(app);

const title = "pmc-vis";

// pages
app.get('/', (req, res) => {
  const id = req.query.id;
  renderMain(req, res);
});

function renderMain(req, res) {
  res.render('main/main.spy', {
    title,
    uuid: uuidv4()
  });
}

// 141.76.67.176
http_.listen(PORT, function () {
  console.log(`Server is listening on port http://localhost:${PORT}`);
});