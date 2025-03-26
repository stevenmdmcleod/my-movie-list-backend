const {dbClient, s3} = require("../util/config");
const {PutCommand, QueryCommand, GetCommand, UpdateCommand} = require("@aws-sdk/lib-dynamodb");
const logger = require("../util/logger");

const TableName = 'my-movie-list-users';

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
        logger.info(`Query command to database complete ${JSON.stringify({user_id: Items[0].user_id, username: Items[0].username})}`);
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

module.exports = {createUser, getUserByUsername, getUserByEmail, getUserByUserId, changePassword}
