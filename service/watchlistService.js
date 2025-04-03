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

    const watchlist = await watchlistDao.getWatchlistByUserIdAndListName(userId, listName);
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

    // Updates both User and Watchlist
    await userDao.updateLikedLists(userId, user.likedLists);
    await watchlistDao.updateWatchlist(listId, {likes: watchlist.likes})

    logger.info(`Watchlist and User likes successfully updated: ${listId} AND ${userId}`);
    return action;
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

        const watchlistByName = await watchlistDao.getWatchlistByUserIdAndListName(userId, listName);

        // Check if the name already exists
        // If a list with that name is found, ckeck if it is the same as the one currently being updated
        if (watchlistByName && watchlistByName[0].listId !== listId) {
            throw new Error("A watchlist with that name already exists!");
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

async function getWatchlist(user, listId){
    try {

        if(!listId || !user){
            throw new Error("bad data");
        }
    
        const watchlist = await watchlistDao.getWatchlistByListId(listId);
    
        if(!watchlist){
            throw new Error("Watchlist doesn't exist!");
        }
        if(watchlist.isPublic){
            return watchlist;
        }

        collaboratorIndex = watchlist.collaborators.indexOf(user.userId);


        if((user.userId != watchlist.userId) && (collaboratorIndex < 0) && !(user.isAdmin)){
            return null;
        }
        return watchlist;

    } catch (error) {
        logger.error(`Error in getWatchlist service: ${error.stack}`);
        throw error;
    }
    
}

async function commentOnWatchList(userData, listData) {

    try {
        const { listId, comment } = listData;
        const { userId, username } = userData;

        if (!comment?.trim()) {
            throw new Error("Comment cannot be empty.");
        }

        const existingWatchList = await watchlistDao.getWatchlistByListId(listId);

        if (!existingWatchList) {
            throw new Error("WatchList not found");
        }

        //if private list, only collaborators or owner can comment
        if(!existingWatchList.isPublic){
            if (!existingWatchList.collaborators.includes(userId) && existingWatchList.userId !== userId) {
                throw new Error("Unauthorized: You cannot comment on this watchlist.");
            }
        }
        
        const commentWatchlist = {
            commentId: uuid.v4(),
            userId,
            comment,
            datePosted: new Date().toISOString(),
            username
        };

        //Ensure comments is an array before pushing
        let comments = Array.isArray(existingWatchList.comments) ? existingWatchList.comments : [];

        comments.push(commentWatchlist); 

        const updatedList = await watchlistDao.updateWatchlist(listId, {comments});

        return {
            message: "Comment added successfully",
            comment: commentWatchlist
        };
    } catch (error) {
        logger.error(`Error in updateWatchList service: ${error.stack}`);
        throw error;
    }
}

module.exports = {createWatchlist, updateWatchlist, getWatchlist, likeWatchlist, commentOnWatchList}
