const puppeteer = require('puppeteer');
const fs = require('fs');
const axios = require('axios')
const C = require('./constants');
const swig = require('swig');
const { google } = require('googleapis');

const WIDGET_SELECTOR = ".widget-container";
const DOWN_BUTTON_SELECTOR = '#main-content article .post-inner > .entry > p > a';
const CTA_SELECTOR = '#sign_in_user';

let baseUrl = 'https://www.alisaler.com/';

let categories = [];
let failedList = [];
let error_count = 0;

let browser;
let page;

const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.metadata',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    'https://www.googleapis.com/auth/drive.photos.readonly',
    'https://www.googleapis.com/auth/drive.readonly'];
const KEY_PATH = './drive_secu_key.json';

async function startBrowser() {
    browser = await puppeteer.launch({
        headless: true,    // if false, will open browser
        // ignoreDefaultArgs: ["--enable-automation"],
        // args: ["--no-sandbox",
        // "--disable-setuid-sandbox"]
        args: ['--no-sandbox']
    });
    [page] = await browser.pages();
    if (!page) {
        page = await browser.newPage();
    }
    // return {browser, page};
}

async function closeBrowser(browser) {
    return browser.close();
}

async function playTest(url) {
    try {
        await startBrowser();
        page.setViewport({ width: 1366, height: 768 });
        await page.setRequestInterception(true);
        page.on('request', request => {
            if (request.isNavigationRequest() && request.redirectChain().length) {
                // console.log("continue navigation request", request.url());
                request.continue();
            } else if (request.url().startsWith("https://www.alisaler.com")){
                //console.log("continue request", request.url());
                request.continue();
            } else if (request.url().search("mediafire.com") !== -1){
                //console.log("continue request", request.url());
                request.continue();
            } else {
                // console.log("abort external request", request.url());
                request.abort();
            }
        });
        
        console.log(new Date().toLocaleString() + ': ', "==== start step 1 =====");
        await page.goto(url);
        await page.waitForSelector(WIDGET_SELECTOR, {
          visible: true,
          timeout: 10000
        });
        categories = await page.evaluate(() => {
            
            const rowNodeList = document.querySelectorAll('#categories-2 .widget-container>ul>li');
            const rowArray = Array.from(rowNodeList);
            
            const parseCategoryItem = (li) => {
                if (li) {
                    const titleValue = li.querySelector('a').textContent;
                    const linkValue = li.querySelector('a').href;
                    const childrenNodeList = li.querySelectorAll(':scope > .children > li');
                    const childArray = Array.from(childrenNodeList);
                    var children;
                    if (childArray.length > 0) {
                        children = childArray.map(parseCategoryItem);
                    }
                    //const [ titleValue, linkValue ] = childArray.map(td => td.textContent);
                    return {
                        titleValue,
                        linkValue,
                        children
                    };
                }
            };

            return rowArray.slice(0).map(parseCategoryItem);
        });

        // make category directory name
        await makeCategoryDir("./content/", categories);
        console.log(new Date().toLocaleString() + "=== Categories === ", categories);
        
        for(let i=0; i<categories.length; i++) {
            await progressCategoryDir(categories[i]);
        }
        console.log(new Date().toLocaleString() + "=== RESULT === ", categories);

        // save data1 to a file
        const data1 = JSON.stringify(categories, null, 4);  // for pretty print, org : JSON.stringify(categories);
        fs.writeFile('data1.json', data1);
        console.log("JSON data1 is saved.");

        // // read data1
        // const fdata = fs.readFileSync('data1.json', 'utf-8');
        // categories = JSON.parse(fdata.toString());
        // console.log("JSON data1 categories = ", categories);

        // // read data2
        // const fdata = fs.readFileSync('data2.json', 'utf-8');
        // categories = JSON.parse(fdata.toString());
        // console.log("JSON data2 categories = ", categories);

        console.log(new Date().toLocaleString() + ': ', "==== start step 2 =====");
        for(let i=0; i<categories.length; i++) {
            await progressItem(categories[i]);
        }

        console.log(new Date().toLocaleString() + ': ', "==== start step 3 =====");
        for(let i=0; i<categories.length; i++) {
            await downloadFile(categories[i]);
        }

    } catch (e) {
        console.error(new Date().toLocaleString() + ': ', e);
        await page.screenshot({path: 'home_error.png'});
    }
    
    const data2 = JSON.stringify(categories, null, 4);  // for pretty print, org : JSON.stringify(categories);
    fs.writeFileSync('data2.json', data2);
    console.log("JSON data2 is saved.");

    const dataErr = JSON.stringify(failedList, null, 4);
    fs.writeFileSync('failure.json', dataErr);
    console.log("JSON failure is saved.");

    console.log(new Date().toLocaleString() + ': ', 'end');
    await browser.close();
}

