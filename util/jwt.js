const jwt = require("jsonwebtoken");
const logger = require("./logger");


require('dotenv').config();
const SECRET_KEY = process.env.SECRET_KEY;

async function authenticateToken(req, res, next){

    // authorization: "Bearer tokenstring"
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if(!token){
        return res.status(401).json({message: "No token provided: Forbidden Access!"});
        
    }
    jwt.verify(token, SECRET_KEY, (err, decodedToken) => {
        if (err) {
            
            return res.status(403).json({ message: 'Invalid token, forbidden Access!' });
        }
        else{
        req.user = decodedToken;  // Add the decoded token to the request object
        next();  // Proceed to the next middleware or route handler
        }
    });   
}

async function optionalToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (
        typeof token !== "string" ||
        token === "null" ||
        token === "undefined" ||
        token.trim() === ""
    ) {
        req.user = null;
        next();
        return;
    }
    jwt.verify(token, SECRET_KEY, (err, decodedToken) => {
        if (err) {
            
            return res.status(403).json({ message: 'Invalid token, forbidden Access!' });
        }
        else{
        req.user = decodedToken;  // Add the decoded token to the request object
        next();  // Proceed to the next middleware or route handler
        }
    });   
}

module.exports = {
    authenticateToken,
    optionalToken
}
