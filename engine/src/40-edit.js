/* =====================================================================
   슬라이드 엔진 · 편집 모드 (E)
   선택 · 이동 · 크기 · 회전 · 글자 고치기 · 스타일 · 추가 · 정리 · 모션 · 장 관리 ·
   되돌리기 · 파일로 저장 · 자동 임시 저장과 복구 · 점검
   ===================================================================== */
var edit = SE.edit = {};
var sel = [], selLayer, pill, popEl, film, guidesEl, textEl = null, textTok = null;
var hist = { undo: [], redo: [] }, dirty = false, fileHandle = null, autoTimer = null, baseHash = '';
var clip = null, FILM_H = 118;

/* ---------- 되돌리기 ---------- */
function snapSlide(s) { var c = cleanClone(s); ['active', 'leaving', 'play'].forEach(function (k) { c.classList.remove(k); }); return c; }
function restoreSlide(live, snap) {
  var c = snap.cloneNode(true);
  Array.prototype.slice.call(live.attributes).forEach(function (a) { live.removeAttribute(a.name); });
  Array.prototype.slice.call(c.attributes).forEach(function (a) { live.setAttribute(a.name, a.value); });
  while (live.firstChild) live.removeChild(live.firstChild);
  while (c.firstChild) live.appendChild(c.firstChild);
  if (live === slides[cur]) rt.cls(live, 'active', true);
  prepareSlide(live);
  markThumb(live);
}
edit.begin = function (s) { return { slide: s, before: snapSlide(s) }; };
edit.commit = function (tok, label) {
  if (!tok) return false;
  var after = snapSlide(tok.slide);
  if (after.outerHTML === tok.before.outerHTML) return false;
  push({ kind: 'slide', slide: tok.slide, before: tok.before, after: after, label: label });
  return true;
};
function push(e) { hist.undo.push(e); if (hist.undo.length > 60) hist.undo.shift(); hist.redo = []; changed(); }
edit.push = push;
function structSnap() { return { list: slides.slice(), cur: cur }; }
function applyStruct(st) {
  var last = slides[slides.length - 1], ref = last ? last.nextSibling : null;
  slides.forEach(function (s) { s.remove(); });
  st.list.forEach(function (s) { deck.insertBefore(s, ref); });
  refreshSlides();
  go(clamp(st.cur, 0, slides.length - 1), { force: true, instant: true });
  buildFilm();
}
function undoRedo(dir) {
  var from = dir < 0 ? hist.undo : hist.redo, to = dir < 0 ? hist.redo : hist.undo;
  var e = from.pop(); if (!e) { toast(dir < 0 ? '되돌릴 것이 없어요' : '다시 할 것이 없어요'); return; }
  endText(false); select([]);
  if (e.kind === 'slide') { restoreSlide(e.slide, dir < 0 ? e.before : e.after); var i = slides.indexOf(e.slide); if (i >= 0 && i !== cur) go(i, { instant: true }); }
  else if (e.kind === 'struct') applyStruct(dir < 0 ? e.before : e.after);
  else if (e.kind === 'custom') (dir < 0 ? e.undo : e.redo)();
  to.push(e);
  changed();
  relayout();
}
edit.undo = function () { undoRedo(-1); };
edit.redo = function () { undoRedo(1); };
function changed() {
  dirty = true;
  rt.cls(D.body, 'se-dirty', true);
  clearTimeout(autoTimer); autoTimer = setTimeout(autosave, 1500);
  if (film) $('.se-film-state', film).textContent = '저장하지 않은 편집이 있어요';
  emit('editchange');
}

/* ---------- 자동 임시 저장과 복구 (IndexedDB) ---------- */
function idb() {
  return new Promise(function (res, rej) {
    if (!W.indexedDB) { rej(new Error('no idb')); return; }
    var r; try { r = indexedDB.open('slide-engine', 1); } catch (e) { rej(e); return; }
    r.onupgradeneeded = function () { r.result.createObjectStore('auto'); };
    r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
  });
}
function idbDo(mode, fn) { return idb().then(function (db) { return new Promise(function (res, rej) { var tx = db.transaction('auto', mode), st = tx.objectStore('auto'), q = fn(st); tx.oncomplete = function () { res(q && q.result); }; tx.onerror = function () { rej(tx.error); }; }); }); }
function deckHtml() { return cleanClone(deck).innerHTML; }
function autosave() {
  if (!dirty) return;
  var html = deckHtml();
  idbDo('readwrite', function (st) { return st.put({ html: html, cur: cur, at: Date.now(), base: baseHash }, PATH); })
    .then(function () { if (film) $('.se-film-state', film).textContent = '임시 저장됨 · 파일에는 아직 저장 안 됨'; })
    .catch(function () { /* 저장 공간을 못 쓰면 넘어간다 */ });
}
function checkRecovery() {
  baseHash = hash(deckHtml());
  idbDo('readonly', function (st) { return st.get(PATH); }).then(function (r) {
    if (!r || !r.html) return;
    if (r.base !== baseHash) { idbDo('readwrite', function (st) { return st.delete(PATH); }); return; }
    var t = new Date(r.at), when = (t.getMonth() + 1) + '월 ' + t.getDate() + '일 ' + t.getHours() + ':' + ('0' + t.getMinutes()).slice(-2);
    confirmBox(when + '에 편집하다가 파일로 저장하지 않은 내용이 있어요. 되살릴까요?', '되살리기', '버리기').then(function (ok) {
      if (!ok) { idbDo('readwrite', function (st) { return st.delete(PATH); }); return; }
      deck.innerHTML = r.html;
      refreshSlides(); slides.forEach(prepareSlide);
      cur = -1; go(clamp(r.cur, 0, slides.length - 1), { instant: true });
      dirty = true; rt.cls(D.body, 'se-dirty', true);
      relayout(); toast('편집하던 내용을 되살렸어요. 저장하려면 편집 모드에서 Ctrl+S');
    });
  }).catch(function () { /* 무시 */ });
}

