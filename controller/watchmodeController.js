const express = require("express");
const router = express.Router();
require('dotenv').config();
const logger = require("../util/logger");

// Get title by titleId
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

// Get search results by name
// Name query string required: /search?name=spiderman
// Spaces in query string must be replaced with %20 examples: Ed Wood -> Ed%20Wood
router.get('/search', async (req, res) => {
    try {
        if (!(req.query.name)) {
            return res.status(400).json("Missing required query string: name");
        }

        const response = await fetch(`https://api.watchmode.com/v1/search/?apiKey=${process.env.WATCHMODE_API_KEY}&search_field=name&search_value=${req.query.name}`)
        console.log(response)
        if (response.status === 200) {
            const responseJSON = await response.json();
            return res.status(200).json(responseJSON);
        }
    } catch (error) {
        logger.error(`Error retrieving search results: ${req.query.name}`);
        return res.status(400).json(error.message);
    }
})

module.exports = router;