const watchlistDao = require("../repository/watchlistDAO");
const userDao = require("../repository/userDAO");
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

async function likeWatchlist(userId, listId) {
    const user = await userDao.getUserByUserId(userId);

    if (!user) {
        throw new Error("User could not be found");
    }

    const watchlist = await watchlistDao.getWatchlistByListId(listId);
    if (!watchlist) {
        throw new Error("Watchlist could not be found")
    }

    let action;
    if (watchlist.likes.includes(userId)) {
        watchlist.likes = watchlist.likes.filter(id => id !== userId);
        user.likedLists = user.likedLists.filter(id => id !== listId);
        action = 'disliked';
    } else {
        watchlist.likes.push(userId);
        user.likedLists.push(listId);
        action = 'liked';
    }

    await userDao.updateLikedLists(userId, user.likedLists);
    await watchlistDao.updateLikes(listId, watchlist.likes);

    logger.info(`Watchlist and User likes successfully updated: ${listId} AND ${userId}`);
    return action;
}

module.exports = {createWatchlist, likeWatchlist}