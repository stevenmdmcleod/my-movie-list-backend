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

async function updateWatchlist(userId, listId, data) {

    try {
        const { isPublic, listName } = data;

        if (!listName?.trim()) {
            throw new Error("List name cannot be empty.");
        }
        if (typeof isPublic !== "boolean") {
            throw new Error("isPublic must be a boolean.");
        }

        const existingWatchList = await watchlistDao.getWatchlistByListId(listId);
        
        if (!existingWatchList) {
            throw new Error("WatchList not found");
        }

        if (existingWatchList.userId !== userId) {
            throw new Error("Unauthorized: You can only update your own watchlist.");
        }

        const updatedList = await watchlistDao.updateWatchlist(listId, {listName, isPublic});

        return {
            message: "Watchlist updated successfully",
            watchlist: updatedList
        };
    } catch (error) {
        logger.error(`Error in updateWatchList service: ${error.stack}`);
        throw error;
    }
}


module.exports = {createWatchlist, updateWatchlist}