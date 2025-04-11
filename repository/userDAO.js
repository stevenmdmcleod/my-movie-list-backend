const {dbClient, s3} = require("../util/config");
const {PutCommand, QueryCommand, GetCommand, UpdateCommand, DeleteCommand} = require("@aws-sdk/lib-dynamodb");
const logger = require("../util/logger");
const {PutObjectCommand, GetObjectCommand, DeleteObjectCommand} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { ScanCommand } = require("@aws-sdk/client-dynamodb");

const TableName = 'my-movie-list-users';
const BucketName = process.env.BUCKET_NAME;

async function createUser(user) {
    const command = new PutCommand({
        TableName,
        Item: user
    })

    try {
        const data = await dbClient.send(command);
        logger.info(`PUT command to database complete ${JSON.stringify(data)}`);
        return user;
    } catch (error) {
        logger.log(error);
        throw new Error("DAO: failed to register user");
    }
}

async function getUserByUserId(userId) {
    const command = new GetCommand({
        TableName: TableName,
        Key: {userId}
    })

    try{
        const { Item } = await dbClient.send(command);
        logger.info(`Query command to database complete ${JSON.stringify({userId})}`);
        return Item;
    }catch(error){
        logger.error(error);
        return null;
    }
}

async function getUserByUsername(username) {
    const command = new QueryCommand({
        TableName,
        IndexName: "username-index",  
        KeyConditionExpression: "username = :username",
        ExpressionAttributeValues: {
            ":username": username
        }
    });

    try {
        const { Items } = await dbClient.send(command);
        if (Items.length == 0) {
            return null;
        }
        logger.info(`Query command to database complete ${JSON.stringify({user_id: Items[0].userId, username: Items[0].username})}`);
        return Items[0];  // Return first match
    } catch (err) {
        logger.error("Error querying by username:", err);
        throw new Error("DAO: Query command failed");
    }
}

async function getUserByEmail(email) {
    const command = new QueryCommand({
        TableName,
        IndexName: "email-index",  
        KeyConditionExpression: "email = :email",
        ExpressionAttributeValues: {
            ":email": email
        }
    });

    try {
        const { Items } = await dbClient.send(command);
        if (Items.length == 0) {
            return null;
        }
        logger.info(`Query command to database complete ${JSON.stringify({user_id: Items[0].user_id, username: Items[0].username, email: Items[0].email})}`);
        return Items[0];  // Return first match
    } catch (err) {
        logger.error("Error querying by email:", err);
        throw new Error("DAO: Query command failed");
    }
}

async function changePassword(userId, password) {
    const command = new UpdateCommand({
        TableName,
        Key: { userId },
        UpdateExpression: "SET password = :password",
        ExpressionAttributeValues: {
            ":password": password
        }
    })

    try {
        const data = await dbClient.send(command);
        if (data['$metadata'].httpStatusCode != 200) {
            throw new Error("DAO: failed to update user password")
        }
    } catch (error) {
        logger.log(error);
        throw new Error("DAO: failed to update user password");
    }
}

async function getFriendsListByUserId(userId) {
    const command = new GetCommand({
        TableName: TableName,
        Key: {userId}
    })

    let friendslist = [];
    try{
        const { Item } = await dbClient.send(command);
        logger.info(`Get command to database complete ${JSON.stringify({userId})}`);
        for(let i = 0; i < Item.friends.length; i++){
            let friend = await getUserByUserId(Item.friends[i].userId);
            if(!friend){
                Item.friends.splice(i,1);
                i--;
            }
            else{
                friendslist.push(friend);
            }
        }
        logger.info(`Get command to database complete ${JSON.stringify({"user whos list was \
            queried ": userId, "current friends of user queried": Item.friends})}`);
        await createUser(Item); // put the user back in the database with updated friends list
        return friendslist;
    }catch(error){
        logger.error(error);
        return null;
    }
}

async function addFriend(newFriendsList, userId) {
    const command = new UpdateCommand({
        TableName,
        Key: { userId },
        UpdateExpression: "SET friends = :friends",
        ExpressionAttributeValues: {
            ":friends": newFriendsList
        }
    })

    try {
        const data = await dbClient.send(command);
        if (data['$metadata'].httpStatusCode != 200) {
            throw new Error("DAO: failed to update user friends list")
        }
    } catch (error) {
        logger.log(error);
        throw new Error("DAO: failed to update user friends list");
    }
}


