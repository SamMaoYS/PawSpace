const demo = document.querySelector('.demo-player video');
const cover = document.querySelector('.demo-cover');
function syncDemoCover() {
  cover.hidden = !demo.paused && !demo.ended;
  demo.controls = cover.hidden;
}
cover.addEventListener('click', async () => {
  try {
    await demo.play();
  } catch {
    // Leave native controls available if the browser rejects playback.
    cover.hidden = true;
    demo.controls = true;
  }
});
for (const event of ['play', 'pause', 'ended']) demo.addEventListener(event, syncDemoCover);
syncDemoCover();

const room = document.querySelector('#room');
const stage = document.querySelector('.stage');
const nav = document.querySelector('#views');
const notice = document.querySelector('#notice');
const current = document.querySelector('#current');
const markers = document.querySelector('#markers');
const home = document.querySelector('#home');
const expand = document.querySelector('#expand');
const buttons = new Map();
const pins = new Map();
let active = 'overview';
let views = [];
const report = Boolean(document.querySelector('#plan'));
let language = report && document.documentElement.lang !== 'en' ? 'zh' : 'en';
let failed = false;
let model = 'scan';
const modelButtons = document.querySelectorAll('[data-model]');
function thumbnail(id) {
  const directory = model === 'design' ? './assets/design-views/' : './assets/';
  return directory + id + '.jpg';
}
function selectModel(next) {
  if (next === model && !failed) return;
  if (room.loaded && !active) {
    const {theta, phi, radius} = room.getCameraOrbit();
    const {x, y, z} = room.getCameraTarget();
    room.cameraOrbit = theta+'rad '+phi+'rad '+radius+'m';
    room.cameraTarget = x+'m '+y+'m '+z+'m';
    room.fieldOfView = room.getFieldOfView()+'deg';
  }
  model = next;
  failed = false;
  notice.textContent = local('正在载入模型…', 'Loading model…');
  notice.hidden = false;
  room.poster = thumbnail('overview');
  room.src = next === 'design' ? './assets/design.glb' : './assets/room.glb';
  for (const button of modelButtons) button.setAttribute('aria-pressed', String(button.dataset.model === next));
  for (const [id, button] of buttons) button.querySelector('img').src = thumbnail(id);
}
for (const button of modelButtons) {
  button.addEventListener('click', () => {
    selectModel(button.dataset.model);
    const url = new URL(location.href);
    if (model === 'design') url.searchParams.set('model', model);
    else url.searchParams.delete('model');
    history.replaceState(null, '', url);
  });
}

// Keep a copy of the original English before switching the page in place.
const translations = [];
for (const [key, attr] of [['data-zh', null], ['data-zh-aria','aria-label'], ['data-zh-alt','alt'], ['data-zh-title','title']]) {
  for (const el of document.querySelectorAll('[' + key + ']')) {
    translations.push({el, attr, zh: el.getAttribute(key), en: attr ? el.getAttribute(attr) : el.textContent});
  }
}
function local(zh, en) { return language === 'en' ? en : zh; }

function applyLanguage(next) {
  language = next;
  document.documentElement.lang = local('zh-CN', 'en');
  for (const item of translations) {
    if (item.attr) item.el.setAttribute(item.attr, item[next]);
    else item.el.textContent = item[next];
  }
  for (const button of document.querySelectorAll('[data-lang]')) {
    button.setAttribute('aria-pressed', String(button.dataset.lang === next));
  }
  for (const view of views) {
    const button = buttons.get(view.id);
    const name = local(view.nameZh, view.name);
    const detail = local(view.detail, view.detailEn);
    button.querySelector('.view-name').textContent = name;
    button.querySelector('.view-detail').textContent = detail;
    const pin = pins.get(view.id);
    if (pin) {
      pin.querySelector('.pin-label').textContent = name;
      pin.setAttribute('aria-label', detail);
    }
  }
  if (views.length) updateSelection(active);
  else current.textContent = local('房间全景', 'Entire room');
  if (failed) showError();
  else notice.textContent = local('正在载入模型…', 'Loading model…');
  syncFullscreen();
}
for (const button of document.querySelectorAll('[data-lang]')) {
  button.addEventListener('click', () => {
    applyLanguage(button.dataset.lang);
    try { localStorage.setItem('scandesigner.language', language); } catch {}
  });
}
try { if (!report && localStorage.getItem('scandesigner.language') === 'zh') language = 'zh'; } catch {}
if (report) window.addEventListener('paw-language', event => applyLanguage(event.detail));
applyLanguage(language);

function showError() {
  failed = true;
  notice.hidden = false;
  notice.textContent = local('模型未能载入，请刷新页面，或用支持 WebGL 2 的浏览器打开。', 'Could not load the model. Refresh the page or open it in a browser with WebGL 2.');
}
room.addEventListener('error', showError);
room.addEventListener('load', () => { failed = false; notice.hidden = true; });
if (room.loaded) notice.hidden = true;
if (new URLSearchParams(location.search).get('model') === 'design') selectModel('design');

