const {dbClient, s3} = require("../util/config");
const logger = require("../util/logger");
const {PutCommand, QueryCommand, GetCommand, UpdateCommand, DeleteCommand} = require("@aws-sdk/lib-dynamodb");

const TableName = 'my-movie-list-watchlists';


async function createWatchlist(list) {
    const command = new PutCommand({
        TableName,
        Item: list
    })

    try {
        const data = await dbClient.send(command);
        logger.info(`Post command to database complete ${JSON.stringify(data)}`);
        return list;
    } catch (error) {
        logger.log(error);
        throw new Error("DAO: failed to create list");
    }
}


async function getWatchlistByUserIdAndListName(userId, listName) {
    const command = new QueryCommand({
        TableName,
        IndexName: "userId-listName-index",  
        KeyConditionExpression: "userId = :userId and listName = :listName",
        ExpressionAttributeValues: {
            ":userId": userId,
            ":listName": listName

        }
    });

    try {
        const {Items} = await dbClient.send(command);
        if (Items.length == 0) {
            return null;
        }
        logger.info(`Query command to database complete ${JSON.stringify({userId: userId, listName: listName})}`);
        return Items;  // Return first match
    } catch (err) {
        logger.error("Error querying by userId/listName:", err);
        throw new Error("DAO: Query command failed for watchlist");
    }
}

//returns list of watchlists based on userId index
async function getWatchlistsByUserId(userId) {
    const command = new QueryCommand({
        TableName,
        IndexName: "userId-index",  
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
            ":userId": userId

        }
    });

    try {
        const {Items} = await dbClient.send(command);
        console.log(Items);
        if (Items.length == 0) {
            return null;
        }
        logger.info(`Query command to database complete ${JSON.stringify({userId: userId})}`);
        return Items;  // Return list
    } catch (err) {
        logger.error("Error querying by userId:", err);
        throw new Error("DAO: Query command failed for watchlist");
    }
}


async function getWatchlistByListId(listId) {
    try {
        const command = new GetCommand({
            TableName,
            Key: { listId }
        });

        const result = await dbClient.send(command);
        logger.info(`Query command to database complete. ListId: ${listId}`);
        return result.Item || null;
    } catch (error) {
        logger.error("Error fetching watchList:", error);
        throw new Error("Failed to fetch watchList.");
    }
}

async function updateWatchlist(listId, updates) {
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
            Key: { listId },
            UpdateExpression: `SET ${updateExpressions.join(", ")}`,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: "ALL_NEW"
        });

        const result = await dbClient.send(command);
        return result.Attributes;
    } catch (error) {
        logger.error("Error updating watchList:", error);
        throw new Error("Failed to update watchList.");
    }
}

module.exports = {createWatchlist, getWatchlistByUserIdAndListName, getWatchlistByListId, updateWatchlist, getWatchlistsByUserId}