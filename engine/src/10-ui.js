/* =====================================================================
   슬라이드 엔진 · 화면 도구 (A안: 구석의 둥근 단추와 부채꼴 메뉴)
   ===================================================================== */
var ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  move: '<path d="M4 12h15M13 6l6 6-6 6"/>',
  pen: '<path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z"/><path d="M14 7l3 3"/>',
  marker: '<path d="M4 20h7"/><path d="M7.5 16.5l-1-3 8.5-8.5 4 4-8.5 8.5z"/>',
  eraser: '<path d="M9 20h11"/><path d="M5.5 14.5l8-8a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L11.5 18.5H9.5z"/>',
  laser: '<circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  trashAll: '<path d="M4 7h16"/><path d="M6 7l1 13h10l1-13M9 7V4h6v3"/><path d="M9.5 11l5 5M14.5 11l-5 5"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  pick: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.3" fill="currentColor"/><circle cx="15" cy="15" r="1.3" fill="currentColor"/><circle cx="15" cy="9" r="1.3" fill="currentColor"/><circle cx="9" cy="15" r="1.3" fill="currentColor"/>',
  board: '<rect x="3" y="4" width="18" height="13" rx="1.5"/><path d="M8 21l2-4M16 21l-2-4M7 9h6M7 12h4"/>',
  black: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M6.5 7.5h11v7h-11z" fill="currentColor" stroke="none"/>',
  white: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 10.5h10"/>',
  confetti: '<path d="M4 20l5-12 7 7z"/><path d="M14 3v2.5M19 5.5l-1.8 1.8M21 10h-2.5M13.5 8.5l2-2"/>',
  presenter: '<rect x="2" y="4" width="13" height="10" rx="1.5"/><path d="M8.5 14v3M5 20h7"/><rect x="17" y="7" width="5" height="10" rx="1"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  gear: '<path d="M4 7h9M19 7h1M4 17h3M13 17h7"/><circle cx="16" cy="7" r="2.5"/><circle cx="10" cy="17" r="2.5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7"/><path d="M12 17h.01"/>',
  edit: '<path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M17.5 3.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  first: '<path d="M6 5v14M18 6l-7 6 7 6"/>',
  last: '<path d="M18 5v14M6 6l7 6-7 6"/>',
  hash: '<path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16"/>',
  skip: '<path d="M4 12h9M10 7l5 5-5 5"/><path d="M19 5v14"/>',
  notes: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7M9 7h3"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  text: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
  shape: '<rect x="3" y="11" width="9" height="9" rx="1"/><circle cx="16" cy="8" r="5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  motion: '<path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z"/><path d="M19 15v5M16.5 17.5h5"/>',
  align: '<path d="M4 4v16"/><rect x="8" y="6" width="12" height="4" rx="1"/><rect x="8" y="14" width="7" height="4" rx="1"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  check: '<path d="M5 12.5l4 4L19 6.5"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  slide: '<rect x="3" y="5" width="18" height="12" rx="1.5"/><path d="M8 21h8M12 17v4"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3 3.8M6.5 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.4-1"/>',
  play: '<path d="M7 5l12 7-12 7z" fill="currentColor"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  reset: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 5M22 9l-5 5"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  more: '<circle cx="5" cy="12" r="1.8" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.8" fill="currentColor" stroke="none"/>',
  fill: '<rect x="4" y="4" width="16" height="16" rx="2" fill="currentColor" fill-opacity=".35"/>',
  border: '<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 2.6"/>',
  radius: '<path d="M4 20V11a7 7 0 0 1 7-7h9"/>',
  opacity: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
  shadow: '<rect x="4" y="4" width="12" height="12" rx="2"/><path d="M20 8v10a2 2 0 0 1-2 2H8"/>',
  color: '<path d="M5 19L12 5l7 14M8 14h8"/>',
  bigger: '<path d="M3 19l5-12 5 12M4.8 15h6.4"/><path d="M16 10h6M19 7v6"/>',
  smaller: '<path d="M3 19l5-12 5 12M4.8 15h6.4"/><path d="M16 10h6"/>',
  bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
  dup: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M14 11v6M11 14h6"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  wave: '<path d="M2 12c3-6 5-6 8 0s5 6 8 0 3-4 4-4"/>',
  check2: '<path d="M4 12l5 5L20 6"/><circle cx="12" cy="12" r="10" opacity=".25"/>',
  hot: '<circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="12" r="8"/>'
};
function icon(name) { return '<svg class="se-ic" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>'; }
SE.icon = icon;