function updateSelection(id) {
  active = id;
  stage.dataset.preset = id || 'free';
  for (const [key, button] of buttons) button.setAttribute('aria-pressed', String(key === id));
  for (const [key, pin] of pins) {
    pin.hidden = Boolean(id && id !== 'overview' && key !== id);
    pin.classList.toggle('focus', key === id);
  }
  current.textContent = id ? buttons.get(id).querySelector('.view-detail').textContent : local('自由视角', 'Free view');
}

function goTo(view) {
  updateSelection(view.id);
  const [theta, phi, radius] = view.orbit;
  room.cameraTarget = view.target.map(value => value+'m').join(' ');
  room.cameraOrbit = theta+'deg '+phi+'deg '+radius+'m';
  room.fieldOfView = view.fov+'deg';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches && room.loaded) room.jumpCameraToGoal();
}

function addView(view) {
  const button = document.createElement('button');
  button.className = 'view';
  const thumb = document.createElement('img');
  thumb.src = thumbnail(view.id);
  thumb.alt = '';
  const text = document.createElement('span');
  text.className = 'view-text';
  for (const [cls, label] of [['view-name',view.name], ['view-detail',view.detail]]) {
    const span = document.createElement('span');
    span.className = cls;
    span.textContent = label;
    text.append(span);
  }
  button.append(thumb, text);
  button.insertAdjacentHTML('beforeend','<svg class="chev" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4 4 4-4 4"/></svg>');
  button.addEventListener('click', () => goTo(view));
  nav.append(button);
  buttons.set(view.id, button);
  if (!view.position) return;
  const pin = document.createElement('button');
  pin.className = 'pin';
  pin.slot = 'hotspot-'+view.id;
  pin.dataset.key = view.id;
  pin.dataset.position = view.position.map(value => value+'m').join(' ');
  pin.dataset.normal = view.normal.join(' ');
  pin.setAttribute('aria-label',view.name+' · '+view.detail);
  const label = document.createElement('span');
  label.className = 'pin-label';
  label.textContent = view.name;
  pin.append(label);
  pin.addEventListener('click', event => {
    event.stopPropagation();
    goTo(view);
  });
  room.append(pin);
  pins.set(view.id, pin);
}

markers.addEventListener('click', () => {
  const off = stage.classList.toggle('no-pins');
  markers.setAttribute('aria-pressed', String(!off));
});
function syncFullscreen() {
  const isFull = Boolean(document.fullscreenElement || stage.classList.contains('immersive'));
  expand.setAttribute('aria-label',isFull ? local('退出全屏', 'Exit fullscreen') : local('全屏', 'Fullscreen'));
  expand.title = expand.getAttribute('aria-label');
  expand.setAttribute('aria-pressed', String(isFull));
}
expand.addEventListener('click', async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  else if (stage.requestFullscreen && !stage.classList.contains('immersive')) {
    try { await stage.requestFullscreen(); } catch { stage.classList.add('immersive'); }
  } else stage.classList.toggle('immersive');
  syncFullscreen();
});
document.addEventListener('fullscreenchange',syncFullscreen);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && stage.classList.contains('immersive')) {
    stage.classList.remove('immersive');
    syncFullscreen();
  }
});

try {
  const response = await fetch('./assets/views.json');
  if (!response.ok) throw Error('views');
  views = await response.json();
  for (const view of views) addView(view);
  home.addEventListener('click',() => goTo(views[0]));
  applyLanguage(language);
  room.addEventListener('camera-change', event => {
    if (event.detail.source === 'user-interaction' && active) updateSelection(null);
  });
} catch { showError(); }

const petRoom = document.querySelector('#pet-room');
const petPhoto = document.querySelector('#pet-photo');
const rotateButton = document.querySelector('#pet-rotate');
const stillButton = document.querySelector('#pet-still');
const petError = document.querySelector('#pet-error');

function showPetView(interactive) {
  (report ? document.querySelector('#plan') : petPhoto).hidden = interactive;
  if (report) document.querySelector('#plan-mode').textContent = interactive ? '拖动旋转 · 双指或滚轮缩放' : '虚拟副本 · 剖视渲染';
  petRoom.hidden = !interactive;
  rotateButton.hidden = interactive;
  stillButton.hidden = !interactive;
  (interactive ? stillButton : rotateButton).focus({preventScroll: true});
}

rotateButton.addEventListener('click', () => {
  petError.hidden = true;
  showPetView(true);
  if (!petRoom.hasAttribute('src')) {
    petRoom.poster = report ? './assets/showcase/pet-zones-render.jpg' : './assets/showcase/cat-corner.jpg';
    petRoom.src = report ? './assets/pet-zones.glb' : './assets/pet-layout.glb';
  }
});
stillButton.addEventListener('click', () => showPetView(false));
petRoom.addEventListener('error', () => {
  petRoom.removeAttribute('src');
  showPetView(false);
  petError.hidden = false;
});
