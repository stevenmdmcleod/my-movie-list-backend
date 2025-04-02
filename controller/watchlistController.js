const express = require("express");
const router = express.Router();
const watchlistService = require('../service/watchlistService');
const { authenticateToken } = require("../util/jwt");
require('dotenv').config();
const SECRET_KEY = process.env.SECRET_KEY;
const logger = require("../util/logger");

router.post("/", authenticateToken, async (req, res) => {
    
    if(!req.user.userId){
        return res.status(400).json({message: "invalid token data"});
    }
    const data = req.body;
    
    if(!data.listName){
        return res.status(400).json({message: "requires a listName"});
    }
    try {
        const result = await watchlistService.createWatchlist(req.user.userId, data.listName);
        res.status(201).json("watchlist creation successful.");
    } catch (err) {
        logger.error(`Error creating watchlist: ${err.message}`);
        res.status(400).json(err.message);
    }
});

module.exports = router;