/* ---------- 파일로 저장 ---------- */
function fileName() { var n = PATH.split('/').pop() || 'slides.html'; return /\.html?$/i.test(n) ? n : n + '.html'; }
edit.save = function () {
  endText(true);
  var html = serialize(), name = fileName();
  var finish = function (msg) {
    dirty = false; rt.cls(D.body, 'se-dirty', false); baseHash = hash(deckHtml());
    idbDo('readwrite', function (st) { return st.delete(PATH); }).catch(function () { });
    if (film) $('.se-film-state', film).textContent = '저장됨';
    toast(msg, 3000); emit('saved');
  };
  var download = function () {
    var a = mk('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = name;
    D.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    finish('다운로드 폴더에 ' + name + ' 으로 저장했어요');
  };
  if (W.showSaveFilePicker) {
    (fileHandle ? Promise.resolve(fileHandle) : W.showSaveFilePicker({ suggestedName: name, types: [{ description: 'HTML 파일', accept: { 'text/html': ['.html', '.htm'] } }] }))
      .then(function (h) { fileHandle = h; return h.createWritable(); })
      .then(function (w) { return w.write(html).then(function () { return w.close(); }); })
      .then(function () { finish('저장했어요 · ' + (fileHandle.name || name)); })
      .catch(function (err) { if (err && err.name === 'AbortError') return; fileHandle = null; download(); });
  } else download();
};

/* ---------- 고를 수 있는 요소 ---------- */
function isSelectable(e, s) {
  if (!e || e === s || !s.contains(e) || e.nodeType !== 1) return false;
  if (rt.isRt(e) || e.closest('aside.notes')) return false;
  if (e.namespaceURI === SVGNS && e.tagName.toLowerCase() !== 'svg') return false;
  if (rt.has(e, 'css', 'transform')) return false;
  var d = getComputedStyle(e).display;
  return d !== 'inline' && d !== 'none' && d !== 'contents';
}
function climb(t, s) {
  while (t && t !== s && !isSelectable(t, s)) t = t.parentElement;
  return t && t !== s ? t : null;
}
function pick(target, s, deep) {
  if (target.closest('[data-se-proxy]')) {
    var cell = target.closest('td,th,p,li,span,div');
    return cell && !cell.hasAttribute('data-se-proxy') ? { el: cell, proxy: true } : null;
  }
  var e = climb(target, s);
  if (!e) return null;
  if (deep) return { el: e };
  return { el: e };
}

/* ---------- 선택 ---------- */
function select(list) {
  sel = list.filter(Boolean);
  closePop();
  drawSel();
  emit('select', sel);
}
edit.select = function (list) { select(list || []); };
edit.selection = function () { return sel.slice(); };
function xf(e) { return { x: num(e.getAttribute('data-se-x'), 0), y: num(e.getAttribute('data-se-y'), 0), r: num(e.getAttribute('data-se-r'), 0) }; }
function setXf(e, x, y, r) {
  x = Math.round(x * 10) / 10; y = Math.round(y * 10) / 10; r = Math.round(r * 10) / 10;
  if (!e.hasAttribute('data-se-base')) {
    var base = e.style.transform || '';
    if (!base) { var c = getComputedStyle(e).transform; base = c && c !== 'none' ? c : ''; }
    e.setAttribute('data-se-base', base || 'none');
  }
  var b = e.getAttribute('data-se-base');
  ['x', 'y', 'r'].forEach(function (k, i) { var v = [x, y, r][i]; if (v) e.setAttribute('data-se-' + k, v); else e.removeAttribute('data-se-' + k); });
  var parts = [];
  if (x || y) parts.push('translate(' + x + 'px,' + y + 'px)');
  if (r) parts.push('rotate(' + r + 'deg)');
  if (b && b !== 'none') parts.push(b);
  if (parts.length) e.style.transform = parts.join(' '); else e.style.removeProperty('transform');
}
function drawSel() {
  if (!selLayer) return;
  if (!editing || !sel.length) { selLayer.innerHTML = ''; selLayer.__kind = ''; pill.hidden = true; return; }
  var s = scale(), live = sel.filter(function (e) { return e.isConnected; });
  // 상자 수와 모양이 같으면 있던 상자를 옮기기만 한다 (누르는 중에 요소가 바뀌면 클릭이 끊긴다)
  var kind = live.length + ':' + (textEl ? 1 : 0) + ':' + (live[0] && live[0].__seProxy ? 1 : 0);
  if (selLayer.__kind !== kind || selLayer.children.length !== live.length) {
    selLayer.innerHTML = ''; selLayer.__kind = kind;
    live.forEach(function (e) {
      var box = mk('div', 'se-box' + (live.length === 1 ? ' one' : '') + (textEl === e ? ' texting' : ''));
      if (live.length === 1 && textEl !== e && !e.__seProxy) {
        ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(function (k) { var hd = mk('i', 'se-h se-h-' + k); hd.setAttribute('data-h', k); box.appendChild(hd); });
        var rot = mk('i', 'se-h se-h-rot'); rot.setAttribute('data-h', 'rot'); box.appendChild(rot);
      }
      selLayer.appendChild(box);
    });
  }
  live.forEach(function (e, i) {
    var box = selLayer.children[i], r = e.getBoundingClientRect(), t = xf(e);
    var w = e.offsetWidth ? e.offsetWidth * s : r.width, h = e.offsetWidth ? e.offsetHeight * s : r.height;
    box.style.cssText = 'left:' + (r.left + r.width / 2 - w / 2) + 'px;top:' + (r.top + r.height / 2 - h / 2) + 'px;width:' + w + 'px;height:' + h + 'px;transform:rotate(' + t.r + 'deg)';
  });
  placePill();
}
edit.redraw = drawSel;

/* ---------- 끌기: 이동 · 크기 · 회전 + 정렬 가이드 ---------- */
var drag = null;
function snapTargets(s) {
  var xs = [0, cfg.width / 2, cfg.width], ys = [0, cfg.height / 2, cfg.height];
  $$('*', s).forEach(function (e) {
    if (sel.indexOf(e) >= 0 || sel.some(function (x) { return x.contains(e) || e.contains(x); })) return;
    if (!isSelectable(e, s)) return;
    var r = rectIn(e, s); if (r.w < 4 || r.h < 4 || r.w > cfg.width * 0.98) return;
    xs.push(r.x, r.x + r.w / 2, r.x + r.w); ys.push(r.y, r.y + r.h / 2, r.y + r.h);
  });
  return { xs: xs, ys: ys };
}
function bbox(list, s) {
  var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  list.forEach(function (e) { var r = rectIn(e, s); x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h); });
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
function snap1(vals, targets, th) {
  var best = null;
  vals.forEach(function (v, i) { targets.forEach(function (t) { var d = t - v; if (Math.abs(d) <= th && (!best || Math.abs(d) < Math.abs(best.d))) best = { d: d, at: t, i: i }; }); });
  return best;
}
function showGuides(gx, gy) {
  guidesEl.innerHTML = '';
  var r = stage.getBoundingClientRect(), k = r.width / cfg.width;
  if (gx != null) { var v = mk('i', 'se-guide v'); v.style.cssText = 'left:' + (r.left + gx * k) + 'px;top:' + r.top + 'px;height:' + r.height + 'px'; guidesEl.appendChild(v); }
  if (gy != null) { var hz = mk('i', 'se-guide h'); hz.style.cssText = 'top:' + (r.top + gy * k) + 'px;left:' + r.left + 'px;width:' + r.width + 'px'; guidesEl.appendChild(hz); }
}
function startDrag(e, kind, handle) {
  var s = slides[cur], k = scale();
  drag = { kind: kind, h: handle, sx: e.clientX, sy: e.clientY, k: k, tok: edit.begin(s), moved: false, s: s,
    items: sel.map(function (el) { return { el: el, t: xf(el), w: el.offsetWidth, hgt: el.offsetHeight, r: el.getBoundingClientRect() }; }) };
  if (kind === 'move') { drag.box = bbox(sel, s); drag.tg = snapTargets(s); }
  if (kind === 'rot') { var r = sel[0].getBoundingClientRect(); drag.cx = r.left + r.width / 2; drag.cy = r.top + r.height / 2; drag.a0 = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx); }
  D.addEventListener('pointermove', onDrag);
  D.addEventListener('pointerup', endDrag);
  D.addEventListener('pointercancel', endDrag);
}
function onDrag(e) {
  if (!drag) return;
  var dx = (e.clientX - drag.sx) / drag.k, dy = (e.clientY - drag.sy) / drag.k;
  if (!drag.moved && Math.hypot(dx * drag.k, dy * drag.k) < 3) return;
  drag.moved = true;
  rt.cls(D.body, 'se-dragging', true);
  if (drag.kind === 'move') {
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    var b = drag.box, th = 7 / drag.k, gx = null, gy = null;
    if (!e.altKey) {
      var sx = snap1([b.x + dx, b.x + b.w / 2 + dx, b.x + b.w + dx], drag.tg.xs, th), sy = snap1([b.y + dy, b.y + b.h / 2 + dy, b.y + b.h + dy], drag.tg.ys, th);
      if (sx) { dx += sx.d; gx = sx.at; } if (sy) { dy += sy.d; gy = sy.at; }
    }
    showGuides(gx, gy);
    drag.items.forEach(function (it) { setXf(it.el, it.t.x + dx, it.t.y + dy, it.t.r); });
  } else if (drag.kind === 'rot') {
    var it = drag.items[0], a = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx), deg = it.t.r + (a - drag.a0) * 180 / Math.PI;
    if (e.shiftKey) deg = Math.round(deg / 15) * 15; else if (Math.abs(((deg % 360) + 360) % 360) < 3) deg = 0;
    setXf(it.el, it.t.x, it.t.y, deg);
  } else resizeTo(dx, dy, e.shiftKey);
  drawSel();
}
function resizeTo(dx, dy, keep) {
  var it = drag.items[0], el = it.el, h = drag.h, hx = h.indexOf('e') >= 0 ? 1 : h.indexOf('w') >= 0 ? -1 : 0, hy = h.indexOf('s') >= 0 ? 1 : h.indexOf('n') >= 0 ? -1 : 0;
  var rad = -it.t.r * Math.PI / 180, lx = dx * Math.cos(rad) - dy * Math.sin(rad), ly = dx * Math.sin(rad) + dy * Math.cos(rad);
  var w = Math.max(16, it.w + hx * lx), hh = Math.max(16, it.hgt + hy * ly);
  var img = el.tagName === 'IMG' || $(':scope > img', el) && el.children.length === 1 || el.classList.contains('se-image');
  if ((keep || img) && hx && hy) { var k = Math.max(w / it.w, hh / it.hgt); w = it.w * k; hh = it.hgt * k; }
  rt.forget(el, 'css', 'width'); rt.forget(el, 'css', 'height');
  if (hx) el.style.width = Math.round(w) + 'px';
  if (hy) el.style.height = Math.round(hh) + 'px';
  if (hx && !hy && img) el.style.height = Math.round(w * it.hgt / it.w) + 'px';
  el.setAttribute('data-se-sized', '');
  // 반대쪽 모서리가 제자리에 있도록 위치를 맞춘다
  var r0 = it.r, r1 = el.getBoundingClientRect();
  var ax0 = hx > 0 ? r0.left : hx < 0 ? r0.right : (r0.left + r0.right) / 2, ay0 = hy > 0 ? r0.top : hy < 0 ? r0.bottom : (r0.top + r0.bottom) / 2;
  var ax1 = hx > 0 ? r1.left : hx < 0 ? r1.right : (r1.left + r1.right) / 2, ay1 = hy > 0 ? r1.top : hy < 0 ? r1.bottom : (r1.top + r1.bottom) / 2;
  var t = xf(el);
  setXf(el, t.x + (ax0 - ax1) / drag.k, t.y + (ay0 - ay1) / drag.k, t.r);
}
function endDrag() {
  D.removeEventListener('pointermove', onDrag); D.removeEventListener('pointerup', endDrag); D.removeEventListener('pointercancel', endDrag);
  rt.cls(D.body, 'se-dragging', false);
  guidesEl.innerHTML = '';
  if (!drag) return;
  var d = drag; drag = null;
  if (d.moved) { edit.commit(d.tok); markThumb(d.s); relayout(); drawSel(); }
  else if (d.drill) select([d.drill]);
  // 끌지 않았으면 선택 상자를 다시 만들지 않는다 (두 번 클릭이 끊기지 않게)
}

