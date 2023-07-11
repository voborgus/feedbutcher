const {successResponse, getErrorResponse} = require('../utils/responseHelper')
const answers = require('../logic/answers');

module.exports.eventHandler = async event => {
    try {
        console.log("Starting new answers check process")
        await answers.check()
        return successResponse;
    } catch (err) {
        console.log("Error: ", err);
        return getErrorResponse(err);
    }
};