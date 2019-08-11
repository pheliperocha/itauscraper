const nconf = require('nconf')
const itauscraper = require('./itauscraper.js')
require('dotenv').config()

exports.handler = async (event, context) => {
    const { NODE_ENV, BRANCH, ACCOUNT, PASS, DAYS } = process.env

    nconf.file(NODE_ENV, './config/' + NODE_ENV.toLowerCase() + '.json')
    nconf.file('default', './config/default.json')
    nconf.merge({
        branch: BRANCH,
        account: ACCOUNT,
        password: PASS,
        days: DAYS
    })

    const options = nconf.get()
    const result = await itauscraper(options)
    context.succeed(result)
}
