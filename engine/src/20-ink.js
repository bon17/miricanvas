/* =====================================================================
   슬라이드 엔진 · 필기 (펜 · 형광펜 · 지우개 · 레이저) 와 칠판
   획은 무대 좌표(1920×1080)로 저장해서 창 크기가 바뀌어도 자리가 그대로다.
   ===================================================================== */
var INK_COLORS = [['빨강', '#E5484D'], ['파랑', '#2F6FEB'], ['초록', '#22A06B'], ['노랑', '#F5C518'], ['검정', '#1B1B1F'], ['흰색', '#FFFFFF']];
var PEN_W = [3, 6, 12], HL_W = [18, 30, 46], ER_R = [12, 28, 64];
var ink = SE.ink = { tool: null, lastTool: 'pen', color: INK_COLORS[0][1], size: 1, eraser: 'stroke', boardOpen: false, boardPage: 0, boardPages: 1 };
var cvHl, cvPen, cvLaser, hit, capEl, boardEl, boardBar, surfaces = {}, drawing = null, laserPts = [], laserRaf = 0;

function surfKey() { return ink.boardOpen ? 'board:' + ink.boardPage : 'slide:' + (slides[cur] ? slideKey(slides[cur]) : '0'); }
function surf(k) {
  k = k || surfKey();
  if (!surfaces[k]) surfaces[k] = { strokes: store.get('se-ink:' + PATH + ':' + k, []), undo: [], redo: [] };
  return surfaces[k];
}
var saveTimers = {};
function persist(k) {
  clearTimeout(saveTimers[k]);
  saveTimers[k] = setTimeout(function () { var s = surfaces[k]; if (!s) return; if (s.strokes.length) store.set('se-ink:' + PATH + ':' + k, s.strokes); else store.del('se-ink:' + PATH + ':' + k); }, 400);
}
function setStrokes(arr, k) {
  k = k || surfKey(); var s = surf(k);
  s.undo.push(s.strokes); if (s.undo.length > 80) s.undo.shift();
  s.redo = []; s.strokes = arr; persist(k); redraw();
}

/* ---------- 그리기 ---------- */
function sizeCanvases() {
  var r = stage.getBoundingClientRect(), k = r.width / cfg.width * (W.devicePixelRatio || 1);
  [cvHl, cvPen, cvLaser].forEach(function (c) {
    var w = Math.round(cfg.width * k), h = Math.round(cfg.height * k);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    c.getContext('2d').setTransform(k, 0, 0, k, 0, 0);
  });
  redraw();
}
function pw(p) { return 0.35 + (p == null ? 0.5 : p) * 1.3; }
function drawStroke(ctx, st) {
  var p = st.p; if (!p.length) return;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = st.c; ctx.fillStyle = st.c;
  if (st.t === 'h') {
    ctx.globalAlpha = 0.42; ctx.lineWidth = st.w; ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
    for (var i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
    if (p.length === 1) ctx.lineTo(p[0][0] + .1, p[0][1]);
    ctx.stroke(); ctx.globalAlpha = 1; return;
  }
  if (p.length === 1) { ctx.beginPath(); ctx.arc(p[0][0], p[0][1], st.w * pw(p[0][2]) / 2, 0, Math.PI * 2); ctx.fill(); return; }
  for (var j = 1; j < p.length; j++) {
    ctx.lineWidth = st.w * pw((p[j - 1][2] + p[j][2]) / 2);
    ctx.beginPath(); ctx.moveTo(p[j - 1][0], p[j - 1][1]); ctx.lineTo(p[j][0], p[j][1]); ctx.stroke();
  }
}
function clearCv(c) { var x = c.getContext('2d'); x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height); x.restore(); }
function redraw() {
  if (!cvPen) return;
  clearCv(cvHl); clearCv(cvPen);
  if (editing) return;
  var list = surf().strokes.concat(drawing && drawing.st ? [drawing.st] : []);
  var h = cvHl.getContext('2d'), p = cvPen.getContext('2d');
  list.forEach(function (st) { drawStroke(st.t === 'h' ? h : p, st); });
}
SE.redrawInk = redraw;

