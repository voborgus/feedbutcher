const DynamoDBSession = require("telegraf-session-dynamodb")
const {chat} = require("googleapis/build/src/apis/chat");
const debug = require('debug')('bot:forms');

const endpoint = `https://docapi.serverless.yandexcloud.net/${process.env.region}/${process.env.cloud_id}/${process.env.db_id}`
const dynamoDBSession = new DynamoDBSession({
    dynamoDBConfig: {
        params: {
            TableName: process.env.dynamodb_table
        },
        region: process.env.region,
        endpoint: endpoint
    }
})


const docClient = dynamoDBSession._db._docClient;

const dbName = "-forms";

async function findAll() {
    const scanOutput = await docClient.scan({
        TableName: process.env.dynamodb_table + dbName
    }).promise()

    return Array.from(scanOutput.Items).map(item => item.SessionValue)
}

async function find(id) {
    return docClient.get({
        Key: {
            SessionKey: id.toString()
        },
        TableName: process.env.dynamodb_table + dbName
    }).promise().then((data) => {
        if (data.Item == null) return null
        return data.Item.SessionValue
    }).catch((err) => console.log(err))
}


async function save(entity) {
    await docClient.update({
        TableName: process.env.dynamodb_table + dbName,
        Key: {SessionKey: entity.id},
        UpdateExpression: "set SessionValue = :sv",
        ExpressionAttributeValues: {
            ":sv": entity
        },
        ReturnValues: "UPDATED_NEW"
    }).promise()
}

async function deleteForm(formId) {
    debug("Deleting the form", formId)
    await docClient.delete({
        TableName: process.env.dynamodb_table + dbName,
        Key: {
            "SessionKey": formId.toString()
        },
    }).promise()
}

async function deleteEverything() {
    const rows = await docClient.scan({
        TableName: process.env.dynamodb_table,
        AttributesToGet: ['SessionKey'],
    }).promise();

    console.log(`Deleting ${rows.Items.length} sessions`);
    for (const element of rows.Items) {
        await docClient.delete({
            TableName: process.env.dynamodb_table,
            Key: {
                "SessionKey": element.SessionKey
            },
        }).promise();
    }

    const users = await docClient.scan({
        TableName: process.env.dynamodb_table + "-forms",
        AttributesToGet: ['SessionKey'],
    }).promise();

    console.log(`Deleting ${users.Items.length} forms`);
    for (const element of users.Items) {
        await docClient.delete({
            TableName: process.env.dynamodb_table + "-forms",
            Key: {
                "SessionKey": element.SessionKey
            },
        }).promise();
    }
}

async function updateSessionFormUrl(chatId, formUrl) {
    await docClient.update({
        TableName: process.env.dynamodb_table,
        Key: {SessionKey: chatId + ":" + chatId},
        UpdateExpression: "set SessionValue.lastFormUrl = :mw",
        ExpressionAttributeValues: {
            ":mw": formUrl
        },
        ReturnValues: "UPDATED_NEW"
    }).promise()
}

module.exports = {
    findAll, find, save, dynamoDBSession, deleteForm, deleteEverything, updateSessionFormUrl
}