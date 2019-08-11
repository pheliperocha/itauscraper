const puppeteer = require('puppeteer')
const path = require('path')
const fs = require('fs')
const moment = require('moment')

const TEMP_FOLDER = path.resolve(__dirname, 'temp')

const stepLogin = async (page, options) => {
    // Open homepage and fill account info
    console.log('Opening bank homepage...')
    console.debug('Itaú url:', options.itau.url)
    await page.goto(options.itau.url)
    console.log('Homepage loaded.')
    await page.type('#agencia', options.branch)
    await page.type('#conta', options.account)
    console.log('Account and branch number has been filled.')
    await page.waitFor(500)
    await page.click('#btnLoginSubmit')
    console.log('Opening password page...')

    // Input password
    await page.waitFor('div.modulo-login')
    console.log('Password page loaded.')
    let passwordKeys = await mapPasswordKeys(page)
    let keyClickOption = { delay: 300 }
    await page.waitFor(500)
    console.log('Filling account password...')
    for (const digit of options.password.toString()) {
        await passwordKeys[digit].click(keyClickOption)
    }
    console.log('Password has been filled...login...')
    await page.waitFor(500)
    page.click('#acessar', keyClickOption)
    await page.waitFor('#sectionHomePessoaFisica')
    console.log('Logged!')
}

const stepExportStatement = async (page, options) => {
    await page.waitFor(5000)
    await page.waitFor('div.botoes.clear.clearfix.no-margem-baixo')

    // Get balance
    console.log('Getting your balance...')
    const balanceElement = await page.$("#saldo")
    const balanceValue = await page.evaluate(balanceElement => balanceElement.textContent, balanceElement)
    console.log(`Your balance is ${balanceValue.toString().replace(/\s+/g, ' ').trim()}`)
    balanceElement.dispose()

    // Go to statement page
    console.log('Opening statement page...')
    await page.click('div.botoes.clear.clearfix.no-margem-baixo')
    await page.waitFor(5000)
    console.log('Statement page loaded.')

    console.log(`Selection last ${options.days} days`)
    await page.select('#select-5', options.days.toString())
    await page.waitFor(1000)

    // Set download folder
    await page._client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: TEMP_FOLDER,
    })

    console.log('Running downloading function')
    await page.evaluate(() => exportarExtratoArquivo('formExportarExtrato', 'txt'))
    await page.waitFor(8000)
    console.log('Finish download')
}

const stepClosePossiblePopup = async (page) => {
    await page.waitForSelector('div.mfp-wrap', { timeout: 4000 })
        .then(() => page.evaluate(() => popFechar()))
        .catch(() => { })
}

const mapPasswordKeys = async (page) => {
    let keys = await page.$$('.teclas .tecla')
    let keyMapped = {}

    for (const key of keys) {
        let text = await page.evaluate(element => element.textContent, key)
        if (text.includes('ou')) {
            let digits = text.split('ou').map(digit => digit.trim())
            keyMapped[digits[0]] = key
            keyMapped[digits[1]] = key
        }
    }

    return keyMapped
}

const readFile = () => {
    const files = fs.readdirSync(TEMP_FOLDER)
    const text = fs.readFileSync(path.resolve(TEMP_FOLDER, files[0]), { encoding: 'utf-8' })
    const obj = csvToJson(text)
    return mapDatas(obj)
}

const mapDatas = (data) => {
    return data.map(item => {
        return {
            date: moment(item.date, 'DD/MM/YYYY').format('YYYY-MM-DD'),
            description: item.description,
            value: (item.value) ? +item.value.replace(',', '.') : item.value
        }    
    })
}

const csvToJson = (csv) => {
    var lines = csv.split("\n")
    var result = []
    var headers = ['date', 'description', 'value']
    for (var i = 0; i < lines.length; i++) {
        var obj = {}
        var currentline = lines[i].split(";")

        for (var j = 0; j < headers.length; j++) {
            obj[headers[j]] = currentline[j]
        }
        result.push(obj)
    }
    return result
}

const sendToFinancialDataProcessor = (data) => {
    console.log('================')
    console.log(data)
    console.log('================')
}

const scraper = async (options) => {
    console.log('Starting Itaú scraper...')
    console.log('Account Branch Number:', options.branch)
    console.log('Account number:', options.branch)
    console.log('Transaction log days:', options.days)

    console.debug('Puppeter - options', options.puppeteer)
    const browser = await puppeteer.launch(options.puppeteer)

    const page = await browser.newPage()
    console.debug('Viewport - options', options.viewport)
    page.setViewport(options.viewport)

    await stepLogin(page, options)
    await stepClosePossiblePopup(page)
    await stepExportStatement(page, options)
    const data = readFile()
    await sendToFinancialDataProcessor(data)

    await browser.close()

    console.log('Itaú scraper finished.')
}

module.exports = scraper