/* ---------- 마우스 ---------- */
var lastDown = { t: 0, el: null };
function onStageDown(e) {
  if (!editing || e.button !== 0) return;
  var h = e.target.closest('.se-h');
  if (h) { e.preventDefault(); e.stopPropagation(); startDrag(e, h.getAttribute('data-h') === 'rot' ? 'rot' : 'resize', h.getAttribute('data-h')); return; }
  if (e.target.closest('.se-box') && !e.target.closest('.se-h')) {
    // 선택 상자 안을 누르면 아래 요소를 찾는다
    var under = D.elementsFromPoint(e.clientX, e.clientY).filter(function (x) { return !x.closest('#se-ui'); })[0];
    if (under) return downOn(e, under);
    return;
  }
}
function downOn(e, target) {
  var s = slides[cur];
  if (!s || !s.contains(target)) { if (!e.target.closest('#se-ui')) select([]); return; }
  if (textEl && textEl.contains(target)) return;
  endText(true);
  var p = pick(target, s, e.altKey);
  if (!p) { select([]); return; }
  e.preventDefault();
  var el = p.el;
  if (p.proxy) { el.__seProxy = true; select([el]); return; }
  if (e.shiftKey) { var i = sel.indexOf(el); if (i >= 0) select(sel.filter(function (x) { return x !== el; })); else select(sel.filter(function (x) { return x.closest('.slide') === s; }).concat([el])); return; }
  // 이미 고른 요소(또는 그 안)를 누르면 그대로 끌 수 있고, 끌지 않고 떼면 안쪽 요소로 들어간다
  var owner = sel.filter(function (x) { return x === el || x.contains(el); })[0];
  if (owner) { startDrag(e, 'move'); drag.drill = owner !== el && sel.length === 1 ? el : null; return; }
  select([el]);
  startDrag(e, 'move');
}
function onEditDown(e) {
  if (!editing || e.button !== 0 || e.target.closest('#se-ui')) return;
  if (e.target.closest('.se-box')) return;
  downOn(e, e.target);
}
function onEditDbl(e) {
  if (!editing) return;
  var s = slides[cur]; if (!s) return;
  var under = e.target.closest('#se-ui') ? D.elementsFromPoint(e.clientX, e.clientY).filter(function (x) { return !x.closest('#se-ui'); })[0] : e.target;
  if (!under || !s.contains(under)) return;
  var p = pick(under, s);
  if (!p) return;
  e.preventDefault();
  startText(p.el, e.clientX, e.clientY);
}

/* ---------- 글자 고치기 ---------- */
function startText(el, x, y) {
  if (el.closest('[data-se-lock]')) { toast(el.closest('[data-se-lock]').getAttribute('data-se-lock') || '이 글은 여기서 고칠 수 없어요'); return; }
  if (!el.textContent.trim() && !el.classList.contains('se-text') && !el.classList.contains('se-shape')) { toast('글자가 없는 요소예요'); return; }
  endText(true);
  var s = el.closest('.slide'), proxy = el.closest('[data-se-proxy]');
  textTok = proxy ? { proxy: proxy, el: el, before: el.innerHTML } : edit.begin(s);
  if (!proxy) rt.restoreHtml(el);
  emit('textstart', el);
  textEl = el;
  rt.attr(el, 'contenteditable', 'true'); rt.attr(el, 'spellcheck', 'false');
  select([el]);
  el.focus();
  var r = x != null && D.caretRangeFromPoint ? D.caretRangeFromPoint(x, y) : null;
  var sl = W.getSelection();
  if (r && el.contains(r.startContainer)) { sl.removeAllRanges(); sl.addRange(r); }
  else { var rg = D.createRange(); rg.selectNodeContents(el); rg.collapse(false); sl.removeAllRanges(); sl.addRange(rg); }
}
edit.startText = startText;
function endText(keepSel) {
  if (!textEl) return;
  var el = textEl, tok = textTok; textEl = null; textTok = null;
  rt.attr(el, 'contenteditable', null); rt.attr(el, 'spellcheck', null);
  if (el.innerHTML === '<br>') el.innerHTML = '';
  if (tok && tok.proxy) {
    if (el.innerHTML !== tok.before) {
      var after = el.innerHTML, kind = tok.proxy.getAttribute('data-se-proxy');
      emit('proxyedit', el, tok.proxy, kind);
      push({ kind: 'custom', undo: function () { el.innerHTML = tok.before; emit('proxyedit', el, tok.proxy, kind); }, redo: function () { el.innerHTML = after; emit('proxyedit', el, tok.proxy, kind); } });
    }
  } else {
    if ($$('[data-split],[data-anim="words"],[data-anim="chars"],[data-anim="type"]', el).length || el.matches('[data-split],[data-anim="words"],[data-anim="chars"],[data-anim="type"]')) prepareSlide(el.closest('.slide'));
    emit('textedit', el);
    if (edit.commit(tok)) markThumb(el.closest('.slide'));
  }
  if (W.getSelection) W.getSelection().removeAllRanges();
  select(keepSel && el.isConnected ? [el] : []);
  relayout();
}
edit.endText = endText;

