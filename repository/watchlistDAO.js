const {dbClient, s3} = require("../util/config");
const logger = require("../util/logger");
const {PostCommand, PutCommand, QueryCommand, GetCommand, UpdateCommand, DeleteCommand} = require("@aws-sdk/lib-dynamodb");

const TableName = 'my-movie-list-watchlists';


async function createWatchlist(list) {
    const command = new PostCommand({
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


module.exports = {createWatchlist}