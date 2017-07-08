
![Storage](https://github.com/ShihJayChuang/FirebaseDatabaseFunctions/blob/master/Storage.PNG)

![Database](https://github.com/ShihJayChuang/FirebaseDatabaseFunctions/blob/master/Database.PNG)

1.Firebase建立一個專案，Storage和Database規則改為public
 
2.下載[Node.js](https://nodejs.org/en/download/current/)開啟命令列cmd，查詢版本 node --version

3.查詢npm版本 npm --version

4.npm install -g firebase-tools查詢版本 firebase --version

5.下載可開啟js的編輯器，如 [Visual Studio Code](https://code.visualstudio.com/)

6.建立一個資料夾

7.cmd   cd test
  cmd   firebase login

8.鍵入y跳出視窗再點允許

9.cmd  firebase init

10.選取後點擊空白鍵再按enter 


11.選取firebase專案後按enter，再點擊y

12.js編輯器開啟test\functions裡的 index.js


13.cmd  firebase deploy

14.複製cmd 中的 Function URL 到瀏覽器貼上

15.在firebase server可看 Functions的LOGS

---------

1.cmd   npm install --save @google-cloud/storage會在node_modules多了 @google-cloud


2.cmd  npm install --save child-process-promise

FirebaseDatabaseFunctions\functions\index.js
``` java
/**

* Copyright 2016 Google Inc. All Rights Reserved.

*

* Licensed under the Apache License, Version 2.0 (the "License");

* you may not use this file except in compliance with the License.

* You may obtain a copy of the License at

*

* http://www.apache.org/licenses/LICENSE-2.0

*

* Unless required by applicable law or agreed to in writing, software

* distributed under the License is distributed on an "AS IS" BASIS,

* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

* See the License for t`he specific language governing permissions and

* limitations under the License.

*/

'use strict';

// [START import]

const functions = require('firebase-functions');

const gcs = require('@google-cloud/storage')();

const spawn = require('child-process-promise').spawn;

const path = require('path');

const os = require('os');

const fs = require('fs');

// [END import]

// [START generateThumbnail]

/**

* When an image is uploaded in the Storage bucket We generate a thumbnail automatically using

* ImageMagick.

*/

// [START generateThumbnailTrigger]

exports.generateThumbnail = functions.storage.object().onChange(event => {

// [END generateThumbnailTrigger]

// [START eventAttributes]

const object = event.data; // The Storage object.

const fileBucket = object.bucket; // The Storage bucket that contains the file.

const filePath = object.name; // File path in the bucket.

const contentType = object.contentType; // File content type.

const resourceState = object.resourceState; // The resourceState is 'exists' or 'not_exists' (for file/folder deletions).

const metageneration = object.metageneration; // Number of times metadata has been generated. New objects have a value of 1.

// [END eventAttributes]

// [START stopConditions]

// Exit if this is triggered on a file that is not an image.

if (!contentType.startsWith('image/')) {

console.log('This is not an image.');

return;

}

// Get the file name.

const fileName = path.basename(filePath);

// Exit if the image is already a thumbnail.

if (fileName.startsWith('thumb_')) {

console.log('Already a Thumbnail.');

return;

}

// Exit if this is a move or deletion event.

if (resourceState === 'not_exists') {

console.log('This is a deletion event.');

return;

}

// Exit if file exists but is not new and is only being triggered

// because of a metadata change.

if (resourceState === 'exists' && metageneration > 1) {

console.log('This is a metadata change event.');

return;

}

// [END stopConditions]

// [START thumbnailGeneration]

// Download file from bucket.

const bucket = gcs.bucket(fileBucket);

const tempFilePath = path.join(os.tmpdir(), fileName);

return bucket.file(filePath).download({

destination: tempFilePath

}).then(() => {

console.log('Image downloaded locally to', tempFilePath);

// Generate a thumbnail using ImageMagick.

return spawn('convert', [tempFilePath, '-thumbnail', '200x200>', tempFilePath]);

}).then(() => {

console.log('Thumbnail created at', tempFilePath);

// We add a 'thumb_' prefix to thumbnails file name. That's where we'll upload the thumbnail.

const thumbFileName = `thumb_${fileName}`;

const thumbFilePath = path.join(path.dirname(filePath), thumbFileName);

// Uploading the thumbnail.

return bucket.upload(tempFilePath, {destination: thumbFilePath});

// Once the thumbnail has been uploaded delete the local file to free up disk space.

}).then(() => fs.unlinkSync(tempFilePath));

// [END thumbnailGeneration]

});

// [END generateThumbnail]

```

test\functions\package.json
```java
{

"name": "generate-thumbnail-functions",

"description": "Generate Thumbnail Firebase Functions sample",

"dependencies": {

"@google-cloud/storage": "^0.4.0",

"child-process-promise": "^2.2.0",

"firebase-admin": "^4.1.1",

"firebase-functions": "^0.5.1"

}

}

```
3.cmd  firebase deploy

4.到firebase console>Storage上傳相片後refresh，會自動生成縮圖

---------

1.Firebase console>Overview右邊齒輪>專案設定

2.服務帳號>選 Node.js 後點擊 產生新的私密金鑰


3.下載後移到 test\functions 底下

4.index.js 的 keyFilename 為金鑰檔名

5.cmd  npm install --save firebase-admin 
 cmd  npm install -- save mkdirp-promise

test\functions\index.js
```java
const functions = require('firebase-functions');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
// response.send("Hello from Firebase!");
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

// Exit if this is a move or deletion event.
if (event.data.resourceState === 'not_exists') {
console.log('This is a deletion event.');
return;
}

// Cloud Storage files.
const bucket = gcs.bucket(event.data.bucket);
const file = bucket.file(filePath);
const thumbFile = bucket.file(thumbFilePath);

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
if (fileDir === "photos/Cosmo") {
// push()會自動增加 key
//return admin.database().ref('images/Cosmo').child(aFileName).puch({ fileDir: fileDir, fileName: fileName, path: fileUrl, thumbPath: thumbFileUrl });
return admin.database().ref('images/Cosmo').child(aFileName).set({ fileDir: fileDir, fileName: fileName, path: fileUrl, thumbPath: thumbFileUrl });
}
if (fileDir === "photos/Gratima") {
return admin.database().ref('images/Gratima').child(aFileName).set({ fileDir: fileDir, fileName: fileName, path: fileUrl, thumbPath: thumbFileUrl });
}

});
});

```
test\functions\package.json
```java
{
  "name": "functions",
  "description": "Cloud Functions for Firebase",
  "dependencies": {
    "@google-cloud/storage": "^1.1.1",
    "child-process-promise": "^2.2.1",
    "firebase-admin": "^4.2.1",
    "firebase-functions": "^0.5.7",
    "mkdirp-promise": "^5.0.1"
  },
  "private": true
}

```
6.cmd  firebase deploy

7.到firebase console上傳相片，或安裝 [Google Cloud SDK for use on command line](https://goo.gl/oR9Vo9) 上傳相片

8.之後Storage會有縮圖，Database會產生json


