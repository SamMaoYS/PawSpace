const byId = id => document.getElementById(id);
function el(tag, text, cls) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
}
function action(label, fn, cls) {
  const b = el('button', label, cls);
  b.type = 'button';
  b.addEventListener('click', fn);
  return b;
}
function readLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem('pawspace.' + key)) ?? fallback; }
  catch { return fallback; }
}
function saveLocal(key, data) { localStorage.setItem('pawspace.' + key, JSON.stringify(data)); }
function download(name, data, type) {
  const url = URL.createObjectURL(new Blob([data], {type}));
  const link = el('a');
  link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const zones = [
  {name:'猫窝',size:'50 × 40 cm 预留区',spot:'靠窗沙发扶手前',why:'让猫留在起居区，也让另一侧沙发座位前的地面空出来。',test:'先贴出占地，完全推开内门，再从沙发上起身走一次。',pin:[80.7,58.59],target:'.80m -1.23m 3.06m',orbit:'-110deg 45deg 2.8m'},
  {name:'猫砂盆',size:'48 × 38 cm 盆体',spot:'玄关侧，靠近鞋柜',why:'清砂后可以顺手把袋子带出门。进门换鞋和蹲下铲砂也会争用这块地面。',test:'摆一个同样大小的纸箱，一个人蹲在盆前，另一个人从门口进来。',pin:[24.17,85.09],target:'-.18m -1.28m -1.97m',orbit:'-55deg 38deg 2.4m'},
  {name:'食盆与水碗',size:'38 × 23 cm 双碗垫',spot:'半岛外侧，折叠凳旁',why:'两只碗放在同一张可抽出的垫子上，便于整张拿走清洗。凳子拉开后还要检查两者间距。',test:'把凳子拉到平时的位置，端一只装水的碗走到水槽，再沿原路回来。',pin:[59.52,65.3],target:'.67m -1.30m 1.20m',orbit:'-100deg 37deg 2.1m'},
  {name:'粮桶',size:'约 25 × 20 cm 含盖占地',spot:'电视矮柜旁，靠墙放置',why:'粮桶从水槽和半岛之间移到墙边，把厨房过道留给端碗和取水的人。桶底加防滑垫，减少宠物蹭过时把桶顶走的机会。',test:'在桶里只剩少量粮时，轻推桶身，检查会不会滑动或翻倒。再打开桶盖取一勺粮，请另一人同时经过。',pin:[62.32,86.43],target:'-.703m -1.22m 1.30m',orbit:'-98deg 37deg 2.15m'}
];
function selectZone(index) {
  const z = zones[index];
  for (const b of document.querySelectorAll('[data-zone]')) b.setAttribute('aria-pressed',String(+b.dataset.zone === index));
  byId('zone-detail').replaceChildren(el('h3',z.spot),el('strong',z.size),el('p',z.why),el('h4','在家怎么试'),el('p',z.test));
  const model = byId('pet-room');
  model.setAttribute('camera-target',z.target);model.setAttribute('camera-orbit',z.orbit);
}
zones.forEach((z,i) => {
  const pick = () => selectZone(i);
  const b = action(z.name,pick), pin = action(String(i+1),pick);
  b.dataset.zone = pin.dataset.zone = String(i);
  pin.setAttribute('aria-label','查看'+z.name);
  pin.style.left=z.pin[0]+'%';pin.style.top=z.pin[1]+'%';
  byId('zone-choices').append(b);byId('plan-pins').append(pin);
});
selectZone(0);
const colors=['#416b50','#bf7753','#91aab2','#b4aa74','#847396'];
const familyFilter=byId('family-filter');

let selectedAnswer='';
const isCases=()=>byId('source').value==='cases';
const currentFormat = 'pawspace-response-v4';
const activeFormat = () => Object.keys(surveyVersions).find(key=>surveyVersions[key].source===byId('source').value) || currentFormat;
const activeSurvey = () => surveyVersions[activeFormat()];
const activeQuestions = () => activeSurvey().questions;
const sourceRecords = () => isCases() ? familyCases : readLocal('responses',[]).filter(r=>r.format===activeFormat());
function syncSources() {
  const records=readLocal('responses',[]);
  for(const [format,label] of [['pawspace-response-v1','旧版实收答卷（第一版）'],['pawspace-response-v2','旧版实收答卷（第二版）'],['pawspace-response-v3',"旧版实收答卷（第三版）"]]){
    const value=surveyVersions[format].source;
    if(records.some(r=>r.format===format) && !Array.from(byId('source').options).some(o=>o.value===value))
      byId('source').add(new Option(label,value));
  }
}
const metricLabels = {
  purchaseFit:'购买时的尺寸经历', measuring:'购买前测量次数', doorIssue:'开门受阻', days:'绕开用品的天数', layoutDifficulty:'自己布置时的困难',
  instruction:'希望如何给出要求', assistance:'希望 AI 完成的任务', keepFixed:'需要保留的位置', priorityRoute:'优先照顾的路线',
  sharedUse:"孩子与宠物最近如何共用空间", childPriority:"育儿家庭的布置重点", childrenCount:"同住孩子人数", youngest:"最小孩子的年龄", adults:"育儿家庭的成人人数",
  focus:'优先改善的区域', device:'扫描设备可用性', feature:'首选功能', evidence:'最想补充的信息', view:'首选视图'
};
function syncMetrics(schema){
  const select=byId('metric'), old=select.value;
  const ids=Object.keys(metricLabels).filter(id=>schema.some(q=>q.id===id));
  if(Array.from(select.options,o=>o.value).join()===ids.join())return;
  select.replaceChildren(...ids.map(id=>new Option(metricLabels[id],id)));
  if(ids.includes(old))select.value=old;
}
const designChecks=[
  {id:'measuring',matches:['量了两次或更多'],title:'为同一次选购反复量尺寸',design:'保留房间扫描得到的尺寸，下次换猫窝或砂盆时可以直接查看。'},
  {id:'purchaseFit',matches:['买大了，预留的位置放不下','买小了，宠物用起来空间不足','尺寸拿不准，最后没买'],title:'买大、买小，或因尺寸拿不准放弃购买',design:'用房间净空给出尺寸上限，再结合宠物实际需要的使用空间推荐合适范围。'},
  {id:'doorIssue',matches:['要先挪开用品才能把门打开','门会碰到用品，但仍能打开','为了避开用品，只把门开一部分'],title:'开门时要挪、会碰，或只能开一部分',design:'模拟门扇从关闭到全开的过程，指出哪件用品挡住了门。'},
  {id:'days',matches:['1–2 天','3–4 天','5–7 天'],title:'过去一周至少有一天要绕开用品',design:'沿常走的路线检查净宽，先标出需要侧身或绕开的地方。'},
  {id:'layoutDifficulty',matches:['不知道从哪个位置开始','不清楚怎样判断位置合不合适','要反复搬动实物才能比较','在软件里拖动、旋转或对齐很费劲'],title:'选位置、判断合适程度或手动调整费劲',design:'把一句日常要求转成候选位置，并说明为什么推荐这里，让用户决定要不要改。'}
];
function renderDesignFindings(group){
  const panel=byId('design-evidence'),list=byId('design-findings');
  panel.hidden=activeFormat()!==currentFormat || !group.length;
  list.replaceChildren();
  if(panel.hidden)return;
  for(const check of designChecks){
    const count=group.filter(r=>check.matches.includes(r.answers[check.id])).length;
    const card=el('article'),metric=el('b',count+' / '+group.length);
    card.append(metric,el('h4',check.title),el('p',check.design));list.append(card);
  }
}
function filteredRecords() {
  return sourceRecords().filter(r=> (familyFilter.selectedIndex===0 || r.answers.household===familyFilter.value) && (!selectedAnswer || r.answers[byId('metric').value]===selectedAnswer));
}
function renderChart() {
  syncSources();
  const schema = activeQuestions();
  const familyQuestion=schema.find(q=>q.id==='household');
  const familyOptions=['全部家庭',...familyQuestion.options];
  if(Array.from(familyFilter.options,o=>o.value).join()!==familyOptions.join()){
    familyFilter.replaceChildren(...familyOptions.map(name=>new Option(name,name)));
  }
  syncMetrics(schema);
  const records=sourceRecords(), total=records.length;
  byId('total').textContent=total;
  byId('source-note').textContent=isCases()?'头像与资料地区来自联系人截图，已确认的身份和家庭资料单独列出。13 份答卷用于演示家庭情境分析。':'仅统计本浏览器实际提交或由研究者导入的答卷。';
  let from=0; const arcs=[];
  byId('breakdown').replaceChildren();
  familyQuestion.options.forEach((name,i)=>{
    const n=records.filter(r=>r.answers.household===name).length;
    if(!n)return;
    const row=el('div',undefined,'legend-item'),label=el('span'),dot=el('i',undefined,'dot');
    dot.style.background=colors[i];label.append(dot,name);row.append(label,el('strong',n+' 户'));byId('breakdown').append(row);
    const end=from+100*n/total;arcs.push(colors[i]+' '+from+'% '+end+'%');from=end;
  });
  byId('donut').style.background=arcs.length?'conic-gradient('+arcs.join(',')+')':'#e3e6dc';
  const q=schema.find(q=>q.id===byId('metric').value);
  const group=records.filter(r=>familyFilter.selectedIndex===0 || r.answers.household===familyFilter.value);
  const eligible=group.filter(r=>(!q.when||q.when(r.answers)) && q.options.includes(r.answers[q.id]));
  byId('metric-question').textContent=q.title;byId('chart').replaceChildren();
  q.options.forEach(opt=>{
    const n=eligible.filter(r=>r.answers[q.id]===opt).length;
    const pct=eligible.length?Math.round(n*100/eligible.length):0;
    const row=action('',()=>{selectedAnswer=selectedAnswer===opt?'':opt;renderChart();},'chart-row');
    row.setAttribute('aria-pressed',String(selectedAnswer===opt));
    const track=el('span',undefined,'track'),fill=el('span',undefined,'fill');
    fill.style.width=pct+'%';track.append(fill);row.append(el('span',opt),track,el('span',n+' 份 · '+pct+'%'));byId('chart').append(row);
  });
  byId('chart-note').textContent=eligible.length?'本图分母为 '+eligible.length+' 份。点击横条查看选择该答案的家庭。':"当前范围没有适用这道题的答卷。";
  renderDesignFindings(group);
  renderRoster();
}
function renderRoster(){
  const rows=filteredRecords(),roster=byId('roster');roster.replaceChildren();
  byId('filter-state').textContent=(selectedAnswer?'筛选「'+selectedAnswer+'」 · ':'')+'显示 '+rows.length+' 份';
  if(selectedAnswer)byId('filter-state').append(' ',action('清除答案筛选',()=>{selectedAnswer='';renderChart();},'secondary'));

  for(const r of rows){
    const d=el('details',undefined,'person'),s=el('summary'),avatar=el('span',r.id.slice(0,3),'avatar'),title=el('div'),code=isCases()?r.id:r.id.slice(-8);
    if(isCases()){const im=el('img');im.alt='';im.src='assets/avatars/'+r.id+'.png';avatar.replaceChildren(im);}
    if(isCases()){
      const role=r.profileRole||r.job;
      title.append(el('b',role?code+' · '+role:code),el('small',r.family));
      if(r.profileRegion)title.append(el('em',r.profileRegion));
    }else{
      title.append(el('b',code+' · '+r.answers.household),el('small',r.answers.species||r.answers.pet),el('em',r.answers.age||''));
    }
    s.append(avatar,title);d.append(s);roster.append(d);
    d.addEventListener('toggle',()=>{
      if(!d.open||d.children.length>1)return;
      if(isCases()){
        const profile=el('dl');
        for(const [label,value] of [['资料地区',r.profileRegion],['联系人分组',r.profileGroup],['已确认的职业或学业',r.profileRole],['已确认的家庭资料',r.profileFamily],['案例年龄',String(r.age)],['案例职业',r.job],['案例宠物',r.pet]]){
          if(value)profile.append(el('dt',label),el('dd',value));
        }
        d.append(profile);
      }
      const note=r.context||r.answers.incident;
      if(note)d.append(el('blockquote',note));
      d.append(action('导出本份答卷 CSV',()=>exportCSV([r],code),'secondary'));
      activeSurvey().sections.forEach((sec,i)=>{
        d.append(el('h4',activeSurvey().chapters[i]));const list=el('dl');
        for(const q of sec){if(q.when&&!q.when(r.answers)) continue;list.append(el('dt',q.title),el('dd',r.answers[q.id]||'未填写（选填）'));}
        d.append(list);
      });
    });
  }
}
for(const id of ['source','metric','family-filter'])byId(id).addEventListener('change',()=>{selectedAnswer='';if(id==='source')familyFilter.selectedIndex=0;renderChart();});
function exportCSV(rows, label){
  const meta=isCases()?['家庭情境样本','代号','资料地区','联系人分组','已确认的职业或学业','已确认的家庭资料','案例年龄','案例职业','家庭背景','案例宠物']:['本机收集的答卷','编号'];
  const schema=activeQuestions();
  const table=[[...meta,...schema.map(q=>q.title)],...rows.map(r=>[...(isCases()?['家庭情境',r.id,r.profileRegion||'',r.profileGroup||'',r.profileRole||'',r.profileFamily||'',r.age,r.job||'',r.family,r.pet]:['实收',r.id]),...schema.map(q=>r.answers[q.id]||'')])];
  function escape(value){const str=document.documentElement.lang==='en'?toEnglish(value):String(value);return '"'+(/^[\s]*[=+@-]/.test(str)?"'":'')+str.replaceAll('"','""')+'"';}
  download('PawSpace-'+(isCases()?'家庭情境':'实收答卷')+'-'+label+'.csv','\uFEFF'+table.map(r=>r.map(escape).join(',')).join('\r\n'),'text/csv;charset=utf-8');
}
byId('all-csv').onclick=()=>exportCSV(sourceRecords(),'all');
byId('csv').onclick=()=>exportCSV(filteredRecords(),'PawSpace');
renderChart();
