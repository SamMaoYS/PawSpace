/* Localise presentation text only. Values used for filters, answers and IDs stay stable. */
const originalText=new WeakMap(),originalAttrs=new WeakMap();
const hasHan=s=>/[\u3400-\u9fff]/.test(s);
let reportLanguage=readLocal('language','zh')==='en'?'en':'zh';
function toEnglish(value){
  const s=String(value);
  if(englishCopy[s])return englishCopy[s];
  const t=s.trim();
  if(englishCopy[t])return s.replace(t,englishCopy[t]);
  let m;
  if((m=t.match(/^(\d{2}[a-e]?)　(.+?)(（选填）)?$/)))return m[1]+'　'+toEnglish(m[2])+(m[3]?' (optional)':'');
  if((m=t.match(/^([✓]|\d+ ·) (.+)$/)))return m[1]+' '+toEnglish(m[2]);
  if((m=t.match(/^(\d+) 户$/)))return m[1]+' '+(+m[1]===1?'household':'households');
  if((m=t.match(/^(\d+) 份 · (\d+%)$/)))return m[1]+' · '+m[2];
  if((m=t.match(/^本图分母为 (\d+) 份。点击横条查看选择该答案的家庭。$/)))return 'Based on '+m[1]+' responses. Select a bar to read the corresponding households.';
  if((m=t.match(/^显示 (\d+) 份$/)))return 'Showing '+m[1]+' responses';
  if((m=t.match(/^筛选「(.+)」 · 显示 (\d+) 份$/)))return toEnglish(m[1])+' · '+m[2]+' responses';
  if((m=t.match(/^请先回答「(.+)」$/)))return 'Please answer: '+toEnglish(m[1]);
  if((m=t.match(/^新收 (\d+) 份，重复 (\d+) 份，格式或答案不完整 (\d+) 份。$/)))return 'Added '+m[1]+', duplicates '+m[2]+', invalid or incomplete '+m[3]+'.';
  if((m=t.match(/^(.+) · (\d+) 岁$/)))return toEnglish(m[1])+', age '+m[2];
  if((m=t.match(/^查看(.+)$/))&&englishCopy[m[1]])return 'View '+englishCopy[m[1]].toLowerCase();
  if(t.includes(' · '))return t.split(' · ').map(v=>englishCopy[v]||v).join(' · ');
  return s;
}
function rewriteText(node){
  if(!node.parentElement||node.parentElement.closest('script,style,textarea,[data-report-lang],[data-zh]'))return;
  const current=node.nodeValue,old=originalText.get(node);
  if(!old&&!hasHan(current))return;
  const source=old&&(current===old.output||current===old.source)?old.source:current;
  const output=reportLanguage==='en'?toEnglish(source):source;
  originalText.set(node,{source,output});
  if(current!==output)node.nodeValue=output;
}
function translateBranch(root){
  if(root.nodeType===Node.TEXT_NODE){rewriteText(root);return;}
  if(root.nodeType!==Node.ELEMENT_NODE)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  while(walker.nextNode())rewriteText(walker.currentNode);
  const attrs=['aria-label','alt','title'];
  for(const elem of [root,...root.querySelectorAll('[aria-label],[alt],[title]')]){
    if(elem.closest('script,style,[data-report-lang]'))continue;
    const saved=originalAttrs.get(elem)||{};
    attrs.forEach(k=>{
      const value=elem.getAttribute(k);
      if(!value||elem.hasAttribute('data-zh-'+(k==='aria-label'?'aria':k)))return;
      const prev=saved[k],source=prev&&value===prev.output?prev.source:value;
      if(!prev&&!hasHan(source))return;
      const output=reportLanguage==='en'?toEnglish(source):source;saved[k]={source,output};
      if(value!==output)elem.setAttribute(k,output);
    });
    originalAttrs.set(elem,saved);
  }
}
function switchReportLanguage(lang){
  reportLanguage=lang;
  try{saveLocal('language',lang);}catch{}
  document.documentElement.lang=lang==='en'?'en':'zh-CN';
  for(const b of document.querySelectorAll('[data-report-lang]'))b.setAttribute('aria-pressed',String(b.dataset.reportLang===lang));
  window.dispatchEvent(new CustomEvent('paw-language',{detail:lang}));
  translateBranch(document.body);
  document.title=lang==='en'?'PawSpace · Pet-friendly homes':'PawSpace · 养宠家庭空间研究';
}
document.querySelectorAll('[data-report-lang]').forEach(b=>b.onclick=()=>switchReportLanguage(b.dataset.reportLang));
new MutationObserver(records=>{
  for(const record of records){
    if(record.type==='characterData')rewriteText(record.target);
    else if(record.type==='attributes')translateBranch(record.target);
    else record.addedNodes.forEach(translateBranch);
  }
}).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','alt','title']});
switchReportLanguage(reportLanguage);
