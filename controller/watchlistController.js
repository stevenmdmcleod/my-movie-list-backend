const express = require("express");
const router = express.Router();
const watchlistService = require('../service/watchlistService');
const { authenticateToken } = require("../util/jwt");
require('dotenv').config();
const SECRET_KEY = process.env.SECRET_KEY;
const logger = require("../util/logger");

router.post("/", authenticateToken, async (req, res) => {
    
    if(!req.user.userId){
        return res.status(400).json({message: "invalid token data"});
    }
    const data = req.body;
    
    if(!data.listName){
        return res.status(400).json({message: "requires a listName"});
    }
    try {
        const result = await watchlistService.createWatchlist(req.user.userId, data.listName);
        res.status(201).json({message: "watchlist creation successful.", watchlist: result});
    } catch (err) {
        logger.error(`Error creating watchlist: ${err.message}`);
        res.status(400).json(err.message);
    }
});

router.patch("/:listId/likes" , authenticateToken, async (req, res) => {
    if(!req.user.userId){
        return res.status(400).json("invalid token data");
    }

    try {
        const result = await watchlistService.likeWatchlist(req.user.userId, req.params.listId);
        res.status(200).json(`List has been successfully ${result}`);
    } catch (error) {
        logger.error(`Error liking watchlist: ${error.message}`);
        res.status(400).json(error.message);
    }
})


router.get("/my-watchlists", authenticateToken, async (req, res) => {
    if (!req.user.userId) {
        return res.status(400).json("Missing required JWT information")
    }

    try {
        list = await watchlistService.getUserWatchlists(req.user.userId);
        return res.status(200).json({message: "Successfully retrieved list of watchlists!", watchlists: list});
    } catch (error) {
        logger.error(`Error retrieving watchlists: ${error.message}`);
        return res.status(500).json(error.message);
    }
})

router.get("/collaborative-lists", authenticateToken, async (req, res) => {
    if (!req.user.userId) {
        return res.status(400).json("Missing required JWT information")
    }

    try {
        list = await watchlistService.getCollaborativeLists(req.user.userId);
        return res.status(200).json({message: "Successfully retrieved list of collaborative watchlists!", watchlist: list});
    } catch (error) {
        logger.error(`Error retrieving collaborative lists: ${error.message}`);
        return res.status(400).json(error.message);
    }
})


router.patch("/:listId/collaborators", authenticateToken, validateAddCollaborator, async (req, res) => {
    try {
        await watchlistService.addCollaborators(req.user.userId, req.params.listId, req.body.collaborator);
        res.status(200).json("Collaborator successfully added")
    } catch (error) {
        logger.error(`Error adding collaborators: ${error.message}`);
        res.status(400).json(error.message);
    }
})





router.delete("/:listId/collaborators", authenticateToken, validateAddCollaborator, async (req, res) => {
    try {
        await watchlistService.removeCollaborator(req.user, req.params.listId, req.body.collaborator);
        res.status(200).json("Collaborator successfully removed")
    } catch (error) {
        logger.error(`Error removing collaborator: ${error.message}`);
        res.status(400).json(error.message);
    }
})


function validateAddCollaborator(req, res, next) {
    if (!req.user.userId) {
        return res.status(400).json("Missing required JWT information")
    }

    if (!req.body.collaborator || req.body.collaborator.length == 0) {
        return res.status(400).json("Missing collaborator attribute in request body")
    }
    next();
}

//update list name and isPublic
router.put("/:listId", authenticateToken, async (req, res) => {
    try {
        const { listId } = req.params;
        const { isPublic, listName } = req.body;
        const userId = req.user.userId;

        const data = await watchlistService.updateWatchlist(userId, listId, { isPublic, listName });

        res.status(200).json(data);
    } catch (err) {
        logger.error(`Error updating  watchlist: ${err.message}`);

        // handle error message and status code
        if (err.message === "List name cannot be empty." || err.message === "isPublic must be a boolean.") {
            return res.status(400).json({ error: err.message });
        }
        if (err.message === "WatchList not found") {
            return res.status(404).json({ error: err.message });
        }
        if (err.message === "Unauthorized: You can only update your own watchlist.") {
            return res.status(403).json({ error: err.message });
        }
        if (err.message === "A watchlist with that name already exists!") {
            return res.status(409).json({ error: err.message });
        }

        // server error
        res.status(500).json({ error: "Internal Server Error" });
    }
});

//comment on a watchlist
router.put("/:listId/comments", authenticateToken, async (req, res) => {
    try {
        const { listId } = req.params;
        const { comment } = req.body;
        const userId = req.user.userId;
        const username = req.user.username;

        const data = await watchlistService.commentOnWatchList({userId, username, listId, comment} );

        res.status(200).json(data);
    } catch (err) {
        logger.error(`Error updating  watchlist: ${err.message}`);
        res.status(403).json(err.message);
    }
});

router.get("/:listId", authenticateToken, async (req, res) => {
    if(!req.user || !req.params.listId){
        return res.status(400).json({message: "Bad request data"});
    }
    
    user = req.user;
    listId = req.params.listId;

    try {
        result = await watchlistService.getWatchlist(user, listId);

        if(!result){
            return res.status(400).json("User does not have permission to get this watchlist");
        }
        return res.status(200).json(result);
    } catch (error) {
        return res.status(400).json(error);
    }
});

//delete a comment
router.put("/:listId/comments/:commentId", authenticateToken, async (req, res) => {
    try {
        if (req.user.isAdmin == false) {
            logger.error(`Error: non-admin attempting access to admin route`);
            return res.status(403).json({message: "Forbidden Access: must be an admin to access this route"});
        }

        const { listId } = req.params;
        const { commentId } = req.params;

        const data = await watchlistService.deleteCommentOnWatchList(listId, commentId);

        res.status(200).json(data);
    } catch (err) {
        logger.error(`Error updating  watchlist: ${err.message}`);
        res.status(403).json(err.message);
    }
});

router.patch("/:listId/titles", authenticateToken, async (req, res) => {
    try {        
        const result = await watchlistService.addOrRemoveTitle(req.user.userId, req.params.listId, req.body.titleId);
        res.status(200).json(`Title has been successfully ${result}`)
    } catch (error) {
        logger.error(`Error adding/removing title: ${error.message}`);
        res.status(400).json(error.message);
    }
})

module.exports = router;