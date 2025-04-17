const logger = require("./util/logger");
const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());
app.use(cors({
  origin: ['http://localhost:3000', 'http://18.218.51.22:3000/', 'http://production-my-movie-list-frontend.s3-website.us-east-2.amazonaws.com/'],
  credentials: true, // if using cookies/sessions
}));

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