var ui, puck, fanEl, toastBox, fanStack = [], peekTimer = null, idleTimer = null, isFull = false;
var cardsOpen = {}, cardZ = 10;

/* ---------- 알림 띠 ---------- */
function toast(msg, ms) {
  var t = mk('div', 'se-toast'); t.textContent = msg; t.setAttribute('role', 'status');
  toastBox.appendChild(t);
  requestAnimationFrame(function () { t.classList.add('on'); });
  setTimeout(function () { t.classList.remove('on'); setTimeout(function () { t.remove(); }, 300); }, ms || 2200);
}
SE.toast = toast;

/* ---------- 확인 창 ---------- */
function confirmBox(msg, okLabel, cancelLabel) {
  return new Promise(function (res) {
    var wrap = mk('div', 'se-modal-back'), box = mk('div', 'se-dialog');
    box.setAttribute('role', 'alertdialog');
    box.innerHTML = '<p></p><div class="se-row se-end"><button type="button" class="se-btn" data-v="0"></button><button type="button" class="se-btn se-primary" data-v="1"></button></div>';
    box.firstChild.textContent = msg;
    box.querySelector('[data-v="0"]').textContent = cancelLabel || '그만두기';
    box.querySelector('[data-v="1"]').textContent = okLabel || '확인';
    wrap.appendChild(box); ui.appendChild(wrap);
    var done = function (v) { wrap.remove(); D.removeEventListener('keydown', key, true); res(v); };
    var key = function (e) { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); done(false); } else if (e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); done(true); } };
    D.addEventListener('keydown', key, true);
    box.addEventListener('click', function (e) { var b = e.target.closest('[data-v]'); if (b) done(b.getAttribute('data-v') === '1'); });
    wrap.addEventListener('click', function (e) { if (e.target === wrap) done(false); });
    box.querySelector('.se-primary').focus();
  });
}
SE.confirm = confirmBox;