/* ---------- 지우개 ---------- */
function near(st, x, y, r) {
  var rr = (r + st.w / 2) * (r + st.w / 2);
  for (var i = 0; i < st.p.length; i++) { var dx = st.p[i][0] - x, dy = st.p[i][1] - y; if (dx * dx + dy * dy <= rr) return true; }
  return false;
}
function eraseAt(x, y) {
  var r = ER_R[ink.size], s = surf(), out = [], changed = false;
  s.strokes.forEach(function (st) {
    if (!near(st, x, y, r)) { out.push(st); return; }
    changed = true;
    if (ink.eraser === 'stroke') return;
    var seg = [], rr = (r + st.w / 3) * (r + st.w / 3);
    st.p.forEach(function (pt) {
      var dx = pt[0] - x, dy = pt[1] - y;
      if (dx * dx + dy * dy <= rr) { if (seg.length) { out.push({ t: st.t, c: st.c, w: st.w, p: seg }); seg = []; } }
      else seg.push(pt);
    });
    if (seg.length) out.push({ t: st.t, c: st.c, w: st.w, p: seg });
  });
  if (changed) { s.strokes = out; redraw(); }
}

/* ---------- 레이저 ---------- */
function laserLoop() {
  var c = cvLaser.getContext('2d'), now = performance.now();
  clearCv(cvLaser);
  laserPts = laserPts.filter(function (p) { return now - p[2] < 450; });
  for (var i = 1; i < laserPts.length; i++) {
    var a = 1 - (now - laserPts[i][2]) / 450;
    c.strokeStyle = 'rgba(255,40,40,' + (a * .55) + ')'; c.lineWidth = 10 * a + 2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(laserPts[i - 1][0], laserPts[i - 1][1]); c.lineTo(laserPts[i][0], laserPts[i][1]); c.stroke();
  }
  var last = ink.laserAt;
  if (last) {
    var g = c.createRadialGradient(last.x, last.y, 0, last.x, last.y, 26);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,40,40,1)'); g.addColorStop(1, 'rgba(255,40,40,0)');
    c.fillStyle = g; c.beginPath(); c.arc(last.x, last.y, 26, 0, Math.PI * 2); c.fill();
  }
  laserRaf = (laserPts.length || ink.laserAt) && ink.tool === 'laser' ? requestAnimationFrame(laserLoop) : 0;
  if (!laserRaf) clearCv(cvLaser);
}

/* ---------- 손가락·펜 입력 ---------- */
function onDown(e) {
  if (!ink.tool) return;
  e.preventDefault();
  hit.setPointerCapture(e.pointerId);
  var p = toStage(e.clientX, e.clientY);
  if (ink.tool === 'laser') { ink.laserAt = p; laserPts.push([p.x, p.y, performance.now()]); if (!laserRaf) laserRaf = requestAnimationFrame(laserLoop); return; }
  if (ink.tool === 'eraser') { drawing = { erase: true, before: surf().strokes, id: e.pointerId }; eraseAt(p.x, p.y); return; }
  var pr = e.pointerType === 'pen' ? e.pressure : 0.5;
  drawing = { id: e.pointerId, st: { t: ink.tool === 'hl' ? 'h' : 'p', c: ink.color, w: (ink.tool === 'hl' ? HL_W : PEN_W)[ink.size], p: [[r1(p.x), r1(p.y), pr]] } };
  redraw();
}
function r1(v) { return Math.round(v * 10) / 10; }
function onMove(e) {
  var p = toStage(e.clientX, e.clientY);
  if (ink.tool === 'laser') { ink.laserAt = p; laserPts.push([p.x, p.y, performance.now()]); if (!laserRaf) laserRaf = requestAnimationFrame(laserLoop); return; }
  if (!drawing || drawing.id !== e.pointerId) return;
  if (drawing.erase) { eraseAt(p.x, p.y); return; }
  var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  if (!evs.length) evs = [e];
  var pts = drawing.st.p, ctx = (drawing.st.t === 'h' ? cvHl : cvPen).getContext('2d');
  evs.forEach(function (ev) {
    var q = toStage(ev.clientX, ev.clientY), last = pts[pts.length - 1];
    var pr = ev.pointerType === 'pen' ? ev.pressure : 0.5, d = Math.hypot(q.x - last[0], q.y - last[1]);
    if (d < 1) return;
    var n = Math.ceil(d / 3);
    for (var i = 1; i <= n; i++) {
      var np = [r1(last[0] + (q.x - last[0]) * i / n), r1(last[1] + (q.y - last[1]) * i / n), last[2] + (pr - last[2]) * i / n];
      pts.push(np);
      if (drawing.st.t === 'p') drawStroke(ctx, { t: 'p', c: drawing.st.c, w: drawing.st.w, p: [pts[pts.length - 2], np] });
    }
  });
  if (drawing.st.t === 'h') redraw();
}
function onUp(e) {
  if (ink.tool === 'laser') { ink.laserAt = null; return; }
  if (!drawing || drawing.id !== e.pointerId) return;
  var d = drawing; drawing = null;
  if (d.erase) {
    var s = surf(), now = s.strokes;
    if (now !== d.before) { s.strokes = d.before; setStrokes(now); }
    return;
  }
  setStrokes(surf().strokes.concat([d.st]));
}

