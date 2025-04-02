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
            recentlyAdded: [],
            collaborativeLists: [],
            likedLists: []
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

async function validateLogin(username, password){
    if(!username || !password){
        return null;
    }

    const user = await userDao.getUserByUsername(username);
    if(!user){
        return null;
    }

    if(user && (await bcrypt.compare(password, user.password)) ){
        return omit(user, 'password');
    }
    else{
        return null;
    }
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

async function addFriend(friendUsername, userId) {
    try {
        const userFromUsername = await userDao.getUserByUsername(friendUsername);
        if (!userFromUsername) {
            throw new Error("Friend username could not be found");
        }

        const userFromUserId = await userDao.getUserByUserId(userId);
        if (!userFromUserId) {
            throw new Error("User could not be found");
        }

        for (let friend of userFromUserId.friends) {
            if (friend.userId === userFromUsername.userId) {
                throw new Error("User already friends");
            }
        }

        let newFriendsList = [
            ...userFromUserId.friends, 
            {
                userId:userFromUsername.userId, 
                username:userFromUsername.username
            }
        ]
        
        await userDao.addFriend(newFriendsList, userId);
        logger.info(`Friend successfully added: ${friendUsername} to ${userId}`);
    } catch (error) {
        throw error;
    }
}

async function deleteUser(userToken) {
    try {
        const userFromUserId = await userDao.getUserByUserId(userToken.userId);

        if (!userFromUserId) {
            throw new Error("User could not be found");
        }

        await userDao.deleteUser(userToken.userId)
    } catch (error) {
        throw error;
    }
}


async function getFriendsList(userId){
    try {
        if(!userId){
            throw new error("need a valid userId");
        }

        let newfriendslist = [];
        const friendslist = await userDao.getFriendsListByUserId(userId);
        
        if(!friendslist){
            throw new error("friendslist not retrieved");
        }

        for(let i = 0; i < friendslist.length; i++){
            currfriend = friendslist[i];
            newfriendslist.push({
                userId: currfriend.userId,
                username: currfriend.username,
                profilePicture: currfriend.profilePicture,
                biography: currfriend.biography,
                preferredGenres: currfriend.preferredGenres})
        }
        return newfriendslist;

    } catch (error) {
        throw(error);
    }
}

async function banUser(userId, banStatus) {
    try {
        const userFromUserId = await userDao.getUserByUserId(userId);
  
        if (!userFromUserId) {
            throw new Error("User could not be found");
        }
  
        if (banStatus === 'banned'){
            await userDao.banUser(userId, true);
            logger.info(`User ban status changed changed: ${userId}, ${banStatus}`);
        }
  
        if (banStatus === 'unbanned'){
            await userDao.banUser(userId, false);
            logger.info(`User ban status changed changed: ${userId}, ${banStatus}`);
        }
    } catch (error) {
        throw error;
    }
  }

function omit(obj, keyToOmit) {
    const { [keyToOmit]: omitted, ...rest } = obj;
    return rest;
  }

async function updateUserProfile(user, userData, file) {

    try {
        const oldProfile = await userDao.getUserByUserId(user.userId);
        if (!oldProfile) {
            throw new Error("User could not be found");
        }

        let fileName = oldProfile.profilePicture; // Retain existing profile picture if no file is uploaded

        // If a new file is uploaded, generate a new filePath, upload new image to S3, and delete the old image
        if (file) {
            fileName = `profile/${uuid.v4()}-${file.originalname}`;

            await Promise.all([
                userDao.deleteS3File(oldProfile.profilePicture),
                userDao.uploadFileToS3(file, fileName)
            ]);
        } 

        // Generate signed URL if a profile picture exists
        signedUrl = fileName ? await userDao.generateSignedUrl(fileName) : null;

        // Merge updated data with existing profile
        const newProfile = {
            biography: userData.biography?.trim() || oldProfile.biography,
            preferredGenres: userData.preferredGenres?.length ? userData.preferredGenres : oldProfile.preferredGenres,
            profilePicture: fileName
        };

        const updatedProfile = await userDao.updateProfile(user.userId, newProfile);

        return {
            message: "Profile updated successfully",
            user: updatedProfile,
            signedUrl
        };
    } catch (error) {
        logger.error(`Error in updateUserProfile: ${error.stack}`);
        throw error;
    }
}

module.exports = {createUser, changePassword, validateLogin, deleteUser, addFriend, getFriendsList, updateUserProfile, banUser}