/* ---------- 떠 있는 카드 ---------- */
function card(id, title, body, opt) {
  opt = opt || {};
  var c = cardsOpen[id];
  if (c) { c.remove(); delete cardsOpen[id]; if (!opt.keep) { emit('cardclose', id); return null; } }
  c = mk('section', 'se-card ' + (opt.cls || ''));
  c.setAttribute('data-card', id);
  c.innerHTML = '<header class="se-card-h"><b></b><button type="button" class="se-x" aria-label="닫기">' + icon('close') + '</button></header><div class="se-card-b"></div>';
  c.querySelector('b').textContent = title;
  var b = c.querySelector('.se-card-b');
  if (typeof body === 'string') b.innerHTML = body; else if (body) b.appendChild(body);
  ui.appendChild(c);
  cardsOpen[id] = c;
  placeCard(c, opt);
  c.querySelector('.se-x').addEventListener('click', function () { closeCard(id); });
  dragBy(c.querySelector('.se-card-h'), c);
  // 누른 카드를 맨 앞으로 (요소를 옮기면 클릭이 끊기므로 z-index 로)
  c.style.zIndex = ++cardZ;
  c.addEventListener('pointerdown', function () { c.style.zIndex = ++cardZ; });
  return c;
}
function closeCard(id) { var c = cardsOpen[id]; if (!c) return false; c.remove(); delete cardsOpen[id]; emit('cardclose', id); return true; }
SE.card = card; SE.closeCard = closeCard; SE.cardOpen = function (id) { return cardsOpen[id] || null; };
function placeCard(c, opt) {
  var w = c.offsetWidth, h = c.offsetHeight, m = 20, vw = W.innerWidth, vh = W.innerHeight - (editing ? bottomSpace : 0);
  if (opt.center) { c.style.left = Math.max(m, (vw - w) / 2) + 'px'; c.style.top = Math.max(m, (vh - h) / 2) + 'px'; return; }
  // 구석 단추와 필기 캡슐이 있는 줄은 비워 두고 그 위(아래)에 놓는다
  var cr = settings.corner, left = cr[1] === 'l' ? m : vw - w - m, top = cr[0] === 'b' ? vh - h - 100 : 100;
  var n = Object.keys(cardsOpen).length - 1;
  left += (cr[1] === 'l' ? 1 : -1) * n * 24; top += (cr[0] === 'b' ? -1 : 1) * n * 24;
  c.style.left = clamp(left, m, vw - w - m) + 'px'; c.style.top = clamp(top, m, vh - h - m) + 'px';
}
function dragBy(handle, box) {
  handle.addEventListener('pointerdown', function (e) {
    if (e.target.closest('button,input,select,textarea')) return;
    var sx = e.clientX, sy = e.clientY, l = box.offsetLeft, t = box.offsetTop;
    handle.setPointerCapture(e.pointerId);
    var mv = function (ev) { box.style.left = clamp(l + ev.clientX - sx, 0, W.innerWidth - 60) + 'px'; box.style.top = clamp(t + ev.clientY - sy, 0, W.innerHeight - 40) + 'px'; };
    var up = function () { handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', up); };
    handle.addEventListener('pointermove', mv); handle.addEventListener('pointerup', up);
  });
}

/* ---------- 구석 단추와 부채꼴 ---------- */
function corner() {
  var cr = settings.corner, s = 64, m = 22;
  var x = cr[1] === 'l' ? m + s / 2 : W.innerWidth - m - s / 2;
  var y = cr[0] === 'b' ? W.innerHeight - m - s / 2 : m + s / 2;
  if (editing && cr[0] === 'b') y -= bottomSpace - 6;
  return { x: x, y: y };
}
function placePuck() {
  var p = corner();
  puck.style.left = (p.x - 32) + 'px'; puck.style.top = (p.y - 32) + 'px';
  ui.setAttribute('data-corner', settings.corner);
  emit('puckmoved', p);
}
function rootFan() { return editing ? (SE.editFan ? SE.editFan() : []) : presentFan(); }
function presentFan() {
  return [
    { label: '이동', icon: 'move', sub: function () {
      return [
        { label: '처음', icon: 'first', act: function () { go(0); } },
        { label: '끝', icon: 'last', act: function () { go(slides.length - 1); } },
        { label: '번호로', icon: 'hash', act: openGoto },
        { label: '목차', icon: 'list', act: openToc },
        { label: '썸네일', icon: 'grid', act: openGrid },
        { label: skipHidden ? '숨긴 장 보이기' : '숨긴 장 건너뛰기', icon: 'skip', on: skipHidden, act: function () { SE.setSkipHidden(!skipHidden); toast(skipHidden ? '숨긴 장을 건너뜁니다' : '숨긴 장도 보여 줍니다'); } }
      ];
    } },
    { label: '필기', icon: 'pen', act: function () { SE.ink.setTool(SE.ink.lastTool || 'pen'); } },
    { label: '발표 도구', icon: 'timer', sub: function () {
      return [
        { label: '타이머', icon: 'timer', act: function () { SE.tools.timer(); } },
        { label: '뽑기', icon: 'pick', act: function () { SE.tools.pick(); } },
        { label: '색종이', icon: 'confetti', act: function () { SE.confetti(); } },
        { label: '검은 화면', icon: 'black', act: function () { SE.tools.cover('black'); } },
        { label: '흰 화면', icon: 'white', act: function () { SE.tools.cover('white'); } },
        { label: '메모', icon: 'notes', act: toggleNotes },
        { label: '발표자 보기', icon: 'presenter', act: function () { SE.tools.presenter(); } }
      ];
    } },
    { label: '칠판', icon: 'board', act: function () { SE.ink.board(true); } },
    { label: '편집', icon: 'edit', act: function () { SE.edit.toggle(true); } },
    { label: '설정', icon: 'gear', act: openSettings }
  ];
}
function openFan(items, sub) {
  if (!items) items = rootFan();
  if (sub) items = [{ label: '뒤로', icon: 'back', back: true }].concat(items);
  fanEl.innerHTML = '';
  fanEl.hidden = false;
  var p = corner(), cr = settings.corner, n = items.length;
  var a0 = cr === 'bl' ? -90 : cr === 'br' ? -90 : 90, a1 = cr === 'bl' ? 0 : cr === 'br' ? -180 : cr === 'tl' ? 0 : 180;
  var R = n <= 6 ? 165 : 165 + (n - 6) * 26;
  items.forEach(function (it, i) {
    var a = (a0 + (a1 - a0) * (n === 1 ? 0 : i / (n - 1))) * Math.PI / 180;
    var x = Math.cos(a), y = Math.sin(a);
    var b = mk('button', 'se-fan-i' + (it.on ? ' on' : '') + (it.back ? ' back' : ''));
    b.type = 'button';
    b.innerHTML = icon(it.icon) + '<span class="se-fan-l"></span>';
    b.querySelector('.se-fan-l').textContent = it.label;
    b.setAttribute('aria-label', it.label + (it.key ? ' (' + it.key + ')' : ''));
    b.style.left = (p.x - 28) + 'px'; b.style.top = (p.y - 28) + 'px';
    b.style.setProperty('--tx', (x * R) + 'px'); b.style.setProperty('--ty', (y * R) + 'px');
    b.style.setProperty('--lx', (x * 54) + 'px'); b.style.setProperty('--ly', (y * 50) + 'px');
    b.style.setProperty('--i', i);
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      if (it.back) { fanStack.pop(); var prev = fanStack[fanStack.length - 1]; openFan(prev ? prev() : null, !!prev); return; }
      if (it.sub) { fanStack.push(it.sub); openFan(it.sub(), true); return; }
      closeFan();
      it.act && it.act();
    });
    fanEl.appendChild(b);
  });
  ui.classList.add('se-fan-open');
  requestAnimationFrame(function () { requestAnimationFrame(function () { fanEl.classList.add('on'); }); });
}
function closeFan() { if (!ui.classList.contains('se-fan-open')) return false; ui.classList.remove('se-fan-open'); fanEl.classList.remove('on'); fanEl.hidden = true; fanStack = []; return true; }
SE.openFan = openFan; SE.closeFan = closeFan;

