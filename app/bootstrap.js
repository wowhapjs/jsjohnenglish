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
// Accept both plain pipe-delimited rows and Markdown tables in personal-wordbook bulk import.
const oldBulk=`const words=String($('#bulk').value).split(/\\n/).map(x=>x.trim()).filter(Boolean).map(x=>{const p=x.split('|').map(y=>y.trim());return p[0]&&p[1]?{word:p[0],meaning:p[1],definition:p[2]||'',example:p[3]||''}:null}).filter(Boolean)`;
const newBulk=`const words=String($('#bulk').value).split(/\\n/).map(x=>x.trim()).filter(Boolean).map(x=>{const body=x.replace(/^\\s*\\|/,'').replace(/\\|\\s*$/,'');const p=body.split('|').map(y=>y.trim().replace(/\\\\~/g,'~'));if(p.length<2||p.every(y=>/^:?-{3,}:?$/.test(y)))return null;const a=(p[0]||'').toLowerCase(),b=(p[1]||'').toLowerCase();if((a==='영단어'||a==='word'||a==='english')&&(b==='한글뜻'||b==='뜻'||b==='meaning'||b==='korean'))return null;return p[0]&&p[1]?{word:p[0],meaning:p[1],definition:p[2]||'',example:p[3]||''}:null}).filter(Boolean)`;
if(!html.includes(oldBulk))throw new Error('BULK_IMPORT_PARSER_NOT_FOUND');
html=html.replace(oldBulk,newBulk).replace('<p class="muted">영단어 | 한글뜻 | 영영풀이 | 영어예문</p>','<p class="muted">영단어 | 한글뜻 | 영영풀이 | 영어예문 · Markdown 표도 그대로 붙여넣을 수 있습니다.</p>');
// Keep the heavy learner unloaded until the user actually opens the study tab.
html=html.replace('src="/wordstudy/study" title="단어공부"','src="about:blank" data-study-src="/wordstudy/study" title="단어공부"');
const shellStateDecl="const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];let me=null,boot=null,cursor=new Date(),bookData=null,currentBook=null;const q=[60,90,120,150,150],days=['월','화','수','목','금','토','일'];";
const shellStateNew=shellStateDecl+"function invalidateStudyFrame(){const f=$('#frame');if(!f)return;f.dataset.loaded='0';if(f.src&&f.src!=='about:blank'&&!f.src.endsWith('/about:blank'))f.src='about:blank'}";
if(!html.includes(shellStateDecl))throw new Error('SHELL_STATE_DECL_NOT_FOUND');
html=html.replace(shellStateDecl,shellStateNew);
const oldTab="function tab(n){$$('.tab').forEach(x=>x.classList.toggle('on',x.id===n));$$('nav button').forEach(x=>x.classList.toggle('on',x.dataset.tab===n));if(n==='planner')loadPlanner();if(n==='books')loadBooks();if(n==='tracking')loadTracking();if(n==='study')$('#frame').contentWindow?.location.reload()}";
const newTab="function tab(n){$$('.tab').forEach(x=>x.classList.toggle('on',x.id===n));$$('nav button').forEach(x=>x.classList.toggle('on',x.dataset.tab===n));if(n==='planner')loadPlanner();if(n==='books')loadBooks();if(n==='tracking')loadTracking();if(n==='study'){const f=$('#frame');if(f&&f.dataset.loaded!=='1'){f.dataset.loaded='1';f.src=f.dataset.studySrc||'/wordstudy/study'}}}";
if(!html.includes(oldTab))throw new Error('STUDY_TAB_HANDLER_NOT_FOUND');
html=html.replace(oldTab,newTab);
html=html.split("$('#frame').contentWindow?.location.reload()").join('invalidateStudyFrame()');
const oldGenerate="$('#genPlan').onclick=async()=>{const r=await api('/api/plan/generate',{method:'POST',body:JSON.stringify({round:boot.state.round})});toast(`${r.days}일 일정 생성 완료`);loadPlanner()}";
const newGenerate="$('#genPlan').onclick=async()=>{const r=await api('/api/plan/generate',{method:'POST',body:JSON.stringify({round:boot.state.round})});invalidateStudyFrame();toast(`${r.days}일 일정 생성 완료`);loadPlanner()}";
if(!html.includes(oldGenerate))throw new Error('PLAN_GENERATE_HANDLER_NOT_FOUND');
html=html.replace(oldGenerate,newGenerate);
html=html.replace('</body>',`<script>
document.addEventListener('click',async e=>{
  const b=e.target.closest?.('.plan[data-r][data-d]'); if(!b)return;
  e.preventDefault();e.stopImmediatePropagation();
  try{
    const br=await fetch('/api/bootstrap',{cache:'no-store'}); if(!br.ok)throw new Error('BOOTSTRAP');
    const data=await br.json(),state=data.state||{};
    state.round=Math.max(1,Math.min(5,Number(b.dataset.r)||1));state.day=Math.max(1,Number(b.dataset.d)||1);
    const sr=await fetch('/api/study/state',{method:'PUT',headers:{'Content-Type':'application/json','X-Wordstudy-Request':'1'},body:JSON.stringify(state)});if(!sr.ok)throw new Error('STATE');
    invalidateStudyFrame();
    document.querySelector('[data-tab="study"]')?.click();
  }catch(_){document.getElementById('toast').textContent='학습일 이동에 실패했습니다.';document.getElementById('toast').classList.add('show')}
},true);
</script></body>`);
fs.writeFileSync(shell,html);
// Planner DB is the source of truth. Overlay every persisted plan row onto the legacy learner cache.
const serverFile=path.join(out,'server.js');
let serverSource=fs.readFileSync(serverFile,'utf8');
const oldStudyState="const state={...getState(user.id),words:catalog(user.id)};";
const newStudyState="const savedState=getState(user.id),words=catalog(user.id),dayPlans={...(savedState.dayPlans||{})};const scheduledRows=db.prepare('SELECT round,day_index,word_ids FROM study_plan_days WHERE user_id=? ORDER BY round,day_index').all(user.id);for(const row of scheduledRows){try{const ids=JSON.parse(row.word_ids);if(Array.isArray(ids))dayPlans[`r${row.round}d${row.day_index}`]=ids}catch(_){}}const state={...savedState,dayPlans,words};";
if(!serverSource.includes(oldStudyState))throw new Error('DYNAMIC_STUDY_STATE_NOT_FOUND');
serverSource=serverSource.replace(oldStudyState,newStudyState);
fs.writeFileSync(serverFile,serverSource);