async function progressItem (category) {    
    if (category.children) {
        if (category.children.length > 0) {
            for (let i=0; i<category.children.length; i++) {
                await progressItem(category.children[i]);
            }
            return;
        }
    }

    if (category.itemData === undefined) return;
    if (category.itemData.length <= 0) return;
    
    for (let i=0; i<category.itemData.length; i++) {
        let itemData = category.itemData[i];
        if (itemData.furl != null && itemData.furl !== "") continue;

        console.log(new Date().toLocaleString() + ': ', `connecting "${itemData.link}" ...`);
        try {
            await page.goto(itemData.link);
            await page.waitForSelector('#main-content article .post-inner > .entry > p a', {
                visible: true,
                timeout: 5000
            });
        } catch (e) {
            console.error(new Date().toLocaleString() + ': failed file link selection - ', e);
        }
        
        var i_Data = await page.evaluate(() => {
            let furl = "";
            let title = "";
            let desc = "";
            try {title = document.querySelector('#main-content article .post-inner .post-title > span').textContent;}
            catch (e){}
            try {desc = document.querySelector('#main-content article .post-inner .entry > p').textContent;}
            catch (e){}
            try {furl = document.querySelector('#main-content article .post-inner > .entry > p a').href;}
            catch (e){}
    
            return {
                title,
                desc,
                furl
            };
        });

        let padding = 1;
        if (category.itemData.length > 99 ) {
            padding = 3;
        } else if (category.itemData.length > 9 ) {
            padding = 2;
        }
        itemData["index"] = String(i).padStart(padding, '0');
        itemData["title"] = i_Data.title;
        itemData["desc"] = i_Data.desc;
        itemData["furl"] = i_Data.furl;
        if (i_Data.title == "" || i_Data.furl == "") {
            console.error(new Date().toLocaleString() + ': failed capture data');
            failedList.push(itemData);
            error_count += 1;
            await page.screenshot({path: 'error_'+error_count+'.png'});
        }
    }
}

const auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: SCOPES
});

function downloadFileRequest (element) {
    try{
      return axios({
        url: element,
        method: "GET",
        responseType: "stream"
      });
    } catch(e) {
      console.log( 'errore: ' + e)
    }
}

async function downloadFile (category) {    
    if (category.children) {
        if (category.children.length > 0) {
            for (let i=0; i<category.children.length; i++) {
                await downloadFile(category.children[i]);
            }
            return;
        }
    }

    if (category.itemData === undefined) return;
    if (category.itemData.length <= 0) return;
    
    for (let i=0; i<category.itemData.length; i++) {
        let itemData = category.itemData[i];
        if (itemData.furl == null) {
            itemData.fileName = "-";
            continue;
        }
        if (itemData.furl === "") {
            itemData.fileName = "-";
            continue;
        }
        if (itemData.furl.startsWith("https://drive.google.com/drive/folders")) {
            itemData.fileName = "-";
            continue;
        }
        
        if (itemData.fileName != null && itemData.fileName != "" && itemData.fileName !== "-") continue;
        
        let __dirname = category.dir;
        if (!fs.existsSync(__dirname)){
            fs.mkdirSync(__dirname, {recursive:true});
        }
        if (itemData.furl.startsWith("https://drive.google.com/")) {
            // ex. https://drive.google.com/open?id=
            // ex. https://drive.google.com/uc?export=download&id=
            var regResult = RegExp(/id=(.*)$/).exec(itemData.furl);
            if (regResult == null) {
                // ex. https://drive.google.com/file/d/
                regResult = RegExp(/file\/d\/([^\n\/]*)/).exec(itemData.furl);
            }
            if (regResult == null) {
                console.error(new Date().toLocaleString() + ': drive id error - ', itemData.furl);
                continue;
            }
            let id = regResult[1];
            console.log(new Date().toLocaleString() + ': ', `id=${id} ... accessing`);
            try {
                const drive = google.drive({version: 'v3', auth});
                const infoRes = await drive.files.get({ fileId: id });
                // console.log("Drive file info - ", infoRes);
                const fileName = itemData.index + "-"+ infoRes.data.name;
                var dest = fs.createWriteStream(category.dir + fileName); // Modified
                const fileRes = await drive.files.get(
                    { fileId: id, alt: "media" },
                    { responseType: "stream" }
                );
                // console.log("Drive file result - ", fileRes);
                const streamy = fileRes.data;
                await streamy.pipe(dest);
                itemData.fileName = fileName;
                console.log(new Date().toLocaleString() + ': ', `id=${id} ... done`);
            } catch (e) {
                itemData.fileName = "-";
                console.error(new Date().toLocaleString() + ': failed download - ', e);
            }
        } else if (itemData.furl.startsWith("http://www.mediafire.com/file/") || itemData.furl.startsWith("https://www.mediafire.com/file/")) {
            try {
                await page.goto(itemData.furl);
                await page.waitForSelector('#download_link #downloadButton', {
                    visible: true,
                    timeout: 10000
                });
            } catch (e) {
                console.error(new Date().toLocaleString() + ': failed mediafire download button selection - ', e);
            }
            
            var i_Data = await page.evaluate(() => {
                let downLink = "";
                try {downLink = document.querySelector('#download_link #downloadButton').href;}
                catch (e){}
        
                return {
                    downLink
                };
            });

            let padding = 1;
            if (category.itemData.length > 99 ) {
                padding = 3;
            } else if (category.itemData.length > 9 ) {
                padding = 2;
            }
            itemData["index"] = String(i).padStart(padding, '0');
            itemData["downLink"] = i_Data.downLink; // http://download1324.mediafire.com/bvt8lbxazaeg/8xif1uqcnipi04v/APC+SMART-UPS+SU2200+3000.pdf
            console.log(new Date().toLocaleString() + ': download link - ', i_Data.downLink);
            
            if (i_Data.downLink != null && i_Data.downLink !== "") {
                try {
                    let fileName = RegExp(/\/([^\n\/]+)$/).exec(itemData.downLink)[1];
                    fileName = decodeURIComponent(fileName);
                    fileName = fileName.replace(/\+/g, " ");
                    const destFileName = itemData.index + "-"+ fileName;
                    const saveFile = await downloadFileRequest(itemData.downLink);
                    var dest = fs.createWriteStream(category.dir + destFileName); // Modified
                    dest.on('finish', () => dest.close());
                    dest.on('error', (err) => fs.unlink(dest)); // Delete the file async. (But we don't check the result) 
                    saveFile.data.pipe(dest);
                    itemData.fileName = destFileName;
                    console.log(new Date().toLocaleString() + ': ', `file name=${destFileName} ... done`);
                } catch (e) {
                    itemData.fileName = "-";
                    console.error(new Date().toLocaleString() + ': failed download - ', e);
                }
            }
        }
    }
}

