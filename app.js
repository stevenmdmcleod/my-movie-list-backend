const logger = require("./util/logger");
const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

const PORT = 3000;
const userController = require('./controller/userController');

const watchlistController = require('./controller/watchlistController');

const watchmodeController = require('./controller/watchmodeController');

const { authenticateToken } = require('./util/jwt');

//console.log(`running on port ${PORT}`);


app.use("/users", userController);

app.use(loggerMiddleware);

app.use("/watchlist", watchlistController);

app.use('/watchmode', watchmodeController);

function loggerMiddleware(req, res, next){
  logger.info(`Incoming ${req.method} : ${req.url}`);
  next();
}








app.listen(3000, '0.0.0.0', () => console.log("Server running on 0.0.0.0:3000"));