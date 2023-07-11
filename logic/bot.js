const axios = require('axios');

const {Telegraf} = require('telegraf');
const debug = require('debug')('bot:bot');

const QRCode = require('qrcode');
const googleForms = require('../client/googleForms');
const db = require('../data/forms');

const Stage = require('telegraf/stage');
const Scene = require('telegraf/scenes/base');
const DynamoDBSession = require("telegraf-session-dynamodb");

const getName = new Scene('getName')
const getTitle = new Scene('getTitle')
const finish = new Scene('finish')

const stage = new Stage()
stage.register(getName)
stage.register(getTitle)
stage.register(finish)
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
const bot = new Telegraf(process.env.bot_token);
bot.use(dynamoDBSession.middleware())
bot.use(stage.middleware())

bot.command('whoami', (ctx) => ctx.reply(ctx.chat.id.toString()))

async function processAdminChat(ctx) {
    if (ctx.chat.id.toString() !== process.env.support_chat_id) {
        return false
    }
    if (ctx.message.text.includes("по братски") || ctx.message.text.includes("конь") || ctx.message.text.includes("товарищ")) {
        const allForms = await db.findAll()
        let allFormsCSV = "Name;Title;Form\n"
        allForms.forEach(form => allFormsCSV += form.description + ";"
            + form.documentTitle + ";"
            + form.responderUri
            + "\n")
        return ctx.telegram.sendDocument(process.env.support_chat_id, {
            source: Buffer.from(allFormsCSV, "utf-8"),
            filename: 'all-forms.csv'
        })
    }
    if (ctx.message.text.includes("многоуважаемый") || ctx.message.text.includes("любезность") || ctx.message.text.includes("солнышко")) {
        const allForms = await db.findAll()
        let allFormsCSV = "Name;Title;Rate;Comment\n"
        allForms.forEach(form => {
            if (form.responses) {
                form.responses.forEach(response => {
                    const stars = response.answers[form.questionStarsId].textAnswers.answers[0].value
                    const comment = response.answers[form.questionCommentId] ?
                        response.answers[form.questionCommentId].textAnswers.answers[0].value : ""
                    allFormsCSV += form.description + ";"
                        + form.documentTitle + ";"
                        + stars + ";" + comment
                        + "\n"
                })
            }

        })
        return ctx.telegram.sendDocument(process.env.support_chat_id, {
            source: Buffer.from(allFormsCSV, "utf-8"),
            filename: 'all-forms.csv'
        })
    }

    if (ctx.message.text.includes("r2d2bipbip")) {
        await db.deleteEverything()
        return ctx.reply("Успех")
    }

    console.log("Chatting in the support chat. Skip")
    return true
}

async function startLogic(ctx) {
    if (await processAdminChat(ctx)) return
    await ctx.scene.enter('getName')
    return ctx.reply('Привет! Я помогу тебе создать QR для обратной связи. Пожалуйста, введи свои фамилию и имя')
}

bot.start(async (ctx) => {
    return startLogic(ctx);
});

async function createForm(ctx, documentTitle, description) {
    const form = await googleForms.create(documentTitle, description)
    const shortUrl = await shorten(form.responderUri)
    debug("Short url for " + ctx.chat.id + " is " + shortUrl)

    ctx.session.lastFormUrl = shortUrl
    ctx.session.lastLongFormUrl = form.responderUri
    ctx.session.lastFormId = form.formId
    ctx.session.lastdocumentTitle = documentTitle
    ctx.session.lastdocumentDescription = description
    ctx.session.description = description

    await db.save({
        id: form.formId,
        chatId: ctx.chat.id,
        responderUri: form.responderUri,
        shortUrl: shortUrl,
        documentTitle: documentTitle,
        description: description,
        date: new Date().toISOString(),
        questionStarsId: process.env.stars_answer_id,
        questionCommentId: process.env.comments_answer_id
    })

    return shortUrl;
}

async function createQR(url) {
    return QRCode.toBuffer(url, {
        scale: 20,
        margin: 2
    });
}

getName.on('text', async (ctx) => {
    if (await processAdminChat(ctx)) return

    const safeSymbols = /^[\wА-Яа-я0-9 ,ёЁ-]*$/
    if (!safeSymbols.test(ctx.message.text)) {
        return ctx.reply("Пожалуйста, убери специальные символы из названия")
    }

    ctx.session.lastdocumentDescription = ctx.message.text
    await ctx.scene.enter('getTitle')

    return ctx.reply("Спасибо! А теперь название доклада")
})

getTitle.on('text', async (ctx) => {
    if (await processAdminChat(ctx)) return

    const safeSymbols = /^[\wА-Яа-я0-9 ,ёЁ-]*$/
    if (!safeSymbols.test(ctx.message.text)) {
        return ctx.reply("Пожалуйста, убери специальные символы из названия")
    }

    try {
        const url = await createForm(ctx, ctx.message.text, ctx.session.lastdocumentDescription);
        await ctx.telegram.sendMessage(process.env.support_chat_id,
            "Новая форма: " + ctx.message.text + " — *" + ctx.session.lastdocumentDescription + "*",
            {parse_mode: 'Markdown'})

        const QR = await createQR(url);

        await ctx.replyWithPhoto({source: QR})
        await ctx.scene.enter('finish')
        return ctx.reply("Держи QR код на форму обратной связи. Добавь его на последний слайд. " +
            "Я напишу, как появится обратная связь. Удачного выступления ❤️")
    } catch (err) {
        console.error(err)
        return ctx.reply("Ошибка. Попробуй снова")
    }
})

finish.on('text', async (ctx) => {
    if (await processAdminChat(ctx)) return

    if (ctx.message.text === "zeliboba") {
        await createForm(ctx, ctx.session.lastdocumentTitle, ctx.session.lastdocumentDescription)
    }
    if (ctx.message.text === "feofanfull") {
        await db.deleteForm(ctx.session.lastFormId)
        ctx.session = null
        return ctx.reply('Сессию сбросил, про форму забыл, готов начать с чистого листа')
    }
    if (ctx.message.text === "feofan") {
        ctx.session = null
        return ctx.reply('Сессию сбросил, готов начать с чистого листа')
    }

    try {
        const QR = await createQR(ctx.session.lastFormUrl)

        await ctx.replyWithPhoto({source: QR})
        return ctx.reply("Держи QR код на форму обратной связи. Добавь его на последний слайд. " +
            "Я напишу тебе, как появится обратная связь")
    } catch (err) {
        console.error(err)
        return ctx.reply("Ошибка. Попробуй снова")
    }
})

bot.on('text', async (ctx) => {
    if (await processAdminChat(ctx)) return


    return startLogic(ctx)
})

async function shorten(url) {
    const config = {
        headers: {
            "Authorization": process.env.API_KEY_SHORTENER
        }
    }
    const query = {
        originalURL: url,
        domain: '9mm7.short.gy'
    }
    const bodyResponse = await axios.post("https://api.short.io/links", query, config)
    debug("Response from chichikov backend", bodyResponse.data)

    return bodyResponse.data.shortURL
}

module.exports = {
    bot, dynamoDBSession
}