/* ---------- 스타일 ---------- */
var SWATCH = ['#1D2228', '#FFFFFF', '#E5484D', '#2F6FEB', '#22A06B', '#F5C518', '#8E4EC6', '#6B7280'];
function styleChange(fn, label) {
  if (!sel.length) return;
  var s = sel[0].closest('.slide'), tok = edit.begin(s);
  sel.forEach(function (e) { fn(e); });
  edit.commit(tok, label); markThumb(s); drawSel(); relayout();
}
function setStyle(prop, val) {
  styleChange(function (e) { rt.forget(e, 'css', prop); if (val == null || val === '') e.style.removeProperty(prop); else e.style.setProperty(prop, val); });
}
function ensurePos(e) { if (getComputedStyle(e).position === 'static') { rt.forget(e, 'css', 'position'); e.style.position = 'relative'; } }
function swatches(prop, extra) {
  return '<div class="se-sw">' + SWATCH.map(function (c) { return '<button type="button" data-css="' + prop + '" data-v="' + c + '" style="--c:' + c + '" aria-label="' + c + '"></button>'; }).join('') +
    '<label class="se-cpick" aria-label="다른 색"><input type="color" data-css="' + prop + '"></label>' + (extra || '') + '</div>';
}
function range(prop, min, max, unit, val) { return '<input type="range" class="se-range" data-css="' + prop + '" data-unit="' + unit + '" min="' + min + '" max="' + max + '" value="' + val + '">'; }
var POPS = {
  color: function () { return '<p class="se-lab">글자색</p>' + swatches('color') + '<button type="button" class="se-btn se-sm" data-css="color" data-v="">원래대로</button>'; },
  fill: function () { return '<p class="se-lab">배경</p>' + swatches('background-color', '<button type="button" class="se-none" data-css="background-color" data-v="transparent" aria-label="없음"></button>') + '<button type="button" class="se-btn se-sm" data-css="background-color" data-v="">원래대로</button>'; },
  border: function () {
    var e = sel[0], w = parseFloat(getComputedStyle(e).borderTopWidth) || 0;
    return '<p class="se-lab">테두리 굵기</p><div class="se-seg">' + [0, 2, 4, 8].map(function (n) { return '<button type="button" data-bw="' + n + '" aria-pressed="' + (Math.round(w) === n) + '">' + (n ? n + 'px' : '없음') + '</button>'; }).join('') + '</div><p class="se-lab">테두리 색</p>' + swatches('border-color');
  },
  radius: function () { var v = parseFloat(getComputedStyle(sel[0]).borderTopLeftRadius) || 0; return '<p class="se-lab">둥글기 <output>' + Math.round(v) + 'px</output></p>' + range('border-radius', 0, 120, 'px', Math.round(v)); },
  opacity: function () { var v = Math.round((parseFloat(getComputedStyle(sel[0]).opacity) || 1) * 100); return '<p class="se-lab">투명도 <output>' + v + '%</output></p>' + range('opacity', 10, 100, '%', v); },
  shadow: function () {
    return '<p class="se-lab">그림자</p><div class="se-seg"><button type="button" data-css="box-shadow" data-v="none">없음</button><button type="button" data-css="box-shadow" data-v="0 8px 24px rgba(0,0,0,.18)">약하게</button><button type="button" data-css="box-shadow" data-v="0 18px 48px rgba(0,0,0,.35)">강하게</button></div>' +
      '<p class="se-lab">글자 그림자</p><div class="se-seg"><button type="button" data-css="text-shadow" data-v="none">없음</button><button type="button" data-css="text-shadow" data-v="0 3px 10px rgba(0,0,0,.35)">켜기</button></div>';
  },
  motion: function () {
    var e = sel[0], g = function (a) { return e.getAttribute(a); };
    var chips = function (attr, list) {
      return '<div class="se-chips">' + list.map(function (o) { var on = (g(attr) || '') === o[0]; return '<button type="button" data-attr="' + attr + '" data-v="' + o[0] + '" aria-pressed="' + on + '">' + o[1] + '</button>'; }).join('') + '</div>';
    };
    var tog = function (attr, label, dep) { return '<label class="se-check' + (dep && !g(dep) ? ' off' : '') + '"><input type="checkbox" data-flag="' + attr + '"' + (e.hasAttribute(attr) ? ' checked' : '') + '> ' + label + '</label>'; };
    var quizParent = e.parentElement && e.parentElement.hasAttribute('data-quiz');
    return '<p class="se-lab">등장</p>' + chips('data-anim', [['', '없음'], ['fade', '서서히'], ['up', '위로'], ['pop', '튀어나오기'], ['drop', '떨어지기'], ['blur', '흐림→선명'], ['zoom', '확대'], ['words', '단어씩'], ['chars', '글자씩'], ['type', '타자기'], ['stagger', '차례로']]) + tog('data-step', '클릭할 때 나타나기') +
      '<p class="se-lab">강조</p>' + chips('data-emph', [['', '없음'], ['pulse', '두근'], ['shake', '흔들기'], ['glow', '빛나기'], ['mark', '형광펜'], ['underline', '밑줄'], ['circle', '동그라미'], ['spotlight', '스포트라이트']]) + tog('data-emph-step', '클릭할 때 강조', 'data-emph') +
      '<p class="se-lab">퇴장 (클릭할 때)</p>' + chips('data-exit', [['', '없음'], ['strike', '취소선'], ['fade', '사라지기'], ['shrink', '작아지기'], ['fly', '날아가기']]) +
      '<p class="se-lab">숫자 · 도식</p><div class="se-chips">' +
      '<button type="button" data-flagbtn="data-count" aria-pressed="' + e.hasAttribute('data-count') + '">숫자 올라가기</button>' +
      '<button type="button" data-flagbtn="data-bar" aria-pressed="' + e.hasAttribute('data-bar') + '">막대 자라기</button>' +
      '<button type="button" data-flagbtn="data-draw" aria-pressed="' + e.hasAttribute('data-draw') + '">선 그리기</button></div>' +
      '<p class="se-lab">상호작용</p><div class="se-chips">' +
      '<button type="button" data-flagbtn="data-flip" aria-pressed="' + e.hasAttribute('data-flip') + '"' + (e.children.length < 2 ? ' disabled title="안에 앞면·뒷면 두 요소가 있어야 해요"' : '') + '>뒤집기 카드</button>' +
      '<button type="button" data-flagbtn="data-cover" aria-pressed="' + e.hasAttribute('data-cover') + '">가리개</button>' +
      '<button type="button" data-flagbtn="data-quiz" aria-pressed="' + e.hasAttribute('data-quiz') + '"' + (e.children.length < 2 ? ' disabled title="안에 보기가 두 개 이상 있어야 해요"' : '') + '>퀴즈</button>' +
      (quizParent ? '<button type="button" data-flagbtn="data-correct" aria-pressed="' + e.hasAttribute('data-correct') + '">퀴즈 정답</button>' : '') +
      '<button type="button" data-flagbtn="data-enlarge" aria-pressed="' + e.hasAttribute('data-enlarge') + '">눌러서 크게</button>' +
      '<button type="button" data-a="hotspot">핫스팟 넣기</button></div>' +
      (e.hasAttribute('data-hotspot') ? '<p class="se-lab">핫스팟 설명</p><input class="se-input" data-tip value="' + esc(g('data-tip') || '') + '">' : '') +
      '<p class="se-lab">모프 이름 <span class="se-hint">(앞뒤 장에 같은 이름이 있으면 모프 전환 때 이어서 움직여요)</span></p><input class="se-input" data-morph value="' + esc(g('data-morph') || '') + '">' +
      '<div class="se-row se-gap"><button type="button" class="se-btn se-primary" data-a="preview">' + icon('play') + '미리보기</button></div>';
  },
  arrange: function () {
    var b = function (a, l) { return '<button type="button" class="se-btn se-sm" data-arr="' + a + '">' + l + '</button>'; };
    return '<p class="se-lab">정렬' + (sel.length > 1 ? ' (고른 요소끼리)' : ' (슬라이드 기준)') + '</p><div class="se-row se-wrap">' + b('left', '왼쪽') + b('hcenter', '가운데') + b('right', '오른쪽') + b('top', '위') + b('vcenter', '가운데') + b('bottom', '아래') + '</div>' +
      '<p class="se-lab">배분 (세 개 이상)</p><div class="se-row se-wrap">' + b('hdist', '가로 간격 같게') + b('vdist', '세로 간격 같게') + '</div>' +
      '<p class="se-lab">순서</p><div class="se-row se-wrap">' + b('front', '맨 앞으로') + b('fwd', '앞으로') + b('back', '뒤로') + b('bottomz', '맨 뒤로') + '</div>' +
      '<p class="se-lab">위치 · 회전</p><div class="se-row se-wrap">' + b('reset', '옮긴 것 되돌리기') + b('size', '크기 원래대로') + '</div>';
  },
  more: function () {
    var b = function (a, ic, l) { return '<button type="button" class="se-btn se-sm" data-a="' + a + '">' + icon(ic) + l + '</button>'; };
    return '<div class="se-col">' + b('copy', 'copy', '복사 (Ctrl+C)') + b('dup', 'dup', '복제 (Ctrl+D)') + b('parent', 'up', '바깥 요소 고르기') + b('text', 'text', '글자 고치기 (Enter)') + b('del', 'trash', '삭제 (Delete)') + '</div>';
  }
};
function openPop(kind, anchor) {
  if (popEl.getAttribute('data-kind') === kind && !popEl.hidden) { closePop(); return; }
  popEl.innerHTML = POPS[kind]();
  popEl.setAttribute('data-kind', kind); popEl.hidden = false;
  // 알약을 가리지 않게: 위아래 중 넓은 쪽에 두고, 모자라면 그만큼만 높이를 준다
  popEl.style.maxHeight = '';
  var r = anchor.getBoundingClientRect(), w = popEl.offsetWidth, h = popEl.offsetHeight;
  var below = W.innerHeight - FILM_H - r.bottom - 16, above = r.top - 16, top;
  if (h <= below || below >= above) { if (h > below) popEl.style.maxHeight = below + 'px'; top = r.bottom + 8; }
  else { if (h > above) popEl.style.maxHeight = above + 'px'; top = r.top - Math.min(h, above) - 8; }
  popEl.style.left = clamp(r.left + r.width / 2 - w / 2, 8, W.innerWidth - w - 8) + 'px'; popEl.style.top = top + 'px';
}
function closePop() { if (popEl) { popEl.hidden = true; popEl.removeAttribute('data-kind'); } }
function onPop(e) {
  var t = e.target, b;
  if ((b = t.closest('[data-css][data-v]')) && e.type === 'click') { setStyle(b.getAttribute('data-css'), b.getAttribute('data-v')); return; }
  if (t.matches('input[type=color]') && e.type === 'change') { setStyle(t.getAttribute('data-css'), t.value); return; }
  if (t.matches('.se-range')) {
    var v = t.value, unit = t.getAttribute('data-unit'), prop = t.getAttribute('data-css');
    var out = t.previousElementSibling && $('output', t.previousElementSibling); if (out) out.textContent = v + unit;
    if (e.type === 'input') { sel.forEach(function (x) { x.style.setProperty(prop, unit === '%' ? v / 100 : v + unit); }); drawSel(); }
    else { var vals = sel.map(function (x) { return x.style.getPropertyValue(prop); }); sel.forEach(function (x, i) { x.style.setProperty(prop, vals[i]); }); setStyle(prop, unit === '%' ? String(v / 100) : v + unit); }
    return;
  }
  if (e.type !== 'click') {
    if (t.matches('[data-tip]') && e.type === 'change') styleChange(function (x) { x.setAttribute('data-tip', t.value); });
    if (t.matches('[data-morph]') && e.type === 'change') styleChange(function (x) { if (t.value.trim()) x.setAttribute('data-morph', t.value.trim()); else x.removeAttribute('data-morph'); });
    if (t.matches('[data-flag]') && e.type === 'change') { styleChange(function (x) { if (t.checked) x.setAttribute(t.getAttribute('data-flag'), ''); else x.removeAttribute(t.getAttribute('data-flag')); }); }
    return;
  }
  if ((b = t.closest('[data-bw]'))) { var n = +b.getAttribute('data-bw'); styleChange(function (x) { if (n) { x.style.borderWidth = n + 'px'; x.style.borderStyle = 'solid'; if (!x.style.borderColor) x.style.borderColor = 'currentColor'; } else { x.style.removeProperty('border-width'); x.style.removeProperty('border-style'); x.style.removeProperty('border-color'); } }); $$('[data-bw]', popEl).forEach(function (y) { y.setAttribute('aria-pressed', y === b); }); return; }
  if ((b = t.closest('[data-attr]'))) {
    var attr = b.getAttribute('data-attr'), val = b.getAttribute('data-v');
    styleChange(function (x) { if (val) x.setAttribute(attr, val); else { x.removeAttribute(attr); if (attr === 'data-emph') x.removeAttribute('data-emph-step'); if (attr === 'data-exit') x.removeAttribute('data-exit-step'); } if (attr === 'data-anim' || attr === 'data-emph') { rt.restoreHtml(x); } });
    prepareSlide(slides[cur]);
    $$('[data-attr="' + attr + '"]', popEl).forEach(function (y) { y.setAttribute('aria-pressed', y === b); });
    if (val) previewEl(sel[0], attr);
    return;
  }
  if ((b = t.closest('[data-flagbtn]'))) {
    var f = b.getAttribute('data-flagbtn'), on = b.getAttribute('aria-pressed') !== 'true';
    styleChange(function (x) {
      if (!on) { x.removeAttribute(f); if (f === 'data-cover') { var lid = $(':scope > .se-lid', x); if (lid) lid.remove(); } return; }
      x.setAttribute(f, f === 'data-cover' ? '눌러서 보기' : f === 'data-bar' ? 'x' : '');
    });
    prepareSlide(slides[cur]);
    b.setAttribute('aria-pressed', on);
    return;
  }
  if ((b = t.closest('[data-arr]'))) { arrange(b.getAttribute('data-arr')); return; }
  if ((b = t.closest('[data-a]'))) {
    var a = b.getAttribute('data-a');
    if (a === 'preview') { previewEl(sel[0]); return; }
    if (a === 'hotspot') { addHotspot(sel[0]); return; }
    closePop();
    if (a === 'copy') copySel(); else if (a === 'dup') dupSel(); else if (a === 'del') delSel(); else if (a === 'text') startText(sel[0]);
    else if (a === 'parent') { var p = climb(sel[0].parentElement, slides[cur]); if (p) select([p]); else toast('더 바깥 요소가 없어요'); }
  }
}

