const path = require('path');
const ExifImage = require('exif').ExifImage;
const calipers = require('calipers')('jpeg');
const moment = require('moment');
const child_process = require('child_process');
const fs = require('fs-extra')


function getFiles (srcpath) {
  return fs.readdirSync(srcpath)
    .filter(file => fs.statSync(path.join(srcpath, file)).isFile())
}

function getFileByExtension (srcpath, extension) {
    var retval = null;

    var files = fs.readdirSync(srcpath);

    files.forEach(function(value) {
        if(value.endsWith(extension))
        {
            retval = path.join(srcpath, value);
        }
    });

    return retval;
}

var files = getFiles(path.join(__dirname,'images'));
var imageFiles = [];

var counter = 0;

function loopAgain() {
    if(counter < files.length)
    {
        let img = files[counter];

        calipers.measure(path.join(__dirname,'images',img)).then( 
            (result) => {
                try {
                    new ExifImage({ image : path.join(__dirname,'images',img) }, function (error, exifData) {
                        
                        let tstamp = null;
                        let imageCaption = img.replace(/\.[^/.]+$/, "");

                        if(exifData && exifData.exif && (exifData.exif.DateTimeOriginal || exifData.exif.DateTimeDigitized) ) 
                        {
                            var stringDate;
                            if(exifData.exif.DateTimeOriginal) 
                            {
                                stringDate = exifData.exif.DateTimeOriginal;
                            } 
                            else 
                            {
                                stringDate = exifData.exif.DateTimeDigitized;
                            }

                            tstamp = moment(stringDate, "YYYY:MM:DD HH:mm:ss");
                        }
                        else
                        {
                            // can we extract it from the file name?
                            var stringDate = imageCaption.substr(0, imageCaption.indexOf(' '));

                            tstamp = moment(stringDate, "YYYY-MM-DD");

                            if( isNaN(tstamp) ) {
                                tstamp = null;
                                // then we didn't find any date info on this file
                                console.log("ERROR: Couldn't find any date info: " + img);
                            } else {
                                // we want to have the caption just be the part after the date
                                imageCaption = imageCaption.substr(imageCaption.indexOf(' ')+1);
                            }
                        }

                        if(tstamp)
                        {
                            var formatedDate = tstamp.format("MMM D, YYYY"); 

                            imageFiles.push({
                                imageName: imageCaption,
                                fullFileName: path.join(__dirname,'images',img),
                                height: result.pages[0].height,
                                width: result.pages[0].width,
                                timestamp: tstamp.toDate(),
                                formatedDate: formatedDate
                            });
                        }

                        counter++;
                        loopAgain();
                    });
                } catch (error) {
                    console.log('Error: exif error ' + img);
                    counter++;
                    loopAgain();
                }
            },
            (error) => {
                console.log("Error: calipers error " + img);
                counter++;
                loopAgain();
            }
        );
    } else {
        // we are done
        buildPages();
    }
}

// let's remove all the pages first so we can start over
fs.emptyDir( path.join(__dirname,'pages'), err => {
    // kick it off
    loopAgain();
});

function buildPages() {

    let pageWidthInches = 8.5;
    let pageHeightInches = 11;
    let resolution = 300;

    let pageWidthPixels = pageWidthInches * resolution;
    let pageHeightPixels = pageHeightInches * resolution;

    console.log("DONE getting images: " + imageFiles.length);

    // sort the images by date
    imageFiles.sort(function(a, b){return a.timestamp - b.timestamp});

    // now decide how to put pictures
    var slots = [];
    var pageIndex = 0;
    var split = true;

    // put a picture in each corner to start
    for(let i = 0; i < imageFiles.length; i++) 
    {
        if(slots.length == 0) 
        {
            // then populate with the default two slots
            initializeSlots(slots, pageWidthPixels, pageHeightPixels);
            pageIndex++;
        }

        let imageFile = imageFiles[i];

        // determine if the aspect ratio of the slot matches the aspect ratio of the image
        let ratioSlot = calculateSlotRatio(slots[0]);
        let ratioImage = imageFile.width / imageFile.height;

        // let's see if the ratios match
        if( (ratioSlot <= 1 && ratioImage <= 1)
            || (ratioSlot >= 1 && ratioImage >= 1) )
        {
            // then we will be using this slot
        }
        else if(slots[0].recursion < 2)
        {
            // let's split this slot into two slots
            splitFirstSlot(slots);
        }

        let coords = slots.shift();

        let pagePath = path.join(__dirname,'pages',"page" + ("00" + pageIndex).slice(-3) + ".png");
        let params = ' ' + pageWidthPixels + ' ' + pageHeightPixels + ' "' + pagePath + '" "' + imageFile.fullFileName + '" ' + coords.topLeft.x + ' ' + coords.topLeft.y + ' ' + coords.bottomRight.x + ' ' + coords.bottomRight.y + ' "' + imageFile.formatedDate + ': ' + imageFile.imageName + '"';
        child_process.execSync(path.join(__dirname,'photo-book-dot-net','bin','Release','photo-book.exe') + params);

        console.log(((i+1) / imageFiles.length * 100).toFixed(0) + "% complete on page " + (pageIndex));
    }
}