function setupPuck() {
  puck = mk('button', 'se-puck');
  puck.type = 'button';
  puck.setAttribute('aria-label', '도구 펼치기');
  puck.innerHTML = icon('plus');
  ui.appendChild(puck);
  var down = null, moved = false;
  puck.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY }; moved = false; puck.setPointerCapture(e.pointerId); });
  puck.addEventListener('pointermove', function (e) {
    if (!down) return;
    if (!moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8) return;
    moved = true; closeFan();
    puck.style.left = (e.clientX - 32) + 'px'; puck.style.top = (e.clientY - 32) + 'px';
    puck.classList.add('dragging');
  });
  puck.addEventListener('pointerup', function (e) {
    if (!down) return;
    down = null; puck.classList.remove('dragging');
    if (moved) {
      settings.corner = (e.clientY < W.innerHeight / 2 ? 't' : 'b') + (e.clientX < W.innerWidth / 2 ? 'l' : 'r');
      saveSettings(); placePuck(); emit('settings');
      return;
    }
    puck.blur();
    if (SE.ink && SE.ink.tool && !ui.classList.contains('se-fan-open')) { SE.ink.setTool(null); return; }
    if (ui.classList.contains('se-fan-open')) closeFan(); else openFan();
  });
  D.addEventListener('pointerdown', function (e) { if (ui.classList.contains('se-fan-open') && !e.target.closest('.se-fan-i,.se-puck')) closeFan(); }, true);
}

/* ---------- 쉬고 있을 때 · 전체 화면 ---------- */
var fullMq = W.matchMedia ? W.matchMedia('(display-mode: fullscreen)') : null;
function toggleFull() {
  var d = D, el = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  else { var req = el.requestFullscreen || el.webkitRequestFullscreen; if (req) { var p = req.call(el); if (p && p.catch) p.catch(function () { }); } }
}
SE.toggleFull = toggleFull;
function syncFull() {
  isFull = !!(D.fullscreenElement || D.webkitFullscreenElement || (fullMq && fullMq.matches));
  rt.cls(D.body, 'se-full', isFull);
  if (isFull) rt.cls(D.body, 'se-peek', false);
  setTimeout(function () { fit(); placePuck(); }, 60);
}
function wake(e) {
  rt.cls(D.body, 'se-idle', false);
  rt.cls(D.body, 'se-awake', true);
  clearTimeout(idleTimer);
  idleTimer = setTimeout(function () { rt.cls(D.body, 'se-awake', false); if (isFull && !(SE.ink && SE.ink.tool)) rt.cls(D.body, 'se-idle', true); }, isFull ? 2000 : 3000);
  if (isFull && e && e.clientX != null) {
    var m = e.pointerType === 'touch' ? 70 : 48, x = e.clientX, y = e.clientY;
    if (x < m || y < m || x > W.innerWidth - m || y > W.innerHeight - m) peek();
  }
}
function peek() {
  rt.cls(D.body, 'se-peek', true);
  clearTimeout(peekTimer);
  peekTimer = setTimeout(function () { if (!ui.classList.contains('se-fan-open') && !ui.matches(':hover')) rt.cls(D.body, 'se-peek', false); else peek(); }, 2500);
}

