'use strict';
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const out='/tmp/wordstudy-app';
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const parts=fs.readdirSync(__dirname).filter(x=>/^bundle\.\d+\.part$/.test(x)).sort();
const b64=parts.map(x=>fs.readFileSync(path.join(__dirname,x),'utf8')).join('');
const bundle=JSON.parse(zlib.gunzipSync(Buffer.from(b64,'base64')).toString('utf8'));
for(const [rel,content] of Object.entries(bundle)){const f=path.join(out,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,content)}
fs.copyFileSync(path.join(__dirname,'index.html'),path.join(out,'index.html'));
require(path.join(out,'server.js'));
