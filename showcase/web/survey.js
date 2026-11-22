const v2Draft=readLocal('draft-v2',null);
const v3Draft=readLocal('draft-v3',null);
const lastDraft=v3Draft || v2Draft || readLocal('draft',{}) || {};
const lastDraftSchema=v3Draft?surveyVersions['pawspace-response-v3'].questions:v2Draft?surveyVersions['pawspace-response-v2'].questions:previousQuestions;
const draft=readLocal('draft-v4',null) || {
  chapter:lastDraft.chapter,
  answers:Object.fromEntries(questions.filter(q=>q.options.includes(lastDraft.answers?.[q.id]) &&
    lastDraftSchema.some(old=>old.id===q.id && old.title===q.title)
  ).map(q=>[q.id,lastDraft.answers[q.id]]))
};
const noPet = () => answers.petCount==='目前没有';
let answers=draft.answers||{}, chapter=Number.isInteger(draft.chapter)?Math.max(0,Math.min(4,draft.chapter)):0;
let submissionId=draft.id||crypto.randomUUID();
let receipt=null;
function applies(q, a){return !q.when||q.when(a);}
function valid(q,a) {
  const v=a[q.id];
  if(v===undefined||v==='') return Boolean(q.optional);
  return typeof v==='string'&&(q.options?q.options.includes(v):v.trim().length>0&&v.length<=1800);
}
function saveDraft(){
  try{saveLocal('draft-v4',{chapter,answers,id:submissionId});}
  catch{byId('form-status').textContent='浏览器未能保存草稿。可以继续填写，完成后下载答卷。';}
}
function jump(i,scroll=true){
  chapter=i;saveDraft();renderSurvey();
  if(scroll){byId('survey-page').scrollIntoView({block:'start'});byId('chapter-title').focus({preventScroll:true});}
}
function updateAnswer(q,v){
  answers[q.id]=v;
  for (const item of questions) if (!applies(item, answers)) delete answers[item.id];
  saveDraft();
  if(['household','petCount','moved','days'].includes(q.id)){renderSurvey();const control=byId('field-'+q.id)?.querySelector('input:checked');control?.focus({preventScroll:true});}
}
function renderSurvey(){
  const page=byId('survey-page'),steps=byId('steps');page.replaceChildren();steps.replaceChildren();
  const title=el('h3',chapters[chapter][0]);title.id='chapter-title';title.tabIndex=-1;
  page.append(title,el('p',chapters[chapter][1],'quiet'));
  chapters.forEach(([name],i)=>{
    const done=sections[i].filter(q=>applies(q,answers)).every(q=>valid(q,answers));
    const step=action((done?'✓ ':String(i+1)+' · ')+name,()=>jump(i),'step');
    if(i===chapter)step.setAttribute('aria-current','step');
    step.disabled=noPet()&&i>0;
    steps.append(step);
  });
  for(const q of sections[chapter]){
    if(!applies(q,answers)||(noPet()&&!['household','petCount'].includes(q.id)))continue;
    const f=el('fieldset'),legend=el('legend',questionNumbers.get(q.id)+'　'+q.title+(q.optional?'（选填）':''));
    f.id='field-'+q.id;f.append(legend);
    if(q.hint){const hint=el('p',q.hint);hint.id='hint-'+q.id;f.append(hint);}
    const options=el('div',undefined,'options');
    for(const value of q.options){
      const label=el('label'),radio=el('input');radio.type='radio';radio.name=q.id;radio.value=value;radio.checked=answers[q.id]===value;
      radio.required=!q.optional;radio.onchange=()=>updateAnswer(q,value);
      if(q.hint)radio.setAttribute('aria-describedby','hint-'+q.id);
      label.append(radio,document.createTextNode(value));options.append(label);
    }
    f.append(options);
    page.append(f);
  }
  byId('prev').hidden=chapter===0;
  byId('next').hidden=noPet();
  byId('next').textContent=chapter===4?'提交这份答卷':'下一组';
  byId('form-status').textContent=noPet()?'本次问卷面向目前与宠物同住的人。感谢您的时间。':'';
}
byId('prev').onclick=()=>jump(chapter-1);
function reportMissing(group,q){
  jump(group);byId('form-status').textContent='请先回答「'+q.title+'」';
  const input=byId('field-'+q.id).querySelector('input,textarea');input.focus();input.reportValidity();
}
function recordFrom(data){
  if(!Object.hasOwn(surveyVersions,data?.format)||!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(data.id)||!data.answers||typeof data.answers!=='object'||Array.isArray(data.answers))throw Error('invalid');
  const schema=surveyVersions[data.format].questions;
  if(data.format!=='pawspace-response-v1'&&data.answers.petCount==='目前没有')throw Error('petCount');
  const result={};
  for(const q of schema)if(applies(q,data.answers)){
    if(!valid(q,data.answers))throw Error(q.id);
    result[q.id]=data.answers[q.id]||'';
  }
  return {format:data.format,id:data.id,answers:result};
}
function storeRecords(batch){
  const all=readLocal('responses',[]);
  const seen=new Set(all.map(r=>r.id));
  let added=0;
  for(const record of batch)if(!seen.has(record.id)){all.push(record);seen.add(record.id);added++;}
  saveLocal('responses',all);return added;
}
async function mergeRecords(rows){
  return navigator.locks? navigator.locks.request('pawspace-save',()=>storeRecords(rows)):storeRecords(rows);
}
byId('questionnaire').onsubmit=async event=>{
  event.preventDefault();
  if(noPet())return;
  const current=sections[chapter].find(q=>applies(q,answers)&&!valid(q,answers));
  if(current){reportMissing(chapter,current);return;}
  if(chapter<4){jump(chapter+1);return;}
  for(const [i,group] of sections.entries()){
    const missing=group.find(q=>applies(q,answers)&&!valid(q,answers));
    if(missing){reportMissing(i,missing);return;}
  }
  const record=recordFrom({format:currentFormat,id:submissionId,answers});
  byId('next').disabled=true;
  try{
    await mergeRecords([record]);receipt=record;
    byId('questionnaire').hidden=true;byId('receipt').hidden=false;
    byId('steps').querySelectorAll('button').forEach(b=>b.disabled=true);
    try{saveLocal('draft-v4',{});}catch{}
    byId('form-status').textContent='';renderChart();
  }catch{
    download('PawSpace-'+record.id+'.json',JSON.stringify(record,null,2),'application/json');
    byId('form-status').textContent='浏览器存储失败，已提供答卷下载。可通过研究者入口导入。';
  }finally{byId('next').disabled=false;}
};
byId('download-one').onclick=()=>{if(receipt)download('PawSpace-'+receipt.id+'.json',JSON.stringify(receipt,null,2),'application/json');};
byId('my-results').onclick=()=>{byId('source').value='live';familyFilter.selectedIndex=0;selectedAnswer='';renderChart();};
byId('another').onclick=()=>{
  answers={};submissionId=crypto.randomUUID();receipt=null;byId('questionnaire').hidden=false;byId('receipt').hidden=true;jump(0);
};
byId('import-records').onchange=async e=>{
  const rows=[];let rejected=0;
  for(const f of e.target.files){
    try{if(f.size>180000)throw Error('size');rows.push(recordFrom(JSON.parse(await f.text())));}catch{rejected++;}
  }
  try{
    const added=await mergeRecords(rows);
    byId('import-status').textContent='新收 '+added+' 份，重复 '+(rows.length-added)+' 份，格式或答案不完整 '+rejected+' 份。';
    if(rows.length){syncSources();byId('source').value=surveyVersions[rows.find(r=>r.format===currentFormat)?.format||rows[0].format].source;familyFilter.selectedIndex=0;selectedAnswer='';renderChart();}
  }catch{byId('import-status').textContent='当前浏览器无法保存导入的文件。';}
  e.target.value='';
};
window.addEventListener('storage',event=>{if(event.key==='pawspace.responses')renderChart();});
renderSurvey();

const instrument=byId('instrument');
sections.forEach((section,i)=>{
  const group=el('section',undefined,'instrument-group');
  group.append(el('h3',chapters[i][0]),el('p',chapters[i][1],'quiet'));
  for(const q of section){
    const line=el('div',undefined,'instrument-question');
    line.append(el('h4',questionNumbers.get(q.id)+'　'+q.title));
    if(q.when)line.append(el('p',q.when===branches.children?"仅询问与未满 18 岁孩子同住的家庭。":q.when===branches.detour?'仅询问过去 7 天有绕行经历的人。':'仅询问记得最近一次挪动用品的人。','quiet'));
    if(q.hint)line.append(el('p',q.hint,'quiet'));
    const options=el('div',undefined,'reading-options');
    q.options.forEach(v=>options.append(el('span',v)));line.append(options);
    group.append(line);
  }
  instrument.append(group);
});
document.querySelector('a[href="#full-survey"]').addEventListener('click',()=>{byId('full-survey').open=true;});

function openLinkedSurvey() {
  if (location.hash === '#full-survey' || location.hash === '#fill-survey') {
    byId(location.hash.slice(1)).open = true;
  }
}
window.addEventListener('hashchange',openLinkedSurvey);
openLinkedSurvey();