/* ---------- 번호로 이동 · 목차 · 썸네일 ---------- */
function openGoto() {
  var c = card('goto', '번호로 이동', '<div class="se-row"><input id="se-goto-n" class="se-input" type="number" min="1" max="' + slides.length + '" inputmode="numeric" placeholder="1–' + slides.length + '"><button type="button" class="se-btn se-primary" data-go>이동</button></div><div class="se-keypad"></div>');
  if (!c) return;
  var inp = c.querySelector('input'), pad = c.querySelector('.se-keypad');
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '←', '0', 'C'].forEach(function (k) {
    var b = mk('button', 'se-key'); b.type = 'button'; b.textContent = k;
    b.addEventListener('click', function () { inp.value = k === '←' ? inp.value.slice(0, -1) : k === 'C' ? '' : (inp.value + k).slice(0, 3); });
    pad.appendChild(b);
  });
  var goNow = function () { var n = parseInt(inp.value, 10); if (n >= 1 && n <= slides.length) { go(n - 1); closeCard('goto'); } else toast('1부터 ' + slides.length + ' 사이의 번호를 넣어 주세요'); };
  c.querySelector('[data-go]').addEventListener('click', goNow);
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') goNow(); });
  inp.focus();
}
function titleOf(s) {
  var t = s.getAttribute('data-title');
  if (!t) { var h = $('h1,h2,h3,.title,.headline,.se-text', s); t = h ? h.textContent : s.textContent; }
  t = (t || '').replace(/\s+/g, ' ').trim();
  return t.length > 36 ? t.slice(0, 35) + '…' : (t || '(빈 장)');
}
SE.titleOf = titleOf;
function sectionOf(s) { var p = s.getAttribute('data-section') || s.getAttribute('data-part') || ''; return cfg.sections[p] || p; }
function openToc() {
  var box = mk('div', 'se-toc'), last = null;
  slides.forEach(function (s, i) {
    var sec = sectionOf(s);
    if (sec && sec !== last) { var h = mk('p', 'se-toc-sec'); h.textContent = sec; box.appendChild(h); last = sec; }
    var b = mk('button', 'se-toc-i' + (i === cur ? ' cur' : '') + (isHidden(i) ? ' hid' : ''));
    b.type = 'button';
    b.innerHTML = '<span class="n">' + (i + 1) + '</span><span class="t"></span>';
    b.querySelector('.t').textContent = titleOf(s);
    b.addEventListener('click', function () { go(i); closeCard('toc'); });
    box.appendChild(b);
  });
  var c = card('toc', '목차', box, { cls: 'se-card-tall' });
  if (c) { var curB = $('.se-toc-i.cur', c); if (curB) curB.scrollIntoView({ block: 'center' }); }
}

