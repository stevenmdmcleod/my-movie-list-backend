const express = require("express");
const router = express.Router();
const userService = require('../service/userService');
const logger = require("../util/logger");
const jwt = require("jsonwebtoken");
const { authenticateToken, optionalToken } = require("../util/jwt");
require('dotenv').config();
const SECRET_KEY = process.env.SECRET_KEY;
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({storage: storage});

//register a user
router.post("/register", validateUserData, async (req, res) => {
    try {
        const data = await userService.createUser(req.body);
        res.status(201).json({message: "Registration successful.", user: {userId: data.userId, username: data.username, email: data.email}});
    } catch (err) {
        logger.error(`Error registering user: ${err.message}`);
        res.status(400).json(err.message);
    }
});

//login user
router.post("/login", async (req, res) => {
    const {username, password} = req.body;
    //console.log(username, password);
    if(!username || !password){
        return res.status(400).json({message: "bad request, please try again"})
    }
    const data = await userService.validateLogin(username, password);
    //console.log(data);
    if(data){
        
        const token = jwt.sign(
            {
                userId: data.userId,
                username: username,
                isAdmin: data.isAdmin,
                isBanned: data.isBanned
            },
                SECRET_KEY,
            {
                expiresIn: "60m"
        })
        res.status(200).json({message: "You have logged in!", token});
    }else{
        res.status(401).json({message: "Invalid login"});
    }
})

//change password
router.post("/change-password", authenticateToken, async (req, res) => {
    try {
        if (!(req.body.password)) {
            throw new Error("Password is missing");
        }

        await userService.changePassword(req.body, req.user);
        res.status(200).json("Password successfully changed.")
    } catch (error) {
        logger.error(`Error changing password: ${error.message}`);
        res.status(400).json(error.message);
    }
})

//add a friend
router.patch("/friends", authenticateToken, async (req, res) => {
    if (!(req.body.username) || !(req.user) || !(req.user.userId)) {
        return res.status(400).json({message: "Bad request: missing username or required token attributes"});
    }

    try {
        await userService.addFriend(req.body.username, req.user.userId);
        res.status(200).json("Friend successfully added.");
    } catch (error) {
        logger.error(`Error adding friend: ${error.message}`);
        res.status(400).json(error.message);
    }
})

//delete the account
router.delete("/me", authenticateToken, async (req, res) => {
    try {
        await userService.deleteUser(req.user);
        res.status(200).json("User successfully deleted.")
    } catch (error) {
        logger.error(`Error deleting account: ${error.message}`);
        res.status(400).json(error.message);
    }
})

//get user by user ID
router.get("/userId/:userId", optionalToken, async (req, res) => {
    try {
        const user = await userService.getUserByUserId(req.params.userId);
        return res.status(200).json(user);
    } catch (error) {
        logger.error(`Error retrieving user by ID: ${error.message}`);
        return res.status(400).json(error.message);
    }
})

//get all friends
router.get("/friends", authenticateToken, async (req, res) => {
    try {
        if(!req.user || !req.user.userId){
            return res.status(400).json({message: "Bad request, please make sure token attributes are correct."});
        }
        
        const id = req.user.userId
        const friendslist = await userService.getFriendsList(id);
        return res.status(200).json(friendslist);

    } catch (error) {
        logger.error(`Error retrieving friends: ${error.message}`);
        return res.status(400).json(error.message);
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

//update profile: genres, biography, profilePicture
router.put('/update-profile', authenticateToken, upload.single('image'), async (req, res) => {
    
    try {
        let { biography, preferredGenres } = req.body;

        const file = req.file; 

        // if (!file) {
        //     return res.status(400).json({ error: "No file to upload"});
        // }
  
        // Ensure preferredGenres is always an array
        if (!Array.isArray(preferredGenres)) {
            preferredGenres = preferredGenres ? [preferredGenres] : [];
        }

        if (file && !validateFileType(file)) {
            return res.status(400).json({ error: "Invalid file type. Only JPEG, JPG, and PNG are allowed." });
        }
        
        const result = await userService.updateUserProfile(req.user, { biography, preferredGenres }, file);

        res.status(200).json(result);
      } catch (error) {
        logger.error(`Error updating profile: ${error.message}`);
        res.status(400).json({ error: error.message });
      }
});

function validateFileType(file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    return allowedTypes.includes(file.mimetype);
}

//ban or unban user for admin
router.patch("/:userId/ban-status", authenticateToken, validateBanRequest, async ( req, res) => {
    try {
        await userService.banUser(req.params.userId, req.body.status);
        res.status(200).json(`User has been successfully ${req.body.status}`);
    } catch (error) {
        logger.error(`Error banning account: ${error.message}`);
        res.status(400).json(error.message);
    }
  })

function validateBanRequest(req,res,next) {
    if (!(req.body.status) || req.body.status.length == 0) {
        logger.error(`Error banning account: missing ban status`);
        return res.status(400).json({message: "Bad request: missing ban status"});
    }
  
    if (req.body.status !== 'banned' && req.body.status !== 'unbanned') {
        logger.error(`Error banning account: invalid ban status`);
        return res.status(400).json({message: "Bad request: invalid ban status"});
    }
  
    if (!(req.user)) {
        logger.error(`Error banning account: missing JWT information`);
        return res.status(400).json({message: "Bad request: missing required JWT information"});
    }
    
    if (req.params.userId === req.user.userId) {
        logger.error(`Error banning account: admin cannot ban themselves`);
        return res.status(403).json({message: "Forbidden Access: admin cannot ban themselves"});
    }
  
    if (req.user.isAdmin == false) {
        logger.error(`Error banning account: non-admin attempting access to admin route`);
        return res.status(403).json({message: "Forbidden Access: must be an admin to access this route"});
    }
  
    next();
  }

//get all users for admin
router.get("/users", authenticateToken, async (req, res) => {
    try {
        if (req.user.isAdmin == false) {
            logger.error(`Error: non-admin attempting access to admin route`);
            return res.status(403).json({message: "Forbidden Access: must be an admin to access this route"});
        }

        const users = await userService.getAllUsers();
        res.status(200).json(users);
      } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
      }
})

module.exports = router;