/* ---------- 모션 미리보기 ---------- */
function previewEl(e, only) {
  if (!e) return;
  var was = settings.motion; settings.motion = was || 2;
  editing = false; rt.cls(stage, 'motion', true);
  try {
    resetSlideState(slides[cur]);
    if (!only || only === 'data-anim') { playEntrance(e, 0); runDiagrams(e, 0); }
    if (e.hasAttribute('data-emph') && (!only || only === 'data-emph')) setTimeout(function () { emphOn(e, true); setTimeout(function () { emphOff(e); }, 1800); }, only ? 0 : 900);
    if (e.hasAttribute('data-exit') && !only) setTimeout(function () { exitOn(e, true); setTimeout(function () { exitOff(e); }, 1200); }, 2000);
  } finally { editing = true; settings.motion = was; rt.cls(stage, 'motion', false); }
  setTimeout(drawSel, 1200);
}

/* ---------- 정렬 · 배분 · 순서 ---------- */
function arrange(a) {
  var s = slides[cur]; if (!sel.length) return;
  if (/^(front|fwd|back|bottomz)$/.test(a)) {
    var sib = Array.prototype.slice.call(sel[0].parentElement.children).map(function (x) { return parseInt(getComputedStyle(x).zIndex, 10) || 0; });
    var mx = Math.max.apply(null, sib), mn = Math.min.apply(null, sib);
    styleChange(function (x) { ensurePos(x); var z = parseInt(getComputedStyle(x).zIndex, 10) || 0; x.style.zIndex = a === 'front' ? mx + 1 : a === 'bottomz' ? mn - 1 : a === 'fwd' ? z + 1 : z - 1; });
    toast({ front: '맨 앞으로', fwd: '한 칸 앞으로', back: '한 칸 뒤로', bottomz: '맨 뒤로' }[a]);
    return;
  }
  if (a === 'reset') { styleChange(function (x) { setXf(x, 0, 0, 0); x.removeAttribute('data-se-base'); }); return; }
  if (a === 'size') { styleChange(function (x) { x.style.removeProperty('width'); x.style.removeProperty('height'); x.removeAttribute('data-se-sized'); }); return; }
  var items = sel.map(function (x) { return { el: x, r: rectIn(x, s) }; });
  var box = sel.length > 1 ? bbox(sel, s) : { x: 0, y: 0, w: cfg.width, h: cfg.height };
  var tok = edit.begin(s);
  if (a === 'hdist' || a === 'vdist') {
    if (items.length < 3) { toast('세 개 이상 골라 주세요 (Shift + 클릭)'); return; }
    var hz = a === 'hdist', key = hz ? 'x' : 'y', len = hz ? 'w' : 'h';
    items.sort(function (p, q) { return p.r[key] - q.r[key]; });
    var total = items.reduce(function (t, it) { return t + it.r[len]; }, 0), span = box[len], gap = (span - total) / (items.length - 1), pos = box[key];
    items.forEach(function (it) { var d = pos - it.r[key], t = xf(it.el); setXf(it.el, t.x + (hz ? d : 0), t.y + (hz ? 0 : d), t.r); pos += it.r[len] + gap; });
  } else {
    items.forEach(function (it) {
      var r = it.r, t = xf(it.el), dx = 0, dy = 0;
      if (a === 'left') dx = box.x - r.x; else if (a === 'right') dx = box.x + box.w - r.x - r.w; else if (a === 'hcenter') dx = box.x + box.w / 2 - r.x - r.w / 2;
      else if (a === 'top') dy = box.y - r.y; else if (a === 'bottom') dy = box.y + box.h - r.y - r.h; else if (a === 'vcenter') dy = box.y + box.h / 2 - r.y - r.h / 2;
      setXf(it.el, t.x + dx, t.y + dy, t.r);
    });
  }
  edit.commit(tok); markThumb(s); drawSel();
}

/* ---------- 서식 알약 (고른 요소 위) ---------- */
function placePill() {
  if (!sel.length || textEl || drag) { pill.hidden = !(sel.length && !drag); if (textEl) pill.hidden = true; if (pill.hidden) return; }
  var proxy = sel[0].__seProxy;
  var hasText = sel.some(function (e) { return e.textContent.trim(); });
  pill.innerHTML = proxy ? '<span class="se-pill-note">이 칸은 글자만 고칠 수 있어요 · 두 번 눌러 고치기</span>' :
    [['color', 'color', '글자색'], ['fill', 'fill', '배경'], ['border', 'border', '테두리'], ['radius', 'radius', '둥글기'], ['opacity', 'opacity', '투명도'], ['shadow', 'shadow', '그림자']].map(function (p) { return '<button type="button" data-pop="' + p[0] + '" aria-label="' + p[2] + '">' + icon(p[1]) + '</button>'; }).join('') +
    (hasText ? '<i class="se-div"></i><button type="button" data-fs="-1" aria-label="글자 작게">' + icon('smaller') + '</button><button type="button" data-fs="1" aria-label="글자 크게">' + icon('bigger') + '</button><button type="button" data-bold aria-label="굵게">' + icon('bold') + '</button>' : '') +
    '<i class="se-div"></i><button type="button" class="se-wide" data-pop="motion">' + icon('motion') + '모션</button>' +
    '<button type="button" data-pop="arrange" aria-label="정렬 · 순서">' + icon('align') + '</button>' +
    '<button type="button" data-a="parent" aria-label="바깥 요소 고르기">' + icon('up') + '</button>' +
    '<button type="button" data-pop="more" aria-label="더 보기">' + icon('more') + '</button>';
  pill.hidden = false;
  var r = sel[0].getBoundingClientRect(); sel.forEach(function (e) { var q = e.getBoundingClientRect(); r = { left: Math.min(r.left, q.left), top: Math.min(r.top, q.top), right: Math.max(r.right, q.right), bottom: Math.max(r.bottom, q.bottom) }; });
  // 회전 손잡이(선택 상자 위 42px)를 가리지 않게 그 위에 둔다
  var w = pill.offsetWidth, h = pill.offsetHeight, top = r.top - h - 58;
  if (top < 8) top = Math.min(r.bottom + 18, W.innerHeight - FILM_H - h - 8);
  pill.style.left = clamp((r.left + r.right) / 2 - w / 2, 8, W.innerWidth - w - 8) + 'px';
  pill.style.top = top + 'px';
}
function onPill(e) {
  var b = e.target.closest('button'); if (!b) return;
  if (b.hasAttribute('data-pop')) { openPop(b.getAttribute('data-pop'), b); return; }
  if (b.hasAttribute('data-fs')) { var d = +b.getAttribute('data-fs'); styleChange(function (x) { var fs = parseFloat(getComputedStyle(x).fontSize) || 40; x.style.fontSize = Math.max(10, Math.round(fs * (d > 0 ? 1.12 : 1 / 1.12))) + 'px'; }); return; }
  if (b.hasAttribute('data-bold')) { styleChange(function (x) { x.style.fontWeight = (parseInt(getComputedStyle(x).fontWeight, 10) || 400) >= 600 ? '400' : '700'; }); return; }
  if (b.getAttribute('data-a') === 'parent') { var p = climb(sel[0].parentElement, slides[cur]); if (p) select([p]); else toast('더 바깥 요소가 없어요'); }
}

