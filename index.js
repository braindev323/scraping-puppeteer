const puppeteer = require('puppeteer');
const C = require('./constants');
const USERNAME_SELECTOR = '#user_email';
const PASSWORD_SELECTOR = '#user_password';
const CTA_SELECTOR = '#sign_in_user';
const swig = require('swig');

let baseUrl = 'https://en.surebet.com';

let sureBets = [];
let middles = [];
let valueBets = [];

let sureBetGroups = [];

let browser;
let page;
let surebetsTotalCounts = 100, middlesTotalCounts = 100, valuebetsTotalCounts = 100, surebetsTotalPages = 0, middlesTotalPages = 0, valuebetsTotalPages = 0;

async function startBrowser() {
    browser = await puppeteer.launch({
	product: 'firefox',
        headless: true,    // if false, will open firefox browser
        ignoreDefaultArgs: ["--enable-automation"],
        args: ["--no-sandbox",
		"--disable-setuid-sandbox"]
    });
    [page] = await browser.pages();
    if (!page) {
        page = await browser.newPage();
    }
    //   return {browser, page};
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function closeBrowser(browser) {
    return browser.close();
}

async function launchBrowser(url) {
    try {
        console.log(new Date().toLocaleString() + ':', 'starting server');
        await startBrowser();
        page.setViewport({ width: 1366, height: 768 });
        await page.setDefaultNavigationTimeout(60000);
        console.log(new Date().toLocaleString() + ':', 'connecting login page ...');
        await page.goto(url);
        console.log(new Date().toLocaleString() + ':', 'waiting for login form ...');
        await page.waitForSelector(USERNAME_SELECTOR, {visible: true});
        await page.click(USERNAME_SELECTOR);
        await page.keyboard.type(C.username);
        await page.click(PASSWORD_SELECTOR);
        await page.keyboard.type(C.password);
        await page.click(CTA_SELECTOR);
        console.log(new Date().toLocaleString() + ':', 'logging in ...');
        await page.waitForNavigation();

        await page.waitForSelector('main', {visible: true});
        sureBets[0] = await page.evaluate(() => document.querySelector('main').outerHTML);
        
        let matches = sureBets[0].match(/Found ([0-9,]+) surebets/gm);
    
        sureBets[0] = sureBets[0].replace(/`/g, '');
        if (matches.length) {
            let countString = matches[0];
            countString = countString.replace(',', '');
            surebetsTotalCounts = countString.match(/\d+/)[0];
        }
    
        await runProcessor();
    
        console.log(new Date().toLocaleString() + ':', 'close browser');
        await closeBrowser(browser);

        console.log(new Date().toLocaleString() + ':', 'sleeping 2 mins');
        await sleep(120000);
    
        launchBrowser("https://en.surebet.com/users/sign_in");
    } catch (e) {
        console.error(new Date().toLocaleString() + ':', 'launchBrowser', e);
        await page.screenshot({path: 'login_error.png'});
    }

    console.log(new Date().toLocaleString() + ':', 'end server permanently');
}

async function runProcessor () {
    const surebetsBaseUrl = 'https://en.surebet.com/surebets?page=';
    const middlesBaseUrl = 'https://en.surebet.com/middles?page=';
    const valuebetsBaseUrl = 'https://en.surebet.com/valuebets?page=';
    const MAX_PAGE_COUNT = 3;
    const MAX_ERROR_COUNT = 3;
    let errCount = 0;

    try {
        for(;;) {
            console.log(new Date().toLocaleString() + ':', '  start process');
            let tmpSurebetsTotalCounts = surebetsTotalCounts;
            let tmpSurebetsTotalPages = surebetsTotalPages;
            let tmpSureBets = [];
            for (let i = 0; i < MAX_PAGE_COUNT; i ++) {
                if (tmpSurebetsTotalCounts!=0 && tmpSurebetsTotalCounts <= i*50) break;

                let surebetsUrl = surebetsBaseUrl + (i+1);
                try {
                    await page.waitForTimeout((Math.random() * 3 + 3) * 1000);
                    console.log(new Date().toLocaleString() + ':', `      ${surebetsUrl}`);
                    await page.goto(surebetsUrl);
                
                    await page.waitForSelector('main', {visible: true});
                    let tmpBet = await page.evaluate(() => document.querySelector('main').outerHTML);
                    tmpBet = tmpBet.replace(/`/g, '');
        
                    let matches = tmpBet.match(/Found ([0-9,]+) surebets/gm);
                    if (matches && matches.length) {
                        let countString = matches[0].replace(',', '');
                        tmpSurebetsTotalCounts = countString.match(/\d+/)[0];
                    }

                    tmpSureBets[i] = tmpBet;
                    tmpSurebetsTotalPages = Math.ceil(tmpSurebetsTotalCounts / 50) > MAX_PAGE_COUNT ? MAX_PAGE_COUNT : Math.ceil(tmpSurebetsTotalCounts / 50);
                    console.log(new Date().toLocaleString() + ':', `      surebets[${i}] Total count: ${tmpSurebetsTotalCounts} - ${surebetsUrl}`);
                    errCount = 0;
                } catch (e) {
                    errCount += 1;
                    console.error(new Date().toLocaleString() + ':', `    [${errCount}] ${surebetsUrl} : `, e);
                    await page.screenshot({path: `error_${errCount}.png`});
                }
            }
            
            let tmpBetGroups = [];
            let tmpSureBets0 = tmpSureBets[0];
            let groupMatches = [...tmpSureBets0.matchAll(/\/surebets\/group\?like=([a-zA-Z0-9_.-]+)/gm)];
            console.log(new Date().toLocaleString() + ':', `      fetching group-surebets - ${groupMatches.length}`);
            if (groupMatches && groupMatches.length) {
                for (let k = 0; k < groupMatches.length; k ++) {
                    let groupBetUrl = groupMatches[k][0];
                    let groupBetId = groupMatches[k][1];
                    try {
                        await page.waitForTimeout((Math.random() * 3 + 3) * 1000);
                        console.log(new Date().toLocaleString() + ':', `      [${k}]${groupBetUrl}`);
                        await page.goto(baseUrl + groupBetUrl);
                        await page.waitForSelector('main', {visible: true});
                        let tmpGroup = await page.evaluate(() => document.querySelector('main').outerHTML);
                        tmpBetGroups[groupBetId] = tmpGroup.replace(/`/g, '');
                        tmpSureBets0 = tmpSureBets0.replace(groupBetUrl, groupBetUrl + "&item=" + k);
                    } catch (e) {
                        console.error(new Date().toLocaleString() + ':', `    ${groupBetUrl} : `, e);
                    }
                }
            }
            tmpSureBets[0] = tmpSureBets0;
            surebetsTotalCounts = tmpSurebetsTotalCounts;
            surebetsTotalPages = tmpSurebetsTotalPages;
            sureBetGroups = tmpBetGroups;
            sureBets = tmpSureBets;
            console.log(new Date().toLocaleString() + ':', `    fetched surebets successfuly. Total count: ${tmpSurebetsTotalCounts}, Pages:${tmpSurebetsTotalPages}, Groups:${Object.keys(tmpBetGroups).length}`);
        
            let tmpMiddlesTotalCounts = middlesTotalCounts;
            let tmpMiddlesTotalPages = middlesTotalPages;
            let tmpMiddles = [];
            for (let i = 0; i < MAX_PAGE_COUNT; i ++) {
                if (tmpMiddlesTotalCounts!=0 && tmpMiddlesTotalCounts <= i*50) break;

                let middlesUrl = middlesBaseUrl + (i+1);
                try {
                    await page.waitForTimeout((Math.random() * 3 + 3) * 1000);
                    console.log(new Date().toLocaleString() + ':', `      ${middlesUrl}`);
                    await page.goto(middlesUrl);
                    await page.waitForSelector('main', {visible: true});
                    let tmpBet = await page.evaluate(() => document.querySelector('main').outerHTML);                    
                    tmpBet = tmpBet.replace(/`/g, '');

                    let matches = tmpBet.match(/Found ([0-9,]+) middles/gm);
                    if (matches && matches.length) {
                        let countString = matches[0].replace(',', '');
                        tmpMiddlesTotalCounts = countString.match(/\d+/)[0];
                    }
                    tmpMiddles[i] = tmpBet;
                    tmpMiddlesTotalPages = Math.ceil(tmpMiddlesTotalCounts / 50) > MAX_PAGE_COUNT ? MAX_PAGE_COUNT : Math.ceil(tmpMiddlesTotalCounts / 50);
                    console.log(new Date().toLocaleString() + ':', `      middles[${i}] Total count: ${tmpMiddlesTotalCounts} - ${middlesUrl}`);
                    errCount = 0;
                } catch (e) {
                    errCount += 1;
                    console.error(new Date().toLocaleString() + ':', `    [${errCount}] ${middlesUrl} : `, e);
                    await page.screenshot({path: `error_${errCount}.png`});
                }
            }
            middlesTotalCounts = tmpMiddlesTotalCounts;
            middlesTotalPages = tmpMiddlesTotalPages;
            middles = tmpMiddles;
            console.log(new Date().toLocaleString() + ':', `    fetched middles successfuly. Total count: ${tmpMiddlesTotalCounts}, Pages:${tmpMiddlesTotalPages}`);
    
            let tmpValuebetsTotalCounts = valuebetsTotalCounts;
            let tmpValuebetsTotalPages = valuebetsTotalPages;
            let tmpValueBets = [];
            for (let i = 0; i < MAX_PAGE_COUNT; i ++) {
                if (tmpValuebetsTotalCounts!=0 && tmpValuebetsTotalCounts <= i*50) break;

                let valuebetsUrl = valuebetsBaseUrl + (i+1);
                try {
                    await page.waitForTimeout((Math.random() * 3 + 3) * 1000);
                    console.log(new Date().toLocaleString() + ':', `      ${valuebetsUrl}`);
                    await page.goto(valuebetsUrl);
                    await page.waitForSelector('main', {visible: true});
                    let tmpBet = await page.evaluate(() => document.querySelector('main').outerHTML);
                    tmpBet = tmpBet.replace(/`/g, '');

                    let matches = tmpBet.match(/Found ([0-9,]+) valuebets/gm);
                    if (matches && matches.length) {
                        let countString = matches[0];
                        countString = countString.replace(',', '');
                        tmpValuebetsTotalCounts = countString.match(/\d+/)[0];
                    }
        
                    tmpValueBets[i] = tmpBet;
                    tmpValuebetsTotalPages = Math.ceil(tmpValuebetsTotalCounts / 50) > MAX_PAGE_COUNT ? MAX_PAGE_COUNT : Math.ceil(tmpValuebetsTotalCounts / 50);
                    console.log(new Date().toLocaleString() + ':', `      valuebets[${i}] Total count: ${tmpValuebetsTotalCounts} - ${valuebetsUrl}`);
                    errCount = 0;
                } catch (e) {
                    errCount += 1;
                    console.error(new Date().toLocaleString() + ':', `    [${errCount}] ${valuebetsUrl} : `, e);
                    await page.screenshot({path: `error_${errCount}.png`});
                }
            }
            valuebetsTotalCounts = tmpValuebetsTotalCounts;
            valuebetsTotalPages = tmpValuebetsTotalPages;
            valueBets = tmpValueBets;
            console.log(new Date().toLocaleString() + ':', `    fetched valueBets successfuly. Total count: ${tmpValuebetsTotalCounts}, Pages:${tmpValuebetsTotalPages}`);
        
            if (errCount > MAX_ERROR_COUNT) {
                console.log(new Date().toLocaleString() + ':', `  end process with MAX_ERROR_COUNT(${MAX_ERROR_COUNT})`);
                break;
            }
            console.log(new Date().toLocaleString() + ':', '  end process');
            await sleep(3000);
        }
    } catch (e) {
        console.error(new Date().toLocaleString() + ':', '  runProcessor', e);
        await page.screenshot({path: 'error.png'});
    }
}

(async () => {
      await launchBrowser("https://en.surebet.com/users/sign_in");
    //   process.exit(1);
})();

const express = require('express')
const app = express()
const port = 3005
const path = require('path');
const { group } = require('console');

// view engine setup
app.engine('swig', swig.renderFile);
app.set('view engine', 'swig');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(__dirname + '/public'));

app.get('/', async (req, res) => {
    let page = req.query.page;

    if (!page) {
        page = 1;
    }
    
    if (surebetsTotalPages >= page) {
        res.render('index', { content: sureBets[page - 1] });
    } else {
        if (surebetsTotalPages > 0) {
            res.render('index', { content: sureBets[surebetsTotalPages - 1] });
        } else {
            res.render('index', { content: '<main>No Data</main>' });
        }
    }
});

app.get('/surebets/group', async (req, res) => {
    let id = req.query.like;

    if (!id) {
        id = "";
    }
    
    if (sureBetGroups[id]) {
        res.render('index', { content: sureBetGroups[id] });
    } else {
        res.render('index', { content: '<main>No Data</main>' });
    }
});

app.get('/middles', async (req, res) => {
    let page = req.query.page;

    if (!page) {
        page = 1;
    }
    
    if (middlesTotalPages >= page) {
        res.render('index', { content: middles[page - 1] });
    } else {
        if (middlesTotalPages > 0) {
            res.render('index', { content: middles[middlesTotalPages - 1] });
        } else {
            res.render('index', { content: '<main>No Data</main>' });
        }
    }
});

app.get('/valuebets', async (req, res) => {
    let page = req.query.page;

    if (!page) {
        page = 1;
    }
    
    if (valuebetsTotalPages >= page) {
        res.render('index', { content: valueBets[page - 1] });
    } else {
        if (valuebetsTotalPages > 0) {
            res.render('index', { content: valueBets[valuebetsTotalPages - 1] });
        } else {
            res.render('index', { content: '<main>No Data</main>' });
        }
    }
});

app.listen(port, () => {
    console.log(new Date().toLocaleString() + ':', `Example app listening at http://localhost:${port}`)
})