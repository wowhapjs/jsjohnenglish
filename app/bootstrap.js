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
// Calendar plan cards must switch the DB-backed learner state before the legacy study UI starts.
const shell=path.join(out,'wordstudy','index.html');
let html=fs.readFileSync(shell,'utf8');
html=html.replace('</body>',`<script>
document.addEventListener('click',async e=>{
  const b=e.target.closest?.('.plan[data-r][data-d]'); if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();
  try{
    const br=await fetch('/api/bootstrap',{cache:'no-store'}); if(!br.ok)throw new Error('BOOTSTRAP');
    const data=await br.json(),state=data.state||{};
    state.round=Math.max(1,Math.min(5,Number(b.dataset.r)||1));state.day=Math.max(1,Number(b.dataset.d)||1);
    const sr=await fetch('/api/study/state',{method:'PUT',headers:{'Content-Type':'application/json','X-Wordstudy-Request':'1'},body:JSON.stringify(state)});if(!sr.ok)throw new Error('STATE');
    document.querySelector('[data-tab="study"]')?.click();
    document.getElementById('frame').src='/wordstudy/study?plan='+Date.now();
  }catch(_){document.getElementById('toast').textContent='학습일 이동에 실패했습니다.';document.getElementById('toast').classList.add('show')}
},true);
</script></body>`);
fs.writeFileSync(shell,html);
require(path.join(out,'server.js'));