function thumb(s, w) {
  var f = mk('div', 'se-thumb');
  f.style.width = w + 'px'; f.style.height = (w * cfg.height / cfg.width) + 'px';
  var c = s.cloneNode(true);
  $$('[id]', c).concat([c]).forEach(function (e) { e.removeAttribute('id'); });
  ['active', 'leaving', 'play'].forEach(function (k) { c.classList.remove(k); });
  $$('[contenteditable]', c).forEach(function (e) { e.removeAttribute('contenteditable'); });
  $$('.se-spot,.se-pop', c).forEach(function (e) { e.remove(); });
  c.classList.add('se-thumb-slide');
  c.style.transform = 'scale(' + (w / cfg.width) + ')';
  f.appendChild(c);
  return f;
}
SE.thumb = thumb;
var gridEl = null;
function openGrid() {
  if (gridEl) { closeGrid(); return; }
  gridEl = mk('div', 'se-grid');
  gridEl.innerHTML = '<header><b>모든 장</b><span>누르면 그 장으로 이동 · Esc로 닫기' + (slides.some(function (s, i) { return isHidden(i); }) ? ' · 흐린 장은 ' + esc(cfg.hiddenLabel) + ' 장' : '') + '</span><button type="button" class="se-x" aria-label="닫기">' + icon('close') + '</button></header><div class="se-grid-in"></div>';
  var inner = gridEl.querySelector('.se-grid-in');
  var io = 'IntersectionObserver' in W ? new IntersectionObserver(function (list) {
    list.forEach(function (en) { if (en.isIntersecting && !en.target.__done) { en.target.__done = true; en.target.insertBefore(thumb(slides[+en.target.getAttribute('data-i')], 216), en.target.firstChild); } });
  }, { root: gridEl }) : null;
  slides.forEach(function (s, i) {
    var b = mk('button', 'se-grid-i' + (i === cur ? ' cur' : '') + (isHidden(i) ? ' hid' : ''));
    b.type = 'button'; b.setAttribute('data-i', i);
    b.innerHTML = '<span class="n">' + (i + 1) + '</span>';
    b.setAttribute('aria-label', (i + 1) + '. ' + titleOf(s));
    b.addEventListener('click', function () { closeGrid(); go(i); });
    inner.appendChild(b);
    if (io) io.observe(b); else { b.__done = true; b.insertBefore(thumb(s, 216), b.firstChild); }
  });
  gridEl.querySelector('.se-x').addEventListener('click', closeGrid);
  ui.appendChild(gridEl);
  var c = $('.se-grid-i.cur', gridEl); if (c) c.scrollIntoView({ block: 'center' });
}
function closeGrid() { if (!gridEl) return false; gridEl.remove(); gridEl = null; return true; }
SE.openGrid = openGrid;

/* ---------- 교사 메모 ---------- */
var notesEl = null, notesOpen = false;
function toggleNotes(force) {
  notesOpen = force === undefined ? !notesOpen : !!force;
  notesEl.hidden = !notesOpen;
  renderNotes();
}
SE.toggleNotes = toggleNotes;
function renderNotes() {
  if (!notesOpen || cur < 0) return;
  var s = slides[cur], a = $(':scope > aside.notes', s);
  notesEl.innerHTML = '<p class="se-notes-h"></p><div class="se-notes-b"></div>';
  notesEl.firstChild.textContent = (cur + 1) + ' · ' + titleOf(s) + (editing ? ' — 메모를 고칠 수 있어요' : '');
  var b = notesEl.lastChild;
  if (a && a.textContent.trim()) b.innerHTML = a.innerHTML; else b.innerHTML = editing ? '' : '<span class="none">메모 없음</span>';
  if (editing) {
    b.setAttribute('contenteditable', 'true');
    b.addEventListener('focus', function () { b.__tok = SE.edit.begin(s); });
    b.addEventListener('blur', function () {
      var aside = $(':scope > aside.notes', s);
      var html = b.innerHTML.replace(/<br\s*\/?>$/, '').trim();
      if (!aside && html) { aside = mk('aside', 'notes'); s.appendChild(aside); }
      if (aside) { if (html) aside.innerHTML = html; else aside.remove(); }
      if (b.__tok) SE.edit.commit(b.__tok);
    });
  }
}