/* ---------- 도구 바꾸기 ---------- */
ink.setTool = function (t) {
  if (editing) return;
  if (t && t === ink.tool && t !== 'eraser') t = null;
  else if (t === 'eraser' && ink.tool === 'eraser') { ink.eraser = ink.eraser === 'stroke' ? 'part' : 'stroke'; toast(ink.eraser === 'stroke' ? '지우개: 닿은 획 전체' : '지우개: 닿은 부분만'); }
  ink.tool = t || null;
  if (t) ink.lastTool = t;
  hit.hidden = !ink.tool;
  hit.setAttribute('data-tool', ink.tool || '');
  rt.cls(D.body, 'se-inking', !!ink.tool);
  if (!ink.tool) { ink.laserAt = null; }
  renderCap();
};
ink.setColor = function (c) { ink.color = c; if (!ink.tool || ink.tool === 'eraser' || ink.tool === 'laser') ink.setTool('pen'); renderCap(); };
ink.setSize = function (i) { ink.size = clamp(i, 0, 2); renderCap(); };
ink.undo = function () { var s = surf(); if (!s.undo.length) return false; s.redo.push(s.strokes); s.strokes = s.undo.pop(); persist(surfKey()); redraw(); return true; };
ink.redo = function () { var s = surf(); if (!s.redo.length) return false; s.undo.push(s.strokes); s.strokes = s.redo.pop(); persist(surfKey()); redraw(); return true; };
ink.clear = function () { if (surf().strokes.length) setStrokes([]); };
ink.clearAll = function () {
  return confirmBox(ink.boardOpen ? '칠판의 모든 장에 쓴 것을 지울까요?' : '모든 장에 쓴 필기를 지울까요? 되돌릴 수 없습니다.', '모두 지우기').then(function (ok) {
    if (!ok) return;
    var pre = ink.boardOpen ? 'board:' : 'slide:';
    Object.keys(surfaces).forEach(function (k) { if (k.indexOf(pre) === 0) { surfaces[k] = { strokes: [], undo: [], redo: [] }; store.del('se-ink:' + PATH + ':' + k); } });
    try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf('se-ink:' + PATH + ':' + pre) === 0) localStorage.removeItem(k); }); } catch (e) { /* 무시 */ }
    redraw(); toast('모두 지웠습니다');
  });
};
ink.strokes = function () { return surf().strokes; };

