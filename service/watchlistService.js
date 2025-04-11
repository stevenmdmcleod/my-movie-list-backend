const watchlistDao = require("../repository/watchlistDAO");
const userDao = require("../repository/userDAO");
const uuid = require('uuid');
const logger = require("../util/logger");
const { unmarshall } = require("@aws-sdk/util-dynamodb");
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
        logger.error(`Error in getWatchlist service: ${error}`);
        throw error;
    }
    
}


async function getUserWatchlists(userId){
    try {

        
        if(!userId){
            throw new Error("bad data");
        }
    
        const lists = await watchlistDao.getWatchlistsByUserId(userId);

        
        if(!lists){
            throw new Error("No lists found");
        }
        else{
            return lists;
        }

    } catch (error) {
        logger.error(`Error in getUserWatchlists service: ${error}`);
        throw error;
    }
    
}


async function getCollaborativeLists(userId){
    try {

        if(!userId){
            throw new Error("bad data");
        }
    
        const user = await userDao.getUserByUserId(userId);
        
        if(!user){
            throw new Error("User not found");
            
        }
        const collabLists = user.collaborativeLists;
        
        let foundCollabLists = []

        for(let i = 0; i < collabLists.length; i++){

            currListId = collabLists[i];
            currList = await watchlistDao.getWatchlistByListId(currListId);

            if(!currList){
                logger.error(`list ${currListId} not found`);
            }
            else{
                foundCollabLists.push(currList);
            }

        }
        return foundCollabLists;


    } catch (error) {
        logger.error(`Error in getCollaborativeLists service: ${error}`);
        throw error;
    }
    
}


async function removeCollaborator(user, listId, userId){
    if(!user || !listId || !userId){
        throw new Error("Bad Data");
    }
    
    try {
        

    const userToRemove = await userDao.getUserByUserId(userId);

    if(!userToRemove){
        throw new Error("User not found");
    }

    const watchlist = await watchlistDao.getWatchlistByListId(listId);

    
    if(!watchlist){
        throw new Error("Watchlist not found");
    }
    if(!(watchlist.collaborators.indexOf(userId) >= 0)){
        throw new Error("User is not a collaborator of this watchlist!");
    }

    if(!userToRemove.collaborativeLists){
        throw new Error("user is missing collaborativeLists");
    }
    //check if user removing is themselves or if user is owner of watchlist
    if((user.userId == userId) || (user.userId == watchlist.userId)){

        //user's list of collaborative lists
        newUserCollaborativeLists = userToRemove.collaborativeLists.filter(obj => obj != listId);

        //watchlist's collaborators
        newWatchlistCollaborators = watchlist.collaborators.filter(obj => obj != userToRemove.userId);
        
        await userDao.updateUser(userId, {collaborativeLists: newUserCollaborativeLists});
        await watchlistDao.updateWatchlist(listId, {collaborators: newWatchlistCollaborators});
        logger.info(`Watchlist ${listId} and User successfully updated to remove collaborator: ${userId}`);
    }
    else{
        throw new Error("You do not have permission to remove this User from the watchlist");
    }
    } catch (error) {
        throw error;
    }
    
}

async function addCollaborators(userId, listId, collaboratorId) {
    try {
        const watchlist = await watchlistDao.getWatchlistByListId(listId);

        if (!watchlist) {
            throw new Error("Watchlist doesn't exist!");
        }

        const user = await userDao.getUserByUserId(userId);

        if (!user) {
            throw new Error("User could not be found");
        }

        const collaborator = await userDao.getUserByUserId(collaboratorId);
        
        if (!collaborator) {
            throw new Error("User could not be found from collaborator ID")
        }

        if (watchlist.userId !== user.userId) {
            throw new Error("User must be owner of the watchlist to add a collaborator");
        }

        if (watchlist.userId === collaborator.userId) {
            throw new Error("Watchlist creator is already an implied collaborator, cannot add to list");
        }

        const userFriendsListIds = user.friends.map(friend => friend.userId)

        if (!userFriendsListIds.includes(collaborator.userId)) {
            throw new Error("User must be a friend to become a collaborator");
        }

        if (watchlist.collaborators.includes(collaborator.userId)) {
            throw new Error("User is already a collaborator");
        }

        const newCollaboratorCollaborativeLists = [
            ...collaborator.collaborativeLists,
            watchlist.listId
        ]

        const newWatchlistCollaborators = [
            ...watchlist.collaborators,
            collaborator.userId
        ]

        await watchlistDao.updateWatchlist(watchlist.listId, {collaborators: newWatchlistCollaborators});
        await userDao.updateUser(collaborator.userId, {collaborativeLists: newCollaboratorCollaborativeLists});

        logger.info(`Watchlist and User collaborators successfully updated: ${watchlist.listId} AND ${collaborator.userId}`);
    } catch (error) {
        throw error
    }
}


async function commentOnWatchList(data) {

    try {
        const { userId, username, listId, comment } = data;

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
        
        const newComment = {
            commentId: uuid.v4(),
            userId,
            comment,
            datePosted: new Date().toISOString(),
            username
        };

        //Ensure comments is an array before pushing
        let comments = Array.isArray(existingWatchList.comments) ? existingWatchList.comments : [];

        comments.push(newComment); 

        const updatedList = await watchlistDao.updateWatchlist(listId, {comments});

        return {
            message: "Comment added successfully",
            comment: newComment
        };
    } catch (error) {
        logger.error(`Error in updateWatchList service: ${error.stack}`);
        throw error;
    }
}