async function makeCategoryDir(curDir, categories) {
    if (categories.length > 0) {
        for (let i=0; i<categories.length; i++) {
            let childDir = curDir + String(i).padStart(2, '0') + "-" + categories[i].titleValue + "/";
            categories[i]["dir"] = childDir;
            
            if (categories[i].children) {
                if (categories[i].children.length > 0) {
                    await makeCategoryDir(childDir, categories[i].children);
                }
            }
        }
    }
}

async function progressCategoryDir (category) {
    // console.log(new Date().toLocaleString() + ': ', 'start process - ', category.linkValue);
    
    if (category.children) {
        if (category.children.length > 0) {
            for (let i=0; i<category.children.length; i++) {
                await progressCategoryDir(category.children[i]);
            }
            return;
        }
        console.log(`============ Category - "${category.titleValue}" children length is 0`, category);
    }
    
    console.log(new Date().toLocaleString() + ': ', `connecting "${category.titleValue}" ...`);
    await page.goto(category.linkValue);
    await page.waitForSelector(".post-listing.archive-box", {
      visible: true,
      timeout: 10000
    });
    var strPages = await page.evaluate(() => {
        var pagination = document.querySelector('.pagination > .pages');
        if (pagination) {
            return pagination.textContent;
        }
        return "";
    });

    let pageCount = 1;
    
    let matches = strPages.match(/Page (\d+) of (\d+)/i);
    if (matches) {
        if (matches.length > 0) {
            pageCount = Number(matches[2]);
        }
    }
    
    console.log(new Date().toLocaleString() + ': ', "page count = ", pageCount);

    // read more links for every category
    let categoryItemData = [];
    for (let i=0; i<pageCount; i++) {
        let url = "";
        if (i==0) url = category.linkValue;
        else url = category.linkValue + `page/${i+1}/`;
        
        console.log(new Date().toLocaleString() + ': ', `category page - "${url}"`);
        await page.goto(url);
        await page.waitForSelector(".post-listing.archive-box", {
          visible: true,
          timeout: 10000
        });
        
        var listContent = await page.evaluate(() => {
        
            const rowNodeList = document.querySelectorAll(".post-listing.archive-box > article > .entry > a.more-link");
            const rowArray = Array.from(rowNodeList);

            return rowArray.slice(0).map((a) => {                
                let link = a.href;
                return {link};
            });
        });
        categoryItemData.push(...listContent);
    }
    category['itemData'] = categoryItemData;
}

(async () => {
      await playTest(baseUrl);
    //   process.exit(1);
})();

const express = require('express')
const app = express()
const port = 3005
const path = require('path');
const { group } = require('console');
const e = require('express');

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

app.listen(port, () => {
    console.log(new Date().toLocaleString() + ': ', `Example app listening at http://localhost:${port}`)
})