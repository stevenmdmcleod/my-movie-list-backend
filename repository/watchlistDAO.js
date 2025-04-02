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


async function getListByUserIdAndListName(userId, listName) {
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


module.exports = {createWatchlist, getListByUserIdAndListName}