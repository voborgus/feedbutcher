const ngrok = require('ngrok');
const {Telegraf} = require("telegraf");
(async () => {
    const bot = new Telegraf(process.env.bot_token)
    const tunnel = await ngrok.connect(3000)
    const url = tunnel + "/prod/webhook"
    await bot.telegram.setWebhook(url);
    console.log("Telegram webhook successfully set up to " + url)
})()