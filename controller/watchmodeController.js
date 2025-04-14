const express = require("express");
const router = express.Router();
require('dotenv').config();
const logger = require("../util/logger");

router.get('/title/:titleId', async (req, res) => {
    try {
        const response = await fetch(`https://api.watchmode.com/v1/title/${req.params.titleId}/details/?apiKey=${process.env.WATCHMODE_API_KEY}`)
        if (response.status === 200) {
            const responseJSON = await response.json();
            return res.status(200).json(responseJSON)
        }
    } catch (error) {
        logger.error(`Error retrieving title from Watchmode API for title: ${req.params.titleId}`);
        return res.status(400).json(error.message);
    }
})

module.exports = router;