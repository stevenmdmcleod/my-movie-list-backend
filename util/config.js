const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, UpdateCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({region: "us-east-2"});

const dbClient = DynamoDBDocumentClient.from(client);

const { S3Client } = require("@aws-sdk/client-s3");
 
const s3 = new S3Client({region: "us-east-2"});
 

module.exports = {dbClient, s3}