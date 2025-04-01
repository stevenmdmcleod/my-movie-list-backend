const watchlistDao = require("../repository/watchlistDAO");
const uuid = require('uuid');
const logger = require("../util/logger");

async function createWatchlist(userId, listName) {
    
    try { 

        if (userByUsername) {
            logger.info("Username already exists");
            throw new Error("Username already exists");
        }

        const userByEmail = await userDao.getUserByEmail(user.email);

        if (userByEmail) {
            logger.info("Email already exists");
            throw new Error("Email already exists");
        }

        
        const listId = uuid.v4();
        const result = await watchlistDao.createWatchlist({
            listId,
            userId: userId,
            listName: listName,
            collaborators: [],
            likes: [],
            titles: [],
            comments: [],
            isPublic: true
            



        });
        logger.info(`List successfully created: ${user.username}`);
        return result;
    } catch (err) {
        logger.error(`Error in PostList: ${err.message}`);
        throw err;
    }    
}