/* ---------- 추가 ---------- */
function newId() { return 's' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }
function addObj(html, x, y, w, h, opts) {
  var s = slides[cur]; if (!s) return null;
  var tok = edit.begin(s), wrap = mk('div'); wrap.innerHTML = html;
  var e = wrap.firstElementChild;
  e.style.left = Math.round(x - w / 2) + 'px'; e.style.top = Math.round(y - (h || 0) / 2) + 'px'; e.style.width = Math.round(w) + 'px';
  if (h) e.style.height = Math.round(h) + 'px';
  s.appendChild(e);
  edit.commit(tok); markThumb(s); select([e]);
  if (opts && opts.text) startText(e);
  return e;
}
edit.addText = function (x, y, text) {
  var e = addObj('<div class="se-obj se-text"></div>', x || cfg.width / 2, y || cfg.height / 2, 900, 0);
  if (e) { if (text) { e.textContent = text; endText(true); } else { e.innerHTML = ''; startText(e); } }
  return e;
};
var SHAPES = [['rect', '사각형'], ['round', '둥근 사각형'], ['ellipse', '원'], ['triangle', '삼각형'], ['arrow', '화살표'], ['line', '선']];
edit.addShape = function (kind) {
  var w = kind === 'line' ? 600 : kind === 'arrow' ? 520 : 420, h = kind === 'line' ? 10 : kind === 'arrow' ? 220 : 300;
  return addObj('<div class="se-obj se-shape" data-shape="' + kind + '" style="background-color:' + cfg.shapeColor + '"></div>', cfg.width / 2, cfg.height / 2, w, h);
};
function readImage(file) {
  return new Promise(function (res, rej) {
    var fr = new FileReader();
    fr.onload = function () {
      var src = fr.result, im = new Image();
      im.onload = function () {
        var max = 2400, k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
        if (k >= 1 && file.size < 1500000) { res({ src: src, w: im.naturalWidth, h: im.naturalHeight }); return; }
        var c = mk('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        res({ src: c.toDataURL(/png|gif|webp/.test(file.type) ? 'image/png' : 'image/jpeg', 0.88), w: c.width, h: c.height });
      };
      im.onerror = rej; im.src = src;
    };
    fr.onerror = rej; fr.readAsDataURL(file);
  });
}
function addImageFile(file, at, target) {
  readImage(file).then(function (im) {
    var img = target && (target.tagName === 'IMG' ? target : $(':scope > img', target));
    if (img) {
      var s = img.closest('.slide'), tok = edit.begin(s);
      rt.forget(img, 'attr', 'src'); img.removeAttribute('data-src-ref'); img.removeAttribute('data-src-key');
      img.setAttribute('src', im.src);
      edit.commit(tok); markThumb(s); relayout(); toast('사진을 바꿨어요');
      return;
    }
    var k = Math.min(1, 900 / im.w, 640 / im.h);
    var p = at || { x: cfg.width / 2, y: cfg.height / 2 };
    var e = addObj('<figure class="se-obj se-image"><img alt=""></figure>', p.x, p.y, im.w * k, im.h * k);
    if (e) { e.firstChild.setAttribute('src', im.src); markThumb(slides[cur]); }
  }).catch(function () { toast('그림을 읽지 못했어요'); });
}
edit.pickImage = function () {
  var inp = mk('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = function () { if (inp.files[0]) addImageFile(inp.files[0], null, sel[0]); };
  inp.click();
};
function addHotspot(host) {
  var s = slides[cur], tok = edit.begin(s), e = mk('button', 'se-obj se-hotspot');
  e.type = 'button'; e.setAttribute('data-hotspot', ''); e.setAttribute('data-tip', '설명을 적어 주세요');
  var r = host ? rectIn(host, s) : { x: cfg.width / 2, y: cfg.height / 2, w: 0, h: 0 };
  e.style.left = Math.round(r.x + r.w / 2 - 28) + 'px'; e.style.top = Math.round(r.y + r.h / 2 - 28) + 'px';
  s.appendChild(e); prepareSlide(s); edit.commit(tok); select([e]); openPop('motion', pill.querySelector('[data-pop="motion"]') || pill);
}

/* ---------- 복사 · 붙여넣기 · 복제 · 삭제 ---------- */
function asObject(e, s, dx) {
  var r = rectIn(e, s), c = cleanClone(e);
  c.removeAttribute('data-se-x'); c.removeAttribute('data-se-y'); c.removeAttribute('data-se-base'); c.removeAttribute('data-step'); c.removeAttribute('data-morph');
  $$('[id]', c).forEach(function (x) { x.removeAttribute('id'); }); c.removeAttribute('id');
  var cs = getComputedStyle(e);
  ['font-size', 'font-family', 'font-weight', 'line-height', 'color', 'text-align'].forEach(function (p) { if (!c.style.getPropertyValue(p)) c.style.setProperty(p, cs.getPropertyValue(p)); });
  c.style.position = 'absolute'; c.style.margin = '0';
  c.style.left = Math.round(r.x + (dx || 0)) + 'px'; c.style.top = Math.round(r.y + (dx || 0)) + 'px';
  c.style.width = Math.round(e.offsetWidth || r.w) + 'px';
  var t = xf(e); if (t.r) { c.style.transform = 'rotate(' + t.r + 'deg)'; c.setAttribute('data-se-base', 'none'); } else c.style.removeProperty('transform');
  c.classList.add('se-obj');
  return c;
}
function copySel(cut) {
  if (!sel.length) return;
  var s = slides[cur];
  clip = { html: sel.map(function (e) { return asObject(e, s, 0).outerHTML; }), text: sel.map(function (e) { return e.textContent.trim(); }).join('\n'), n: 0 };
  try { if (navigator.clipboard) navigator.clipboard.writeText(clip.text || ' ').catch(function () { }); } catch (err) { /* 무시 */ }
  if (cut) delSel(); else toast('복사했어요');
}
function pasteClip() {
  if (!clip) return false;
  var s = slides[cur], tok = edit.begin(s), made = [];
  clip.n++;
  clip.html.forEach(function (h) {
    var w = mk('div'); w.innerHTML = h; var e = w.firstElementChild;
    e.style.left = (parseFloat(e.style.left) + 30 * clip.n) + 'px'; e.style.top = (parseFloat(e.style.top) + 30 * clip.n) + 'px';
    s.appendChild(e); made.push(e);
  });
  prepareSlide(s); edit.commit(tok); markThumb(s); select(made);
  return true;
}
function dupSel() {
  if (!sel.length) return;
  var s = slides[cur], tok = edit.begin(s), made = sel.map(function (e) { var c = asObject(e, s, 30); s.appendChild(c); return c; });
  prepareSlide(s); edit.commit(tok); markThumb(s); select(made);
}
function delSel() {
  if (!sel.length) return;
  var s = slides[cur], tok = edit.begin(s);
  sel.forEach(function (e) { e.remove(); });
  select([]); edit.commit(tok); markThumb(s); relayout();
}
function nudge(dx, dy) {
  if (!sel.length) return;
  var s = slides[cur], tok = edit.begin(s);
  sel.forEach(function (e) { var t = xf(e); setXf(e, t.x + dx, t.y + dy, t.r); });
  clearTimeout(nudge.t);
  if (!nudge.tok) nudge.tok = tok;
  nudge.t = setTimeout(function () { edit.commit(nudge.tok); nudge.tok = null; markThumb(s); }, 500);
  drawSel();
}

/* ---------- 장 관리 ---------- */
function newSlideEl() {
  var s;
  var tpl = $('template[data-se-new-slide]');
  if (tpl) s = tpl.content.firstElementChild.cloneNode(true);
  else { s = mk('section', 'slide'); s.innerHTML = '<div class="se-obj se-text se-title" style="left:140px;top:150px;width:1640px">제목을 적어 주세요</div><div class="se-obj se-text" style="left:140px;top:330px;width:1640px">내용을 적어 주세요</div>'; }
  s.setAttribute('data-id', newId());
  emit('newslide', s, slides[cur]);
  return s;
}
function structOp(fn, label) {
  endText(true); select([]);
  var before = structSnap(); fn(); refreshSlides();
  var after = structSnap();
  push({ kind: 'struct', before: before, after: after, label: label });
  buildFilm(); updateChrome();
}
edit.addSlide = function () {
  structOp(function () {
    var s = newSlideEl(), ref = slides[cur] ? slides[cur].nextSibling : null;
    deck.insertBefore(s, ref); refreshSlides(); prepareSlide(s); go(slides.indexOf(s), { instant: true });
  });
};
edit.dupSlide = function () {
  structOp(function () {
    var o = slides[cur], c = snapSlide(o);
    c.setAttribute('data-id', newId()); c.removeAttribute('data-n');
    deck.insertBefore(c, o.nextSibling); refreshSlides(); prepareSlide(c); go(slides.indexOf(c), { instant: true });
  });
  toast('장을 복제했어요');
};
edit.delSlide = function () {
  if (slides.length < 2) { toast('마지막 한 장은 지울 수 없어요'); return; }
  structOp(function () { var i = cur; slides[i].remove(); refreshSlides(); cur = -1; go(Math.min(i, slides.length - 1), { instant: true }); });
  toast('장을 지웠어요 · Ctrl+Z로 되돌리기');
};
edit.toggleHide = function () {
  var s = slides[cur], tok = edit.begin(s);
  if (s.hasAttribute('data-hidden')) s.removeAttribute('data-hidden'); else s.setAttribute('data-hidden', '');
  edit.commit(tok); buildFilm(); updateChrome();
  toast(s.hasAttribute('data-hidden') ? '이 장을 숨겼어요 (발표할 때 건너뜀)' : '이 장을 다시 보이게 했어요');
};
edit.moveSlide = function (from, to) {
  if (from === to || from < 0 || to < 0) return;
  structOp(function () {
    var s = slides[from], list = slides.slice(); list.splice(from, 1); list.splice(to, 0, s);
    var last = slides[slides.length - 1], ref = last.nextSibling;
    slides.forEach(function (x) { x.remove(); }); list.forEach(function (x) { deck.insertBefore(x, ref); });
    refreshSlides(); cur = -1; go(slides.indexOf(s), { instant: true });
  });
};
function slidePop(kind) {
  var s = slides[cur], val = s.getAttribute(kind === 'tr' ? 'data-transition' : 'data-bg') || '';
  var list = kind === 'tr'
    ? [['', '기본 (' + cfg.transition + ')'], ['none', '없음'], ['fade', '서서히'], ['push', '밀어내기'], ['cover', '덮기'], ['zoom', '확대'], ['flip', '뒤집기'], ['wipe', '쓸어내기'], ['circle', '원형'], ['morph', '모프']]
    : [['', '없음'], ['drift', '떠다니는 빛'], ['particles', '작은 점'], ['gradient', '색 흐름']];
  var html = '<p class="se-lab">' + (kind === 'tr' ? '이 장으로 들어올 때 전환' : '배경 움직임') + '</p><div class="se-chips">' + list.map(function (o) { return '<button type="button" data-sv="' + o[0] + '" aria-pressed="' + (o[0] === val) + '">' + o[1] + '</button>'; }).join('') + '</div>';
  var c = card('slidefx', kind === 'tr' ? '전환 효과' : '배경 움직임', html);
  if (!c) return;
  c.addEventListener('click', function (e) {
    var b = e.target.closest('[data-sv]'); if (!b) return;
    var v = b.getAttribute('data-sv'), tok = edit.begin(s), at = kind === 'tr' ? 'data-transition' : 'data-bg';
    if (v) s.setAttribute(at, v); else s.removeAttribute(at);
    prepareSlide(s); edit.commit(tok);
    $$('[data-sv]', c).forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
    if (kind === 'tr' && v && v !== 'none') previewSlide();
  });
}
function previewSlide() {
  var i = cur, was = settings.motion;
  endText(true); select([]);
  edit.toggle(false, true);
  if (!was) settings.motion = 2;
  applyMotionClasses();
  var prevI = i > 0 ? i - 1 : i;
  cur = -1; go(prevI, { instant: true }); if (prevI !== i) go(i); else go(i, { force: true });
  var back = function () { settings.motion = was; D.removeEventListener('pointerdown', back, true); D.removeEventListener('keydown', back, true); clearTimeout(t); edit.toggle(true); };
  var t = setTimeout(back, 3500);
  setTimeout(function () { D.addEventListener('pointerdown', back, true); D.addEventListener('keydown', back, true); }, 50);
}
edit.previewSlide = previewSlide;

/* ---------- 장 목록 (아래 띠) ---------- */
var thumbDirty = new Set();
function markThumb(s) { if (s) thumbDirty.add(s); clearTimeout(markThumb.t); markThumb.t = setTimeout(refreshThumbs, 400); }
function refreshThumbs() {
  if (!film) return;
  thumbDirty.forEach(function (s) { var b = film.querySelector('[data-i="' + slides.indexOf(s) + '"]'); if (b && b.__done) { var old = $('.se-thumb', b); if (old) old.remove(); b.insertBefore(thumb(s, 148), b.firstChild); } });
  thumbDirty.clear();
}
var filmIO = null;
function buildFilm() {
  if (!film || !editing) return;
  var strip = $('.se-film-strip', film);
  strip.innerHTML = '';
  if (filmIO) filmIO.disconnect();
  filmIO = 'IntersectionObserver' in W ? new IntersectionObserver(function (list) {
    list.forEach(function (en) { if (en.isIntersecting && !en.target.__done) { en.target.__done = true; en.target.insertBefore(thumb(slides[+en.target.getAttribute('data-i')], 148), en.target.firstChild); } });
  }, { root: strip }) : null;
  slides.forEach(function (s, i) {
    var b = mk('button', 'se-film-i' + (i === cur ? ' cur' : '') + (isHidden(i) ? ' hid' : ''));
    b.type = 'button'; b.setAttribute('data-i', i);
    b.innerHTML = '<span class="n">' + (i + 1) + '</span>' + (isHidden(i) ? '<span class="h">' + icon('eyeOff') + '</span>' : '');
    b.setAttribute('aria-label', (i + 1) + '. ' + titleOf(s));
    strip.appendChild(b);
    if (filmIO) filmIO.observe(b); else { b.__done = true; b.insertBefore(thumb(s, 148), b.firstChild); }
  });
  var add = mk('button', 'se-film-add'); add.type = 'button'; add.innerHTML = icon('plus'); add.setAttribute('aria-label', '새 장'); add.addEventListener('click', edit.addSlide);
  strip.appendChild(add);
  var c = $('.se-film-i.cur', strip); if (c) c.scrollIntoView({ inline: 'center', block: 'nearest' });
}
function filmCur() { if (!film) return; $$('.se-film-i', film).forEach(function (b) { b.classList.toggle('cur', +b.getAttribute('data-i') === cur); }); var c = $('.se-film-i.cur', film); if (c) c.scrollIntoView({ inline: 'nearest', block: 'nearest' }); }
function filmDrag(e) {
  var b = e.target.closest('.se-film-i'); if (!b || e.button !== 0) return;
  var from = +b.getAttribute('data-i'), sx = e.clientX, moving = false, to = from, mark = mk('i', 'se-film-mark');
  var strip = $('.se-film-strip', film);
  var mv = function (ev) {
    if (!moving && Math.abs(ev.clientX - sx) < 8) return;
    if (!moving) { moving = true; b.classList.add('drag'); strip.appendChild(mark); }
    var items = $$('.se-film-i', strip); to = items.length;
    for (var i = 0; i < items.length; i++) { var r = items[i].getBoundingClientRect(); if (ev.clientX < r.left + r.width / 2) { to = i; break; } }
    var ref = items[to] || $('.se-film-add', strip), rr = ref.getBoundingClientRect(), sr = strip.getBoundingClientRect();
    mark.style.left = (rr.left - sr.left + strip.scrollLeft - 5) + 'px';
    if (ev.clientX > sr.right - 40) strip.scrollLeft += 12; else if (ev.clientX < sr.left + 40) strip.scrollLeft -= 12;
  };
  var up = function () {
    D.removeEventListener('pointermove', mv); D.removeEventListener('pointerup', up);
    mark.remove(); b.classList.remove('drag');
    if (!moving) { go(from, { instant: true }); return; }
    if (to > from) to--;
    edit.moveSlide(from, to);
  };
  D.addEventListener('pointermove', mv); D.addEventListener('pointerup', up);
}

/* ---------- 점검 ---------- */
edit.check = function () {
  var out = [];
  slides.forEach(function (s, i) {
    var txt = s.textContent.replace(/\s+/g, '');
    var notes = $(':scope > aside.notes', s); if (notes) txt = txt.replace(notes.textContent.replace(/\s+/g, ''), '');
    if (!txt && !$('img,svg,canvas,video,.se-shape', s)) out.push({ i: i, kind: '빈 장', msg: '글자도 그림도 없어요' });
    $$('img', s).forEach(function (im) {
      if (rt.isRt(im)) return;
      if (im.complete && im.naturalWidth === 0 && im.getAttribute('src')) out.push({ i: i, kind: '깨진 그림', msg: (im.getAttribute('src') || '').split('/').pop().slice(0, 50), el: im.closest('figure') || im });
    });
    $$('*', s).forEach(function (e) {
      if (rt.isRt(e) || e.closest('aside.notes') || !e.firstChild) return;
      var own = Array.prototype.some.call(e.childNodes, function (n) { return n.nodeType === 3 && n.data.trim(); });
      if (!own) return;
      var over = e.scrollHeight > e.clientHeight + 4 && /hidden|auto|scroll|clip/.test(getComputedStyle(e).overflowY) || e.scrollWidth > e.clientWidth + 4 && /hidden|auto|scroll|clip/.test(getComputedStyle(e).overflowX);
      var r = rectIn(e, s), outside = r.w > 0 && (r.x + r.w > cfg.width + 2 || r.y + r.h > cfg.height + 2 || r.x < -2 || r.y < -2);
      if (over || outside) out.push({ i: i, kind: '넘치는 글자', msg: e.textContent.trim().slice(0, 30), el: e });
    });
  });
  var groups = ['넘치는 글자', '빈 장', '깨진 그림'];
  var html = out.length ? groups.map(function (g) {
    var list = out.filter(function (o) { return o.kind === g; });
    return '<p class="se-lab">' + g + ' · ' + list.length + '</p>' + (list.length ? '<div class="se-col">' + list.slice(0, 40).map(function (o, k) { return '<button type="button" class="se-chk" data-k="' + out.indexOf(o) + '"><b>' + (o.i + 1) + '</b><span></span></button>'; void k; }).join('') + '</div>' : '<p class="se-hint">없음</p>');
  }).join('') : '<p class="se-ok">' + icon('check') + '문제를 찾지 못했어요</p>';
  var c = card('check', '점검', html, { cls: 'se-card-tall' });
  if (!c) return out;
  $$('.se-chk', c).forEach(function (b) { b.querySelector('span').textContent = out[+b.getAttribute('data-k')].msg || ''; });
  c.addEventListener('click', function (e) {
    var b = e.target.closest('.se-chk'); if (!b) return;
    var o = out[+b.getAttribute('data-k')];
    go(o.i, { instant: true });
    if (o.el && o.el.isConnected) { var el = climb(o.el, slides[o.i]) || o.el; select([el]); }
  });
  return out;
};

/* ---------- 편집 모드 켜기 · 끄기 ---------- */
edit.toggle = function (on, quiet) {
  if (on === undefined) on = !editing;
  if (on === editing) { if (on && !quiet) { edit.toggle(false); } return; }
  if (on) {
    finishTransition();
    if (slides[cur]) { resetSlideState(slides[cur]); rt.cls(slides[cur], 'play', false); }
    editing = true;
    rt.cls(D.body, 'se-editing', true);
    applyMotionClasses();
    film.hidden = false;
    SE.setInsets(10, FILM_H);
    buildFilm();
    updateChrome();
    emit('editstart');
    relayout();
    if (!quiet) toast('편집 모드 · 요소를 눌러 고르고, 두 번 눌러 글자를 고쳐요');
  } else {
    endText(false); select([]); closePop();
    $$('[data-card]', ui).forEach(function (c) { var id = c.getAttribute('data-card'); if (id === 'check' || id === 'slidefx') closeCard(id); });
    editing = false;
    rt.cls(D.body, 'se-editing', false);
    film.hidden = true;
    SE.setInsets(0, 0);
    applyMotionClasses();
    var i = cur; cur = -1; go(i, { instant: true });
    emit('editend');
    relayout();
    if (dirty && !quiet) toast('편집한 내용은 아직 파일에 저장되지 않았어요 (편집 모드에서 Ctrl+S)', 3500);
  }
};
edit.isDirty = function () { return dirty; };
SE.editFan = function () {
  return [
    { label: '추가', icon: 'plus', sub: function () {
      return [
        { label: '글상자', icon: 'text', act: function () { edit.addText(); } },
        { label: '도형', icon: 'shape', sub: function () { return SHAPES.map(function (s) { return { label: s[1], icon: 'shape', act: function () { edit.addShape(s[0]); } }; }); } },
        { label: '그림', icon: 'image', act: edit.pickImage },
        { label: '핫스팟', icon: 'hot', act: function () { addHotspot(sel[0]); } }
      ];
    } },
    { label: '장', icon: 'slide', sub: function () {
      return [
        { label: '새 장', icon: 'plus', act: edit.addSlide },
        { label: '장 복제', icon: 'dup', act: edit.dupSlide },
        { label: isHidden(cur) ? '보이기' : '숨기기', icon: isHidden(cur) ? 'eye' : 'eyeOff', act: edit.toggleHide },
        { label: '장 지우기', icon: 'trash', act: edit.delSlide },
        { label: '전환 효과', icon: 'move', act: function () { slidePop('tr'); } },
        { label: '배경 움직임', icon: 'wave', act: function () { slidePop('bg'); } },
        { label: '장 미리보기', icon: 'play', act: previewSlide }
      ];
    } },
    { label: '점검', icon: 'check2', act: edit.check },
    { label: '메모', icon: 'notes', act: function () { SE.toggleNotes(); } },
    { label: '저장', icon: 'save', act: edit.save },
    { label: '편집 끝', icon: 'close', act: function () { edit.toggle(false); } }
  ];
};

/* ---------- 키 (편집 모드) ---------- */
SE.on('editkey', function (e) {
  var code = e.code, ctrl = e.ctrlKey || e.metaKey, sh = e.shiftKey;
  if (ctrl && code === 'KeyS') { edit.save(); return true; }
  if (ctrl && code === 'KeyZ' && !sh) { edit.undo(); return true; }
  if (ctrl && (code === 'KeyY' || (sh && code === 'KeyZ'))) { edit.redo(); return true; }
  if (ctrl && code === 'KeyC') { copySel(false); return true; }
  if (ctrl && code === 'KeyX') { copySel(true); return true; }
  if (ctrl && code === 'KeyD') { dupSel(); return true; }
  if (ctrl && code === 'KeyA') { var s = slides[cur]; select(Array.prototype.filter.call(s.children, function (x) { return isSelectable(x, s); })); return true; }
  if (ctrl && (code === 'BracketRight' || code === 'BracketLeft')) { arrange(code === 'BracketRight' ? (sh ? 'front' : 'fwd') : (sh ? 'bottomz' : 'back')); return true; }
  if (ctrl) return false;
  if (e.key === 'Escape') {
    if (popEl && !popEl.hidden) { closePop(); return true; }
    var ids = Object.keys(cardsOpen); if (ids.length) { closeCard(ids[ids.length - 1]); return true; }
    if (SE.closeFan()) return true;
    if (sel.length) { select([]); return true; }
    edit.toggle(false); return true;
  }
  if (code === 'Delete' || code === 'Backspace') { if (sel.length) delSel(); return true; }
  var arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (code in arrows) {
    if (sel.length) { var k = sh ? 10 : 1; nudge(arrows[code][0] * k, arrows[code][1] * k); }
    else if (code === 'ArrowLeft' || code === 'ArrowUp') go(cur - 1, { instant: true }); else go(cur + 1, { instant: true });
    return true;
  }
  if (code === 'PageDown') { go(cur + 1, { instant: true }); return true; }
  if (code === 'PageUp') { go(cur - 1, { instant: true }); return true; }
  if ((code === 'Enter' || code === 'F2') && sel.length === 1) { startText(sel[0]); return true; }
  if (code === 'KeyE' && !sh) { edit.toggle(false); return true; }
  if (code === 'KeyF' && !sh) { SE.toggleFull(); return true; }
  if (code === 'KeyN' && !sh) { SE.toggleNotes(); return true; }
  if (code === 'Slash' && sh) { SE.openHelp(); return true; }
  return false;
});
// 글자를 고치는 중: Esc 는 고치기 끝, Enter 는 줄바꿈, 붙여넣기는 글자만
SE.on('keyfirst', function (e) {
  if (!textEl) return false;
  if (e.key === 'Escape') { e.preventDefault(); endText(true); return true; }
  if (e.key === 'Enter' && !e.shiftKey && !textEl.closest('[data-se-proxy]')) { e.preventDefault(); D.execCommand('insertLineBreak'); return true; }
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') { e.preventDefault(); edit.save(); return true; }
  return false;
});

inits.push(function () {
  selLayer = mk('div', 'se-sel'); guidesEl = mk('div', 'se-guides');
  pill = mk('div', 'se-pill'); pill.hidden = true;
  popEl = mk('div', 'se-popover'); popEl.hidden = true;
  film = mk('div', 'se-film'); film.hidden = true;
  film.innerHTML = '<div class="se-film-tools"><button type="button" data-f="undo" aria-label="되돌리기 (Ctrl+Z)">' + icon('undo') + '</button><button type="button" data-f="redo" aria-label="다시 하기 (Ctrl+Y)">' + icon('redo') + '</button><button type="button" data-f="save" class="se-save">' + icon('save') + '저장</button><span class="se-film-state">편집 중</span></div><div class="se-film-strip"></div>';
  [selLayer, guidesEl, pill, popEl, film].forEach(function (x) { ui.appendChild(x); });
  pill.addEventListener('click', onPill);
  ['click', 'input', 'change'].forEach(function (t) { popEl.addEventListener(t, onPop); });
  selLayer.addEventListener('pointerdown', onStageDown);
  D.addEventListener('pointerdown', onEditDown);
  D.addEventListener('dblclick', onEditDbl);
  film.addEventListener('pointerdown', filmDrag);
  film.addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (!b) return; var f = b.getAttribute('data-f'); if (f === 'undo') edit.undo(); else if (f === 'redo') edit.redo(); else edit.save(); });
  film.addEventListener('contextmenu', function (e) {
    var b = e.target.closest('.se-film-i'); if (!b) return; e.preventDefault();
    go(+b.getAttribute('data-i'), { instant: true });
    SE.openFan(SE.editFan()[1].sub(), true);
  });
  D.addEventListener('paste', function (e) {
    if (!editing || textEl) {
      if (textEl) { e.preventDefault(); var t = (e.clipboardData || W.clipboardData).getData('text/plain'); D.execCommand('insertText', false, t); }
      return;
    }
    var cd = e.clipboardData; if (!cd) return;
    var file = Array.prototype.slice.call(cd.files || []).filter(function (f) { return /^image\//.test(f.type); })[0];
    e.preventDefault();
    if (file) { addImageFile(file, null, sel[0]); return; }
    var text = cd.getData('text/plain');
    if (clip && text === clip.text) { pasteClip(); return; }
    if (text && text.trim()) edit.addText(null, null, text.trim()); else pasteClip();
  });
  W.addEventListener('dragover', function (e) { if (editing) { e.preventDefault(); rt.cls(D.body, 'se-dropping', true); } });
  W.addEventListener('dragleave', function (e) { if (!e.relatedTarget) rt.cls(D.body, 'se-dropping', false); });
  W.addEventListener('drop', function (e) {
    rt.cls(D.body, 'se-dropping', false);
    if (!editing) return;
    e.preventDefault();
    var f = Array.prototype.slice.call(e.dataTransfer.files || []).filter(function (x) { return /^image\//.test(x.type); })[0];
    if (!f) return;
    var under = D.elementsFromPoint(e.clientX, e.clientY).filter(function (x) { return !x.closest('#se-ui'); })[0];
    var img = under && (under.tagName === 'IMG' ? under : under.closest && under.closest('figure') && $(':scope > img', under.closest('figure')));
    addImageFile(f, toStage(e.clientX, e.clientY), img || null);
  });
  W.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  SE.on('enter', function () { if (editing) { select([]); filmCur(); } });
  SE.on('resize', function () { drawSel(); if (cardsOpen.check) { /* 위치 그대로 */ } });
  SE.on('layout', drawSel);
  setTimeout(checkRecovery, 300);
});
