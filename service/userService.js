const userDao = require("../repository/userDAO");
const bcrypt = require("bcrypt");
const uuid = require('uuid');
const logger = require("../util/logger");

async function createUser(user) {
    
    try { 

        if(!validateEmail(user.email)) {
            logger.info("Email is not valid");
            throw new Error("Email is not valid");
        }
        
        if(!validateUser(user)) {
            logger.info("Username and Password must be longer than 7 characters");
            throw new Error("Username and Password must be longer than 7 characters");
        }

        const userByUsername = await userDao.getUserByUsername(user.username);

        if (userByUsername) {
            logger.info("Username already exists");
            throw new Error("Username already exists");
        }

        const userByEmail = await userDao.getUserByEmail(user.email);

        if (userByEmail) {
            logger.info("Email already exists");
            throw new Error("Email already exists");
        }

        const saltRounds = 10;
        const hashPass = await bcrypt.hash(user.password, saltRounds);
        const userId = uuid.v4();
        const result = await userDao.createUser({
            userId, 
            username: user.username, 
            password: hashPass, 
            email: user.email,
            isAdmin: false,
            isBanned: false,
            profilePicture: "",
            biography: "",
            preferredGenres: [],
            friends: [],
            recentlyAdded: []
        });
        logger.info(`User successfully created: ${user.username}`);
        return result;
    } catch (err) {
        logger.error(`Error in postUser: ${err.message}`);
        throw err;
    }    
}

function validateUser(user) {
    return user.username.length > 7 && user.password.length > 7;
}

function validateEmail(email) {
    var re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
}

async function changePassword(data, user) {
    try {
        const userFromUserId = await userDao.getUserByUserId(user.userId);

        if (!userFromUserId) {
            throw new Error("User could not be found");
        }
        
        if(!(data.password.length > 7)) {
            throw new Error("Password must be longer than 7 characters");
        }

        const saltRounds = 10;
        const hashPass = await bcrypt.hash(data.password, saltRounds);

        await userDao.changePassword(user.userId, hashPass);

        logger.info(`Password successfully changed: ${user.userId}`);
    } catch (error) {
        throw error;
    }
}

module.exports = {createUser, changePassword}