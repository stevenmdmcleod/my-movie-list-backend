const watchlistDao = require("../repository/watchlistDAO");
const uuid = require('uuid');
const logger = require("../util/logger");
const { error } = require("winston");

async function createWatchlist(userId, listName) {
    
    if(!userId || !listName){
        throw new Error("invalid data");
    }
    if(listName.length < 1 || listName.length > 30){
        throw new Error("listName must be between 1 and 30 characters long");
    }
    if(listName.indexOf(" ") >= 0){
        throw new Error("listName can not contain spaces!");
    }

    const watchlist = await watchlistDao.getListByUserIdAndListName(userId, listName);
    if(watchlist){
        throw new Error("watchlist with that name already exists!");
    }

    try {    
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
        logger.info(`List successfully created: ${listName}`);
        return result;
    } catch (err) {
        logger.error(`Error in PostList: ${err.message}`);
        throw err;
    }    
}


module.exports = {createWatchlist}