// Legacy learner fallback: hydrate missing English definitions from its dictionary APIs.
// If external dictionaries fail, show a clear skip path instead of trapping the learner.
const templateFile=path.join(out,'wordstudy','template.html.gz.b64');
let template=zlib.gunzipSync(Buffer.from(fs.readFileSync(templateFile,'utf8'),'base64')).toString('utf8');
template=template.replace('<link rel="preconnect" href="https://fonts.googleapis.com">\n','').replace('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n','').replace('<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&family=Noto+Sans+KR:wght@500;600;700;800;900&display=swap" rel="stylesheet">\n','');
const previewAnchor=`  function renderPreview(){\n    const idx=Math.max(0,Math.min(session.previewIndex||0,session.current.length-1));\n    const w=session.current[idx];\n    if(!w){finishPreviewStudy();return}\n`;
const previewPatch=`  function prepareMissingPreviewDefinition(w){\n    if(!w||String(w.definition||'').trim()||w._definitionLoading||w._definitionUnavailable)return;\n    w._definitionLoading=true;\n    (async()=>{\n      let hit=null;\n      try{const rows=await fetchDatamuseTopEntries(w.word,w.example||'',w.word,3);hit=rows?.[0]||null}catch(_){}\n      if(!hit){try{const rows=await fetchDictionaryTopEntries(w.word,w.example||'',w.word,3);hit=rows?.[0]||null}catch(_){}}\n      if(hit?.definition){\n        w.definition=String(hit.definition).trim();\n        if(!w.example&&hit.example)w.example=String(hit.example).trim();\n        if(hit.partOfSpeech)w.partOfSpeech=hit.partOfSpeech;\n        if(hit.audio)w.audio=hit.audio;\n        w._definitionUnavailable=false;\n        save();\n      }else w._definitionUnavailable=true;\n      w._definitionLoading=false;\n      if(session?.phase==='preview'&&session.current?.[session.previewIndex||0]?.id===w.id)render();\n    })();\n  }\n\n  function renderPreview(){\n    const idx=Math.max(0,Math.min(session.previewIndex||0,session.current.length-1));\n    const w=session.current[idx];\n    if(!w){finishPreviewStudy();return}\n    if(!String(w.definition||'').trim()){\n      els.mode.textContent='영영 스터디 ▾';\n      els.title.textContent=\`\${currentSetNumber()}세트 · 영영사전 \${idx+1}/\${session.current.length}\`;\n      els.grid.innerHTML='';els.actions.innerHTML='';\n      if(!w._definitionUnavailable){\n        els.hint.textContent='영영풀이를 사전에서 불러오는 중입니다.';\n        const d=document.createElement('div');d.className='pair dictionary-single';\n        d.innerHTML='<div class="word"><div class="preview-word-hidden">••••<small>사전 준비 중</small></div></div><div class="meaning"><div class="sense-loading">영영풀이를 불러오는 중입니다…</div></div>';\n        els.grid.appendChild(d);prepareMissingPreviewDefinition(w);return;\n      }\n      els.hint.textContent='이 단어의 영영풀이를 찾지 못했습니다. 이 단계만 건너뛰고 다음 단어로 진행할 수 있습니다.';\n      const d=document.createElement('div');d.className='pair dictionary-single preview-revealed';d.dataset.id=w.id;\n      d.innerHTML=\`\${wordCell(w)}<div class="meaning"><div class="sense-item"><div class="sense-pos">영영풀이 없음</div><div class="sense-def">사전에서 영영풀이를 찾지 못했습니다.</div></div><div class="warm-result no">한글 뜻: \${esc(w.meaning)}</div></div>\${exampleRow(w,false)}\`;\n      els.grid.appendChild(d);bindRowTools();button('다음 단어','primary',advancePreview,true);return;\n    }\n`;
if(!template.includes(previewAnchor))throw new Error('PREVIEW_RENDER_ANCHOR_NOT_FOUND');
template=template.replace(previewAnchor,previewPatch);
fs.writeFileSync(templateFile,zlib.gzipSync(Buffer.from(template,'utf8'),{level:9}).toString('base64'));
require(path.join(out,'server.js'));
