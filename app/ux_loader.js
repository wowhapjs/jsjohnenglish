'use strict';
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const packed=fs.readFileSync(path.join(__dirname,'uxbootstrap.gz.b64'),'utf8').trim();
const code=zlib.gunzipSync(Buffer.from(packed,'base64')).toString('utf8');
if(!code.includes("require(path.join(out,'server.js'))"))throw new Error('UX_BOOTSTRAP_INVALID');
eval(`(function(require,__dirname,__filename){${code}\n})(require,${JSON.stringify(__dirname)},${JSON.stringify(path.join(__dirname,'ux_loader.js'))});`);
