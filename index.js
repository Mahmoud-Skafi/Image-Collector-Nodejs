const fs = require('fs');
const https = require('https');
const puppeteer = require('puppeteer');
const scrollPageToBottom = require('./scroll');
const axios = require('axios');
const monk = require('monk');

const db = monk(process.env.MONGO_URL || 'localhost: 27017/imageDB');

db.then(() => {
    console.log('database connection succses ./..');
});
const imageDB = db.get('imagesUrl');

const MAX_DIG = 100000000000000000;
const screenHeight = 1920;                                  // Screen height when page load
const screenWidth = 1080;                                   // Screen width when page load 
const scrollStep = 9000;                                    // How many step to scroll when the page load  
const scrollDelay = 1000;                                   // Scroll delay btween each scroll step  
const imagesDownloadNumber = 3;                             // Number of image's to download
const imagesDownloadSize = 60000;                           // image size 60000 => 60KB
const imageNameFormat = 'id';                               // image name format : url, id, r
const imagePath = './images/';                              // Path where to save image's 
const pageUrl = 'https://unsplash.com/s/photos/random';     // Page url 


let imageSize;              // Image Size
let imageUrl;               // Image's url 
let imageName;              // Image's name after download
let images;                 // Array of imagsUrl
let result = false;


/**
 * Download number of images using DownloadImage()
 * @param {*} imageUrl 
 * @param {*} imagesDownloadNumber 
 * @param {*} imageSize 
 */
const DownloadNumberOfImages = async (imageUrl, imagesDownloadNumber, imageSize) => {

    for (let i = 0; i < imagesDownloadNumber; i++) {
        // let randomId = Math.floor(Math.random(10000, false) * MAX_DIG);
        await urlText(imageUrl[i]);
        imageSize = await getImageSize(imageUrl[i]);
        imageName = await renameImages(imageUrl[i], imageNameFormat);
        if (imageSize > imagesDownloadSize) {

            let id = parseInt(imageName);
            const item = await imageDB.findOne({
                _id: id
            })
            if (item) continue;

            else {
                result = await DownloadImage(imageUrl[i], `${imagePath}${imageName}.png`);
                //INSERT INTO DATABASE
                const inserted = await imageDB.insert({ "_id": id, "imageUrl": imageUrl[i] });
                if (!inserted) console.log('DATABASE ERROR');
                else console.log('ITEM INSERTED');

                if (result === true) {
                    console.log('Success:', imageUrl[i], 'has been downloaded successfully.');
                } else {
                    console.log('Error:', imageUrl[i], 'was not downloaded.');
                    console.error(result);
                }
            }
        }
        else {
            console.log("Image Size Is Low :", imageSize);
        }

    }
}
/**
 * Download image's using https
 * @param {*} imageUrl 
 * @param {*} imagePath 
 */
const DownloadImage = async (imageUrl, imagePath) => new Promise((resolve, reject) => {
    const file = fs.createWriteStream(imagePath);

    https.get(imageUrl, response => {
        response.pipe(file);
        file.on('finish', () => {
            file.close(resolve(true));
        });
    }).on('error', error => {
        fs.unlink(imagePath);

        reject(error.message);
    });
});
/**
 * Get image size
 * @param {*} imageUrl 
 * @returns {Number}
 */
const getImageSize = async (imageUrl) => {
    const response = await axios.get(imageUrl)
    imageSize = response.headers['content-length'];
    return imageSize;
}
/**
 * Get image id from url
 * @param {*} imageUrl 
 * @returns {string}
 */
const getImageId = async (imageUrl) => {
    imageName = imageUrl.split('?')[0].split('/');
    imageName = imageName[imageName.length - 1];
    imageName = imageName.split('-')[1].split('-')[0];
    imageName = imageName.replace(/photo-/g, '');
    return imageName;
}
/**
 * Save image's url into file
 * @param {*} imageUrl 
 */
const urlText = async (imageUrl) => {

    await fs.writeFileSync("./out/url", imageUrl + '\n', {
        encoding: "utf8",
        flag: "a+",
        mode: 0o666
    }, function (err) {
        if (err) {
            return console.log(err);
        }
        console.log("The file was saved!");
    });
}

/**
 * Image's url name formater
 * @param {*} imageUrl 
 * @param {*} imageNameFormat 
 * @returns {string} 
 */
const renameImages = async (imageUrl, imageNameFormat) => {
    imageName = imageUrl;
    if (imageNameFormat === 'url') {
        await urlText(imageName);
        return imageName = `pohot-${Math.floor(Math.random(10000, false) * MAX_DIG)}`;
    } else if (imageNameFormat === 'id') {
        await getImageId(imageUrl);
    }
    else if (imageName === 'r') {
        return imageName = `pohot-${Math.floor(Math.random(10000, false) * MAX_DIG)}`;;
    }
    return imageName;
}

/*PUPPETEER STARTUP*/
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    //PAGE URL
    await page.goto('https://unsplash.com/s/photos/random');
    //SCREEN RESOLUTION
    await page.setViewport({
        width: screenWidth,
        height: screenHeight
    });
    //GET ALL IMAGE'S URL
    let Counter = 0
    while (Counter < imagesDownloadNumber) {
        await scrollPageToBottom(page, scrollStep, scrollDelay);
        Counter = await page.evaluate(() => document.querySelectorAll('.IEpfq img').length);
    }
    //GET IMAGE URL
    imageUrl = await page.evaluate(() => Array.from(document.querySelectorAll('.IEpfq img'), e => e.src));
    //CALL DOWNLOAD FUNCTION
    await DownloadNumberOfImages(imageUrl, imagesDownloadNumber, imagesDownloadSize);
    //PUPPETEER DISCONNT
    await browser.close();
    //MONGODB DISCONNT
    await db.close();
})();
