const functions = require('firebase-functions');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

const mkdirp = require('mkdirp-promise');
// Include a Service Account Key to use a Signed URL
const gcs = require('@google-cloud/storage')({ keyFilename: 'functions-81d33-firebase-adminsdk-d99ph-c8d7a5ce4b.json' });
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const spawn = require('child-process-promise').spawn;
const path = require('path');
const os = require('os');
const fs = require('fs');

// Max height and width of the thumbnail in pixels.
const THUMB_MAX_HEIGHT = 200;
const THUMB_MAX_WIDTH = 200;
// Thumbnail prefix added to file names.
const THUMB_PREFIX = 'thumb_';

const DATABASE_COSMO_REF = 'images/Cosmo';
const DATABASE_GLATIMA_REF = 'images/Glatima';
const DATABASE_DECO_REF = 'images/Deco';

const STORAGE_COSMO_REF = 'images/Cosmo';
const STORAGE_GLATIMA_REF = 'images/Glatima';
const STORAGE_DECO_REF = 'images/Deco';

/**
 * When an image is uploaded in the Storage bucket We generate a thumbnail automatically using
 * ImageMagick.
 * After the thumbnail has been generated and uploaded to Cloud Storage,
 * we write the public URL to the Firebase Realtime Database.
 */
exports.generateThumbnail = functions.storage.object().onChange(event => {
  // File and directory paths.
  const filePath = event.data.name;
  const fileDir = path.dirname(filePath);
  const fileName = path.basename(filePath);

  const aFileName = fileName.replace(/(\.)?([^\/.]*)$/, "");
  const thumbFilePath = path.normalize(path.join(fileDir, `${THUMB_PREFIX}${fileName}`));
  const tempLocalFile = path.join(os.tmpdir(), filePath);
  const tempLocalDir = path.dirname(tempLocalFile);
  const tempLocalThumbFile = path.join(os.tmpdir(), thumbFilePath);

  // Exit if this is triggered on a file that is not an image.
  if (!event.data.contentType.startsWith('image/')) {
    console.log('This is not an image.');
    return;
  }

  // Exit if the image is already a thumbnail.
  if (fileName.startsWith(THUMB_PREFIX)) {
    console.log('Already a Thumbnail.');
    return;
  }



  // Cloud Storage files.
  const bucket = gcs.bucket(event.data.bucket);
  const file = bucket.file(filePath);
  const thumbFile = bucket.file(thumbFilePath);

  // Exit if this is a move or deletion event.
  // if (event.data.resourceState === 'not_exists') {
  //   console.log('This is a deletion event.');
  //   return;
  // }
  if (event.data.resourceState === 'not_exists') {
    console.log('This is a deletion event.');
    if (fileDir === STORAGE_COSMO_REF) {
      return admin.database().ref(DATABASE_COSMO_REF).child(aFileName).set(null);
    }
    if (fileDir === STORAGE_GLATIMA_REF) {
      return admin.database().ref(DATABASE_GLATIMA_REF).child(aFileName).set(null);
    }
    if (fileDir === STORAGE_DECO_REF) {
      return admin.database().ref(DATABASE_DECO_REF).child(aFileName).set(null);
    }
  }


  // Create the temp directory where the storage file will be downloaded.
  return mkdirp(tempLocalDir).then(() => {
    // Download file from bucket.
    return file.download({ destination: tempLocalFile });
  }).then(() => {
    console.log('The file has been downloaded to', tempLocalFile);
    // Generate a thumbnail using ImageMagick.
    return spawn('convert', [tempLocalFile, '-thumbnail', `${THUMB_MAX_WIDTH}x${THUMB_MAX_HEIGHT}>`, tempLocalThumbFile]);
  }).then(() => {
    console.log('Thumbnail created at', tempLocalThumbFile);
    // Uploading the Thumbnail.
    return bucket.upload(tempLocalThumbFile, { destination: thumbFilePath });
  }).then(() => {
    console.log('Thumbnail uploaded to Storage at', thumbFilePath);
    // Once the image has been uploaded delete the local files to free up disk space.
    fs.unlinkSync(tempLocalFile);
    fs.unlinkSync(tempLocalThumbFile);
    // Get the Signed URLs for the thumbnail and original image.
    const config = {
      action: 'read',
      expires: '03-01-2500'
    };
    return Promise.all([
      thumbFile.getSignedUrl(config),
      file.getSignedUrl(config)
    ]);
  }).then(results => {
    console.log('Got Signed URLs.');
    const thumbResult = results[0];
    const originalResult = results[1];
    const thumbFileUrl = thumbResult[0];
    const fileUrl = originalResult[0];
    // Add the URLs to the Database
    if (fileDir === STORAGE_COSMO_REF) {
      // push()會自動增加 key
      //return admin.database().ref('images/Cosmo').child(aFileName).push({ fileDir: fileDir, fileName: fileName, path: fileUrl, thumbPath: thumbFileUrl });
      return admin.database().ref(DATABASE_COSMO_REF).child(aFileName).push({ typeName: aFileName, imageName: fileName, pathUrl: fileUrl, thumbPathUrl: thumbFileUrl });
    }
    if (fileDir === STORAGE_GLATIMA_REF) {
      return admin.database().ref(DATABASE_GLATIMA_REF).child(aFileName).push({ typeName: aFileName, imageName: fileName, pathUrl: fileUrl, thumbPathUrl: thumbFileUrl });
    }
    if (fileDir === STORAGE_DECO_REF) {
      return admin.database().ref(DATABASE_DECO_REF).child(aFileName).push({ typeName: aFileName, imageName: fileName, pathUrl: fileUrl, thumbPathUrl: thumbFileUrl });
    }

  });
});