const fs = require('fs');
const https = require('https');
const puppeteer = require('puppeteer');
const scrollPageToBottom = require('./scroll');
const axios = require('axios');
const monk = require('monk');

const db = monk(process.env.MONGO_URL || 'localhost: 27017/imageDB');

require('dotenv').config()

db.then(() => {
    console.log('database connection succses ./..');
});
const imagesDownload = db.get('localImages');
const imagesUrl = db.get('imagesUrl');

const MAX_DIG = 100000000000000000;
const screenHeight = 50000;                                 // Screen height when page load
const screenWidth = 50000;                                  // Screen width when page load
const scrollStep = 9000;                                    // How many step to scroll when the page load  
const scrollDelay = 1000;                                   // Scroll delay btween each scroll step  
const imagesDownloadNumber = 10;                             // Number of image's to download
const imagesDownloadSize = 60000;                           // image size 60000 => 60KB
const imageNameFormat = 'r';                               // image name format : url, id, r
const imagePath = './images/';                              // Path where to save image's 
const pageUrl = 'https://unsplash.com/s/photos/random';     // Page url 

let localImagePath = 'Local://'
let imageSize;              // Image Size
let imageUrl;               // Image's url 
let imageName;              // Image's name after download
let images;                 // Array of imagsUrl
let imageLabels;            //image lable's/tag's
let result = false;

/**
 * Download number of images using DownloadImage()
 * @param {*} imageUrl 
 * @param {*} imagesDownloadNumber 
 * @param {*} imageSize 
 */
const DownloadNumberOfImages = async (imageUrl, imagesDownloadNumber, imageSize, imageNameFormat) => {

    for (let i = 0; i < imagesDownloadNumber; i++) {

        let randomId = Math.floor(Math.random(10000, false) * MAX_DIG);

        imageLabels = await quickstart(imageUrl[i]);
        imageSize = await getImageSize(imageUrl[i]);
        imageName = await renameImages(imageUrl[i], imageNameFormat);
        await urlText(imageUrl[i]);
        if (imageSize > imagesDownloadSize) {


            let id = parseInt(imageName);

            const item = await imagesDownload.findOne({
                imageUrl: imageUrl[i]
            });

            if (item) continue;

            else {
                localImagePath = `${localImagePath}${imageName}.png`;

                result = await DownloadImage(imageUrl[i], `${imagePath}${imageName}.png`);
                //INSERT INTO DATABASE
                const inserted = await imagesDownload.insert({ "_id": randomId, "imageUrl": imageUrl[i], "Labels": imageLabels, "localImagePath": localImagePath });
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
            const item = await imagesUrl.findOne({
                imageUrl: imageUrl[i]
            });
            if (item) continue;
            else {
                const inserted = await imagesUrl.insert({ "_id": randomId, "imageUrl": imageUrl[i], "Labels": imageLabels });
                if (!inserted) console.log('DATABASE ERROR');
                else console.log('ITEM INSERTED');
            }
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
    imageName = await imageUrl.split('?')[0].split('/');
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
        return imageName = `photo-${Math.floor(Math.random(10000, false) * MAX_DIG)}`;
    } else if (imageNameFormat === 'id') {
        await getImageId(imageUrl);
    }
    else if (imageName === 'r') {
        return imageName = `photo-${Math.floor(Math.random(10000, false) * MAX_DIG)}`;
    }
    else {
        return imageName = `photo-${Math.floor(Math.random(10000, false) * MAX_DIG)}`;
    }
}
/**
 * Get image lables
 * @param {*} imagesUrl 
 */
const quickstart = async (imagesUrl) => {
    // Imports the Google Cloud client library
    const vision = require('@google-cloud/vision');

    // Creates a client
    const client = new vision.ImageAnnotatorClient();

    // Performs label detection on the image file
    const [result] = await client.labelDetection(imagesUrl);
    labels = result.labelAnnotations;
    labels.forEach((label, index, array) => {
        array[index] = label.description;
    });
    imageLabels = labels;

    return imageLabels;
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
        console.log(Counter);
    }
    //GET IMAGE URL
    imageUrl = await page.evaluate(() => Array.from(document.querySelectorAll('.IEpfq img'), e => e.src));
    //CALL DOWNLOAD FUNCTION
    await DownloadNumberOfImages(imageUrl, imagesDownloadNumber, imagesDownloadSize, imageNameFormat);
    //PUPPETEER DISCONNT
    await browser.close();
    //MONGODB DISCONNT
    await db.close();
})();