/* ---------- 설정 ---------- */
function seg(name, opts, val) {
  return '<div class="se-seg" data-set="' + name + '">' + opts.map(function (o) {
    return '<button type="button" data-v="' + o[0] + '"' + (String(o[0]) === String(val) ? ' aria-pressed="true"' : ' aria-pressed="false"') + '>' + o[1] + '</button>';
  }).join('') + '</div>';
}
function openSettings() {
  var html =
    '<p class="se-lab">모션 강도</p>' + seg('motion', [[0, '끄기'], [1, '차분'], [2, '기본'], [3, '화려']], settings.motion) +
    (osReduce && osReduce.matches ? '<p class="se-hint">컴퓨터의 \'동작 줄이기\'가 켜져 있어 처음에는 모션을 꺼 둡니다.</p>' : '') +
    '<p class="se-lab">모션 속도</p>' + seg('speed', [[0.7, '느리게'], [1, '보통'], [1.4, '빠르게']], settings.speed) +
    '<p class="se-lab">테마</p>' + seg('theme', [['default', '기본'], ['dark', '어둡게']], settings.theme) +
    '<p class="se-lab">도구 위치</p>' + seg('corner', [['tl', '왼쪽 위'], ['tr', '오른쪽 위'], ['bl', '왼쪽 아래'], ['br', '오른쪽 아래']], settings.corner) +
    '<p class="se-lab">효과음 (타이머 · 뽑기)</p>' + seg('sound', [['true', '켬'], ['false', '끔']], String(settings.sound)) +
    '<p class="se-lab">숨긴 장</p>' + seg('skip', [['true', '건너뛰기'], ['false', '보여 주기']], String(skipHidden)) +
    '<div class="se-row se-gap"><button type="button" class="se-btn" data-a="full">' + icon('full') + '전체 화면 (F)</button><button type="button" class="se-btn" data-a="help">' + icon('help') + '단축키 (?)</button></div>';
  var c = card('settings', '설정', html);
  if (!c) return;
  c.addEventListener('click', function (e) {
    var b = e.target.closest('.se-seg button');
    if (b) {
      var name = b.parentNode.getAttribute('data-set'), v = b.getAttribute('data-v');
      if (name === 'motion') SE.setMotion(+v);
      else if (name === 'speed') SE.setSpeed(+v);
      else if (name === 'theme') SE.setTheme(v);
      else if (name === 'corner') { settings.corner = v; saveSettings(); placePuck(); }
      else if (name === 'sound') { settings.sound = v === 'true'; saveSettings(); }
      else if (name === 'skip') SE.setSkipHidden(v === 'true');
      $$('button', b.parentNode).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      return;
    }
    var a = e.target.closest('[data-a]');
    if (a && a.getAttribute('data-a') === 'full') toggleFull();
    if (a && a.getAttribute('data-a') === 'help') openHelp();
  });
}
SE.openSettings = openSettings;

/* ---------- 단축키 목록 (?) ---------- */
var HELP = [
  ['이동', [['→ ↓ Space PageDown Enter', '다음 (남은 단계 먼저)'], ['← ↑ PageUp Backspace', '이전'], ['Home / End', '처음 / 끝'], ['숫자 → Enter', '그 번호의 장'], ['G', '목차'], ['O', '썸네일'], ['S', '숨긴 장 건너뛰기 켜기·끄기'], ['클릭', '오른쪽 2/3 다음 · 왼쪽 1/3 이전'], ['스와이프', '좌우로 장 이동']]],
  ['필기', [['P', '펜 (다시 누르면 끄기)'], ['H', '형광펜'], ['X', '지우개 (다시 누르면 획 ↔ 부분)'], ['L', '레이저 포인터'], ['Shift + 1~6', '색 (빨강·파랑·초록·노랑·검정·흰색)'], ['[ / ]', '굵기 · 지우개 크기'], ['Ctrl + Z / Ctrl + Y', '되돌리기 / 다시 하기'], ['Delete', '이 장 지우기'], ['Shift + Delete', '모든 장 지우기'], ['Esc', '필기 끝']]],
  ['발표 도구', [['K', '칠판 (← → 칠판 장 넘기기)'], ['T', '타이머'], ['R', '랜덤 뽑기'], ['C', '색종이'], ['B 또는 .', '검은 화면'], ['W', '흰 화면'], ['V', '발표자 보기'], ['N', '교사 메모']]],
  ['화면', [['F', '전체 화면'], ['M', '모션 강도 바꾸기 (끄기 → 차분 → 기본 → 화려)'], ['E', '편집 모드'], ['?', '이 목록'], ['Esc', '열린 도구 닫기']]],
  ['편집 모드', [['클릭 / Shift + 클릭', '요소 선택 / 여러 개 선택'], ['한 번 더 클릭', '안쪽 요소 선택'], ['두 번 클릭 · Enter', '글자 고치기 (Esc로 끝)'], ['끌기', '이동 · 크기 · 회전 (Shift: 비율 · 15° · 한 방향)'], ['화살표 / Shift + 화살표', '1px / 10px 옮기기'], ['Ctrl + C / X / V / D', '복사 / 잘라내기 / 붙여넣기 / 복제'], ['Delete', '삭제'], ['Ctrl + ] / [', '앞으로 / 뒤로 (Shift: 맨 앞 / 맨 뒤)'], ['Ctrl + Z / Ctrl + Y', '되돌리기 / 다시 하기'], ['Ctrl + S', '파일로 저장'], ['PageUp / PageDown', '이전 장 / 다음 장'], ['E 또는 Esc 두 번', '편집 끝']]]
];
function openHelp() {
  if (closeCard('help')) return;
  var html = '<div class="se-help">' + HELP.map(function (g) {
    return '<section><h4>' + g[0] + '</h4><dl>' + g[1].map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl></section>';
  }).join('') + '</div><p class="se-hint">한글 자판 상태에서도 그대로 동작합니다. 모든 기능은 구석의 단추에서도 쓸 수 있습니다.</p>';
  card('help', '단축키', html, { cls: 'se-card-wide', center: true });
}
SE.openHelp = openHelp;

