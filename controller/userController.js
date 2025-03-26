const express = require("express");
const router = express.Router();
const userService = require('../service/userService');
const logger = require("../util/logger");
const jwt = require("jsonwebtoken");
const { authenticateToken } = require("../util/jwt");
require('dotenv').config();
const SECRET_KEY = process.env.SECRET_KEY;

router.post("/register", validateUserData, async (req, res) => {
    try {
        const data = await userService.createUser(req.body);
        res.status(201).json("Registration successful.");
    } catch (err) {
        logger.error(`Error registering user: ${err.message}`);
        res.status(400).json(err.message);
    }
});

function validateUserData(req, res, next) {
    const data = req.body;
    if(data.username && data.password && data.email) {
        next();
    } else {
        res.status(400).json("Username, email and password required");
    }
}

module.exports = router;