const forms = require("../client/googleForms");
const data = require("../data/forms")
const moment = require("moment");
const debug = require('debug')('bot:answers');
const {bot} = require("./bot");

async function check() {
    const allForms = await data.findAll()

    for (const form of allForms) {
        if (moment(form.date).isBefore(moment().subtract(2, 'months'))) {
            continue; // too old form
        }


        const responses = await forms.getResponses(form.id)
        if (!responses || form.responses === responses) {
            continue; // no new responses, checking next
        }
        responses.filter(response => !form.responses ||
            !(form.responses.map(response => response.responseId).includes(response.responseId)))
            .forEach(newResponse => {
                debug("New response received for form: " + form.documentTitle, newResponse)
                const stars = newResponse.answers[form.questionStarsId].textAnswers.answers[0].value
                const comment = newResponse.answers[form.questionCommentId] ?
                    newResponse.answers[form.questionCommentId].textAnswers.answers[0].value : ""
                let speakerResponse = "*Оценка по пятибальной:* " + stars
                if (comment) {
                    speakerResponse += "\n*Комментарий:* " + comment
                }
                const supportResponse = "*" + form.description + "*\n" + form.documentTitle + "\n" + speakerResponse
                bot.telegram.sendMessage(form.chatId, speakerResponse, {parse_mode: 'Markdown'})
                bot.telegram.sendMessage(process.env.support_chat_id, supportResponse, {parse_mode: 'Markdown'})
            })

        form.responses = responses
        await data.save(form)
    }


}

module.exports = {check}
