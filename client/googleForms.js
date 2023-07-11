const {google} = require('googleapis')
const googleForms = require('@googleapis/forms')
const debug = require('debug')('bot:googleForms');

const jwtClient = new google.auth.JWT(
    process.env.google_client_email,
    "google.pem",
    process.env.google_private_key,
    ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/forms.body'],
    process.env.google_client_email
)

const jwt2 = jwtClient.createScoped('https://www.googleapis.com/auth/drive')
jwt2.projectId = "feedbutcherbot"

const drive = google.drive({version: 'v3', auth: jwt2})
const forms = googleForms.forms({
    version: 'v1',
    auth: jwt2,
})

async function create(title, description) {
    const copyRequest = {  // Modified
        name: title,
        parents: [process.env.folder_where_to_store]
    }

    const copiedForm = await drive.files.copy(
        {
            fileId: process.env.form_to_copy,
            requestBody: copyRequest
        }
    )

    const res = await forms.forms.get({formId: copiedForm.data.id}, {})
    debug(res.data)

    const update = {
        requests: [
            {
                updateFormInfo: {
                    info: {
                        description: title + " – " + description
                    },
                    updateMask: 'description',
                },
            },
        ],
    };
    await forms.forms.batchUpdate({
        formId: copiedForm.data.id,
        requestBody: update,
    });
    return res.data;

    /*
    This is not working since https://issuetracker.google.com/issues/242295786 will poll answers with cron :(
    const watch = await forms.forms.watches.create({
        formId: copiedForm.data.id,
        requestBody: {
            "watch": {
                "target": {
                    "topic": {
                        "topicName": "projects/feedbutcherbot/topics/formsResponses"
                    }
                },
                "eventType": "RESPONSES"
            }
        },
    });
    console.log(watch.data);
     */
}

async function getResponses(formId) {
    const res = await forms.forms.responses.list({
        formId: formId,
    })
    return res.data.responses
}

module.exports = {create, getResponses}