async function deleteCommentOnWatchList(listId, commentId) {

    try {

        const existingWatchList = await watchlistDao.getWatchlistByListId(listId);

        if (!existingWatchList) {
            throw new Error("WatchList not found");
        }

        //ensure comments is an array(not empty object)
        if (!Array.isArray(existingWatchList.comments)) {
            existingWatchList.comments = []; 
        }

        const commentExists = existingWatchList.comments.some(comment => comment.commentId === commentId);
        if (!commentExists) {
            throw new Error("Comment not found");
        }

        //remove comment from commentList
        const updatedComments = existingWatchList.comments.filter(comment => comment.commentId !== commentId);

        const updatedList = await watchlistDao.updateWatchlist(listId, {comments: updatedComments});

        return {
            message: "Comment deleted successfully",
            watchlist: updatedList
        };
    } catch (error) {
        logger.error(`Error in deletComentOnWatchList service: ${error.stack}`);
        throw error;
    }
}

async function addOrRemoveTitle(userId, listId, titleId) {
    try {

        if (!titleId?.trim() || !userId?.trim() || !listId?.trim()) {
            throw new Error("TitleId, UserId and ListId must be provided.");
        }

        const watchlist = await watchlistDao.getWatchlistByListId(listId);

        if (!watchlist) {
            throw new Error("Watchlist doesn't exist!");
        }

        const user = await userDao.getUserByUserId(userId);

        if (!user) {
            throw new Error("User could not be found");
        }

        //only collaborators or owner can add/remove titles
        if (!watchlist.collaborators.includes(userId) && watchlist.userId !== userId) {
            throw new Error("User must be owner or collaborator on the watchlist to add a title");
        }

        let action;
        let updatedTitles = Array.isArray(watchlist.titles) ? watchlist.titles : [];
    
        if (updatedTitles.includes(titleId)) {
            updatedTitles = updatedTitles.filter(id => id !== titleId);
            
            action = 'removed';
        } else {
            updatedTitles.push(titleId);
            action = 'added';
            //add to recentlyAdded
            const newUserRecentlyAdded = Array.isArray(user.recentlyAdded) ? [...user.recentlyAdded, titleId].slice(-10) : [titleId];

            await userDao.updateUser(userId, {recentlyAdded: newUserRecentlyAdded});
        }

        await watchlistDao.updateWatchlist(listId, {titles: updatedTitles});

        logger.info(`Watchlist successfully updated: ${listId}`);
        return action;
    } catch (error) {
        throw error
    }
}

async function getAllComments(){
    try {
    
        const items = await watchlistDao.getAllWatchlists();        
        
        const allComments = items
            .map(item => unmarshall(item))
            .flatMap(watchlist => 
                (watchlist.comments || []).map(comment => ({
                ...comment,
                watchlistName: watchlist.listName,
                watchlistId: watchlist.listId // Add the watchlistId to each comment
              }))
            );
        
        const sortedComments = allComments.sort((a, b) => {
            const dateA = new Date(a.datePosted);
            const dateB = new Date(b.datePosted);
        
            return dateB - dateA; // Sort in descending order (newest first)
            });

        return sortedComments;
    } catch (error) {
        logger.error(`Error in getAllComments service: ${error}`);
        throw error;
    }
    
}

async function getAllWatchlists(){
    try {    
        const items = await watchlistDao.getAllWatchlists();        

        const unmarshalled = items.map(item => unmarshall(item));        

        //add username to watchlist object
        const withUsernames = await Promise.all(unmarshalled.map(async (watchlist) => {
            const user = await userDao.getUserByUserId(watchlist.userId);
            return {
                ...watchlist,
                username: user ? user.username : "unknown"
            };
        }));

        // Sort by number of likes
        const sortedWatchlists = withUsernames.sort((a, b) => {
            const aLikes = Array.isArray(a.likes) ? a.likes.length : 0;
            const bLikes = Array.isArray(b.likes) ? b.likes.length : 0;
            return bLikes - aLikes;
        });

        return sortedWatchlists;
    } catch (error) {
        logger.error(`Error in getAllWatchlists service: ${error}`);
        throw error;
    }    
}

async function getPublicWatchlists(){
    try {    
        const items = await watchlistDao.getAllWatchlists();        

        const unmarshalled = items.map(item => unmarshall(item));
        const publicWatchlists = unmarshalled.filter(w => w.isPublic);

        //add username to watchlist object
        const withUsernames = await Promise.all(publicWatchlists.map(async (watchlist) => {
            const user = await userDao.getUserByUserId(watchlist.userId);
            return {
                ...watchlist,
                username: user ? user.username : "unknown"
            };
        }));

        // Sort by number of likes
        const sortedWatchlists = withUsernames.sort((a, b) => {
            const aLikes = Array.isArray(a.likes) ? a.likes.length : 0;
            const bLikes = Array.isArray(b.likes) ? b.likes.length : 0;
            return bLikes - aLikes;
        });

        return sortedWatchlists;
    } catch (error) {
        logger.error(`Error in getPublicWatchlists service: ${error}`);
        throw error;
    }    
}

module.exports = {createWatchlist, updateWatchlist, getWatchlist, likeWatchlist,
     commentOnWatchList, addCollaborators, deleteCommentOnWatchList, removeCollaborator, 
     getCollaborativeLists, getUserWatchlists, addOrRemoveTitle, getAllComments, getAllWatchlists,
     getPublicWatchlists}