/* ---------- 필기 캡슐 (단추 옆) ---------- */
function renderCap() {
  if (!capEl) return;
  capEl.hidden = !ink.tool;
  if (!ink.tool) { puck.style.removeProperty('--puck-c'); puck.classList.remove('se-pen'); puck.innerHTML = icon('plus'); return; }
  puck.classList.add('se-pen');
  var pc = ink.tool === 'laser' ? '#FF2828' : ink.tool === 'eraser' ? '#EDEFE6' : ink.color;
  puck.style.setProperty('--puck-c', pc);
  puck.style.setProperty('--puck-fg', /^#(FFFFFF|F5C518|EDEFE6)$/i.test(pc) ? '#1F2D27' : '#FFFFFF');
  puck.innerHTML = icon(ink.tool === 'hl' ? 'marker' : ink.tool === 'eraser' ? 'eraser' : ink.tool === 'laser' ? 'laser' : 'pen');
  var tools = [['pen', 'pen', '펜 (P)'], ['hl', 'marker', '형광펜 (H)'], ['eraser', 'eraser', '지우개 (X)'], ['laser', 'laser', '레이저 (L)']];
  var sizes = ink.tool === 'eraser' ? ER_R : ink.tool === 'hl' ? HL_W : PEN_W;
  capEl.innerHTML =
    tools.map(function (t) { return '<button type="button" class="se-t' + (ink.tool === t[0] ? ' on' : '') + '" data-tool="' + t[0] + '" aria-label="' + t[2] + '">' + icon(t[1]) + '</button>'; }).join('') +
    (ink.tool === 'eraser' ? '<button type="button" class="se-mode" data-er>' + (ink.eraser === 'stroke' ? '획' : '부분') + '</button>' : '') +
    '<i class="se-div"></i>' +
    INK_COLORS.map(function (c, i) { return '<button type="button" class="se-dot' + (ink.color === c[1] ? ' on' : '') + '" data-color="' + c[1] + '" style="--c:' + c[1] + '" aria-label="' + c[0] + ' (Shift+' + (i + 1) + ')"></button>'; }).join('') +
    '<i class="se-div"></i>' +
    sizes.map(function (w, i) { return '<button type="button" class="se-sz' + (ink.size === i ? ' on' : '') + '" data-size="' + i + '" aria-label="굵기 ' + (i + 1) + '"><i style="--w:' + [6, 11, 17][i] + 'px"></i></button>'; }).join('') +
    '<i class="se-div"></i>' +
    '<button type="button" class="se-t" data-a="undo" aria-label="되돌리기 (Ctrl+Z)">' + icon('undo') + '</button>' +
    '<button type="button" class="se-t" data-a="redo" aria-label="다시 하기 (Ctrl+Y)">' + icon('redo') + '</button>' +
    '<button type="button" class="se-t" data-a="clear" aria-label="이 장 지우기 (Delete)">' + icon('trash') + '</button>' +
    '<button type="button" class="se-t" data-a="clearall" aria-label="모든 장 지우기 (Shift+Delete)">' + icon('trashAll') + '</button>' +
    '<button type="button" class="se-t" data-a="off" aria-label="필기 끝 (Esc)">' + icon('close') + '</button>';
  placeCap();
}
function placeCap() {
  if (!capEl || capEl.hidden) return;
  var p = corner(), cr = settings.corner;
  capEl.style.top = (p.y - capEl.offsetHeight / 2) + 'px';
  if (cr[1] === 'l') { capEl.style.left = (p.x + 44) + 'px'; capEl.style.right = 'auto'; }
  else { capEl.style.left = 'auto'; capEl.style.right = (W.innerWidth - p.x + 44) + 'px'; }
}

/* ---------- 칠판 ---------- */
ink.board = function (open) {
  if (open === undefined) open = !ink.boardOpen;
  if (editing) return;
  ink.boardOpen = open;
  boardEl.hidden = !open; boardBar.hidden = !open;
  if (open) {
    ink.boardPages = Math.max(1, store.get('se-board-n:' + PATH, 1));
    ink.boardPage = clamp(ink.boardPage, 0, ink.boardPages - 1);
    if (!ink.tool) { ink.prevColor = ink.color; if (ink.color === '#1B1B1F') ink.color = '#FFFFFF'; ink.setTool('pen'); }
  } else if (ink.prevColor) { ink.color = ink.prevColor; ink.prevColor = null; ink.setTool(null); }
  renderBoardBar(); redraw();
};
function renderBoardBar() {
  boardBar.innerHTML = '<b>칠판 ' + (ink.boardPage + 1) + ' / ' + ink.boardPages + '</b>' +
    '<button type="button" data-b="prev" aria-label="이전 칠판 (←)">' + icon('back') + '</button>' +
    '<button type="button" data-b="next" aria-label="다음 칠판 (→)">' + icon('move') + '</button>' +
    '<button type="button" data-b="add">' + icon('plus') + '새 칠판</button>' +
    '<button type="button" data-b="clear">' + icon('trash') + '이 칠판 지우기</button>' +
    '<button type="button" data-b="close">' + icon('close') + '닫기 (K)</button>';
}
ink.boardGo = function (d) {
  if (d === 'add') { ink.boardPages++; store.set('se-board-n:' + PATH, ink.boardPages); ink.boardPage = ink.boardPages - 1; }
  else ink.boardPage = clamp(ink.boardPage + d, 0, ink.boardPages - 1);
  renderBoardBar(); redraw();
};

/* ---------- 키 ---------- */
SE.on('key', function (e) {
  var code = e.code, ctrl = e.ctrlKey || e.metaKey, sh = e.shiftKey;
  if (ctrl && code === 'KeyZ' && !sh) { ink.undo(); return true; }
  if (ctrl && (code === 'KeyY' || (sh && code === 'KeyZ'))) { ink.redo(); return true; }
  if (ctrl || e.altKey) return false;
  if (ink.boardOpen && (code === 'ArrowRight' || code === 'ArrowLeft' || code === 'PageDown' || code === 'PageUp')) { ink.boardGo(code === 'ArrowRight' || code === 'PageDown' ? 1 : -1); return true; }
  if (e.key === 'Escape') { if (ink.boardOpen) { ink.board(false); return true; } if (ink.tool) { ink.setTool(null); return true; } return false; }
  var d = /^Digit([1-6])$/.exec(code);
  if (d && sh) { ink.setColor(INK_COLORS[+d[1] - 1][1]); return true; }
  if (code === 'Delete') { if (sh) ink.clearAll(); else ink.clear(); return true; }
  if (sh) return false;
  if (code === 'KeyP') { ink.setTool('pen'); return true; }
  if (code === 'KeyH') { ink.setTool('hl'); return true; }
  if (code === 'KeyX') { ink.setTool('eraser'); return true; }
  if (code === 'KeyL') { ink.setTool('laser'); return true; }
  if (code === 'KeyK') { ink.board(); return true; }
  if (code === 'BracketLeft') { ink.setSize(ink.size - 1); return true; }
  if (code === 'BracketRight') { ink.setSize(ink.size + 1); return true; }
  return false;
});

inits.push(function () {
  cvHl = rt.node(mk('canvas', 'se-ink se-ink-hl')); cvPen = rt.node(mk('canvas', 'se-ink se-ink-pen')); cvLaser = rt.node(mk('canvas', 'se-ink se-ink-laser'));
  boardEl = rt.node(mk('div', 'se-board')); boardEl.hidden = true;
  hit = rt.node(mk('div', 'se-ink-hit')); hit.hidden = true;
  [boardEl, cvHl, cvPen, cvLaser, hit].forEach(function (c) { stage.appendChild(c); });
  capEl = mk('div', 'se-cap'); capEl.hidden = true; ui.appendChild(capEl);
  boardBar = mk('div', 'se-boardbar'); boardBar.hidden = true; ui.appendChild(boardBar);
  hit.addEventListener('pointerdown', onDown);
  hit.addEventListener('pointermove', onMove);
  hit.addEventListener('pointerup', onUp);
  hit.addEventListener('pointercancel', onUp);
  hit.addEventListener('click', function (e) { e.stopPropagation(); });
  capEl.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-tool')) ink.setTool(b.getAttribute('data-tool'));
    else if (b.hasAttribute('data-er')) { ink.eraser = ink.eraser === 'stroke' ? 'part' : 'stroke'; renderCap(); }
    else if (b.hasAttribute('data-color')) ink.setColor(b.getAttribute('data-color'));
    else if (b.hasAttribute('data-size')) ink.setSize(+b.getAttribute('data-size'));
    else { var a = b.getAttribute('data-a'); if (a === 'undo') ink.undo(); else if (a === 'redo') ink.redo(); else if (a === 'clear') ink.clear(); else if (a === 'clearall') ink.clearAll(); else if (a === 'off') ink.setTool(null); }
  });
  boardBar.addEventListener('click', function (e) {
    var b = e.target.closest('[data-b]'); if (!b) return;
    var a = b.getAttribute('data-b');
    if (a === 'prev') ink.boardGo(-1); else if (a === 'next') ink.boardGo(1); else if (a === 'add') ink.boardGo('add');
    else if (a === 'clear') ink.clear(); else if (a === 'close') ink.board(false);
  });
  SE.on('resize', sizeCanvases);
  SE.on('enter', redraw);
  SE.on('puckmoved', placeCap);
  SE.on('editstart', function () { if (ink.boardOpen) ink.board(false); ink.setTool(null); redraw(); });
  SE.on('editend', redraw);
  sizeCanvases();
});