function initializeSlots(slots, pageWidthPixels, pageHeightPixels) {
    let result = {};
    result.topLeft = {};
    result.bottomRight = {};

    result.topLeft.x = 150;
    result.topLeft.y = 0;
    result.bottomRight.x = pageWidthPixels;
    result.bottomRight.y = Math.ceil(pageHeightPixels/2);
    result.recursion = 0;

    slots.push(result);

    result = {};
    result.topLeft = {};
    result.bottomRight = {};

    result.topLeft.x = 150;
    result.topLeft.y = Math.ceil(pageHeightPixels/2);
    result.bottomRight.x = pageWidthPixels;
    result.bottomRight.y = pageHeightPixels;
    result.recursion = 0;

    slots.push(result);
}

function splitFirstSlot(slots) {
    let ratioOfSlot = calculateSlotRatio(slots[0]);
    
    let slotToSplit = slots[0];

    let firstSplit = {};
    firstSplit.topLeft = {};
    firstSplit.bottomRight = {};

    let secondSplit = {};
    secondSplit.topLeft = {};
    secondSplit.bottomRight = {};

    if(ratioOfSlot > 1) 
    {
        // this is a wide slot, we will split it vertically
        firstSplit.topLeft.x = slotToSplit.topLeft.x;
        firstSplit.topLeft.y = slotToSplit.topLeft.y;
        firstSplit.bottomRight.x = Math.ceil((slotToSplit.bottomRight.x + slotToSplit.topLeft.x) / 2);
        firstSplit.bottomRight.y = slotToSplit.bottomRight.y;
        firstSplit.recursion = slotToSplit.recursion + 1;

        secondSplit.topLeft.x = Math.ceil((slotToSplit.bottomRight.x + slotToSplit.topLeft.x) / 2);
        secondSplit.topLeft.y = slotToSplit.topLeft.y;
        secondSplit.bottomRight.x = slotToSplit.bottomRight.x;
        secondSplit.bottomRight.y = slotToSplit.bottomRight.y;
        secondSplit.recursion = slotToSplit.recursion + 1;

        slots.shift();
        slots.unshift(secondSplit);
        slots.unshift(firstSplit);
    } 
    else 
    {
        // this is a tall slot, we will split it horizontally
        firstSplit.topLeft.x = slotToSplit.topLeft.x;
        firstSplit.topLeft.y = slotToSplit.topLeft.y;
        firstSplit.bottomRight.x = slotToSplit.bottomRight.x;
        firstSplit.bottomRight.y = Math.ceil((slotToSplit.bottomRight.y + slotToSplit.topLeft.y) / 2);
        firstSplit.recursion = slotToSplit.recursion + 1;

        secondSplit.topLeft.x = slotToSplit.topLeft.x;
        secondSplit.topLeft.y = Math.ceil((slotToSplit.bottomRight.y + slotToSplit.topLeft.y) / 2);
        secondSplit.bottomRight.x = slotToSplit.bottomRight.x;
        secondSplit.bottomRight.y = slotToSplit.bottomRight.y;
        secondSplit.recursion = slotToSplit.recursion + 1;

        slots.shift();
        slots.unshift(secondSplit);
        slots.unshift(firstSplit);
    }
    
}

function calculateSlotRatio(slot) {
    let width = slot.bottomRight.x - slot.topLeft.x;
    let height = slot.bottomRight.y - slot.topLeft.y;

    return (width/height);
}

function getCoordinates(pageWidthPixels, pageHeightPixels, index) {
    let result = {};
    result.topLeft = {};
    result.bottomRight = {};

    switch(index) {
        case 0:
        {
            result.topLeft.x = 0;
            result.topLeft.y = 0;
            result.bottomRight.x = Math.ceil(pageWidthPixels/2);
            result.bottomRight.y = Math.ceil(pageHeightPixels/2);
            break;
        }

        case 1: 
        {
            result.topLeft.x = Math.ceil(pageWidthPixels/2);
            result.topLeft.y = 0;
            result.bottomRight.x = pageWidthPixels;
            result.bottomRight.y = Math.ceil(pageHeightPixels/2);
            break;
        }

        case 2:
        {
            result.topLeft.x = 0;
            result.topLeft.y = Math.ceil(pageHeightPixels/2);
            result.bottomRight.x = Math.ceil(pageWidthPixels/2);
            result.bottomRight.y = pageHeightPixels;
            break;
        }

        case 3:
        {
            result.topLeft.x = Math.ceil(pageWidthPixels/2);
            result.topLeft.y = Math.ceil(pageHeightPixels/2);
            result.bottomRight.x = pageWidthPixels;
            result.bottomRight.y = pageHeightPixels;
            break;
        }
    }

    return result;
}