/* ---------- 크게 보기 ---------- */
SE.enlarge = function (el) {
  var back = mk('div', 'se-enlarge'), c = el.cloneNode(true);
  $$('[id]', c).forEach(function (e) { e.removeAttribute('id'); });
  c.removeAttribute('data-enlarge'); c.classList.remove('se-enl');
  var r = el.getBoundingClientRect(), k = Math.min(W.innerWidth * .9 / r.width, W.innerHeight * .9 / r.height);
  var inner = mk('div', 'se-enlarge-in');
  inner.style.width = r.width / scale() + 'px'; inner.style.height = r.height / scale() + 'px';
  inner.style.transform = 'translate(-50%,-50%) scale(' + (k * scale()) + ')';
  c.style.cssText += ';width:100%;height:100%;margin:0;translate:none;transform:none';
  inner.appendChild(c); back.appendChild(inner); ui.appendChild(back);
  if (level()) back.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
  back.addEventListener('click', function () { back.remove(); });
};

/* ---------- 키 ---------- */
SE.on('key', function (e) {
  var code = e.code, sh = e.shiftKey;
  if (e.key === 'Escape') {
    if (closeFan() || closeGrid()) return true;
    var ids = Object.keys(cardsOpen); if (ids.length) { closeCard(ids[ids.length - 1]); return true; }
    if (notesOpen) { toggleNotes(false); return true; }
    return false;
  }
  // 썸네일 목록이 열려 있으면 장을 넘기는 키는 먹지 않는다
  if (gridEl && /^(Arrow|Page|Space|Enter|Home|End|Backspace|Digit|Numpad)/.test(code)) return true;
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  if (code === 'Slash' && sh || e.key === '?') { openHelp(); return true; }
  if (sh) return false;
  if (code === 'KeyF') { toggleFull(); return true; }
  if (code === 'KeyG') { openToc(); return true; }
  if (code === 'KeyO') { if (!closeGrid()) openGrid(); return true; }
  if (code === 'KeyN') { toggleNotes(); return true; }
  if (code === 'KeyE') { SE.edit.toggle(true); return true; }
  return false;
});

inits.push(function () {
  ui = rt.node(mk('div', 'se-ui'));
  ui.id = 'se-ui';
  ui.innerHTML = '<div class="se-fan" hidden></div><div class="se-toasts"></div><div class="se-notes" hidden></div>';
  D.body.appendChild(ui);
  SE.ui = ui;
  fanEl = $('.se-fan', ui); toastBox = $('.se-toasts', ui); notesEl = $('.se-notes', ui);
  setupPuck();
  placePuck();
  W.addEventListener('resize', function () { placePuck(); });
  D.addEventListener('fullscreenchange', syncFull);
  D.addEventListener('webkitfullscreenchange', syncFull);
  if (fullMq && fullMq.addEventListener) fullMq.addEventListener('change', syncFull);
  syncFull();
  D.addEventListener('pointermove', wake, { passive: true });
  D.addEventListener('pointerdown', wake, { passive: true });
  wake();
  SE.on('enter', function () { renderNotes(); if (gridEl) { $$('.se-grid-i', gridEl).forEach(function (b) { b.classList.toggle('cur', +b.getAttribute('data-i') === cur); }); } });
  SE.on('editstart', function () { closeFan(); closeGrid(); placePuck(); renderNotes(); });
  SE.on('editend', function () { closeFan(); placePuck(); renderNotes(); });
});
SE.placePuck = function () { placePuck(); };
SE.renderNotes = function () { renderNotes(); };