async function deleteUser(userId) {
    const command = new DeleteCommand({
        TableName,
        Key: { userId }
    })

    try {
        const data = await dbClient.send(command);
        if (data['$metadata'].httpStatusCode != 200) {
            throw new Error("DAO: failed to delete user")
        }
    } catch (error) {
        logger.log(error);
        throw new Error("DAO: failed to delete user");
    }
}

async function uploadFileToS3(file, fileName) {
    const params = {
        Bucket: BucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
    };

    try {
        await s3.send(new PutObjectCommand(params));
        return fileName; // Return file path
    } catch (error) {
        console.error("AWS S3 upload failed:", error);
        throw new Error("File upload failed");
    }
}

async function deleteS3File(filePath) {
    if (!filePath) return;
    try {
        await s3.send(new DeleteObjectCommand({
            Bucket: BucketName,
            Key: filePath,
        }));
    } catch (error) {
        console.error("Error deleting old profile image:", error);
    }
}

async function generateSignedUrl(fileName) {
    try {
        const getObjectCommand = new GetObjectCommand({
            Bucket: BucketName,
            Key: fileName,
        });

        return await getSignedUrl(s3, getObjectCommand, { expiresIn: 3600 });
    } catch (error) {
        console.error("Error generating signed URL:", error);
        throw new Error("Could not generate signed URL");
    }
}

async function updateProfile(userId, profile) {
    const command = new UpdateCommand({
        TableName,
        Key: { userId },
        UpdateExpression: "SET biography = :biography, preferredGenres = :preferredGenres, profilePicture = :profilePicture",
        ExpressionAttributeValues: {
            ":biography": profile.biography,
            ":preferredGenres": profile.preferredGenres,
            ":profilePicture": profile.profilePicture
        },
        ReturnValues: "ALL_NEW"
    });

    try {
        const data = await dbClient.send(command);
        return {
            userId,
            biography: data.Attributes.biography,
            preferredGenres: data.Attributes.preferredGenres,
            profilePicture: data.Attributes.profilePicture
        };
    } catch (error) {
        logger.log(error);
        throw error;
    }
}

async function banUser(userId, banStatus) {
    const command = new UpdateCommand({
        TableName,
        Key: { userId },
        UpdateExpression: "SET isBanned = :isBanned",
        ExpressionAttributeValues: {
            ":isBanned": banStatus
        }
    })
  
    try {
        const data = await dbClient.send(command);
        if (data['$metadata'].httpStatusCode != 200) {
            throw new Error("DAO: failed to update user ban status")
        }
    } catch (error) {
        logger.log(error);
        throw new Error("DAO: failed to update user ban status");
    }
  }

async function updateLikedLists(userId, newLikedLists) {
    const command = new UpdateCommand({
        TableName,
        Key: { userId },
        UpdateExpression: "SET likedLists = :likedLists",
        ExpressionAttributeValues: {
            ":likedLists": newLikedLists
        }
    })
  
    try {
        const data = await dbClient.send(command);
        if (data['$metadata'].httpStatusCode != 200) {
            throw new Error("DAO: failed to update user ban status")
        }
    } catch (error) {
        logger.log(error);
        throw new Error("DAO: failed to update user ban status");
    }
}

async function updateUser(userId, updates) {
    try {
        if (!updates || Object.keys(updates).length === 0) {
            throw new Error("No fields provided to update.");
        }

        let updateExpressions = [];
        let expressionAttributeValues = {};

        // Construct UpdateExpression dynamically
        for (const [key, value] of Object.entries(updates)) {
            updateExpressions.push(`${key} = :${key}`);
            expressionAttributeValues[`:${key}`] = value;
        }

        const command = new UpdateCommand({
            TableName,
            Key: { userId },
            UpdateExpression: `SET ${updateExpressions.join(", ")}`,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: "ALL_NEW"
        });

        const result = await dbClient.send(command);
        return result.Attributes;
    } catch (error) {
        logger.error("Error updating user:", error);
        throw new Error("Failed to update user.");
    }
}

async function getAllUsers() {
    try {

        const command = new ScanCommand({
            TableName
        });

        const response = await dbClient.send(command);
        
        return response.Items;
    } catch (error) {
        logger.error("Error getting all users:", error);
        throw new Error("Failed to get all users.");
    }
}

module.exports = {
    createUser, 
    getUserByUsername, 
    getUserByEmail, 
    getUserByUserId, 
    changePassword, 
    deleteUser, 
    addFriend, 
    getFriendsListByUserId,
    updateProfile, 
    generateSignedUrl,
    deleteS3File,
    uploadFileToS3,
    banUser,
    updateLikedLists,
    updateUser,
    getAllUsers
}
