/* =====================================================================
   슬라이드 엔진 · 핵심
   무대 맞춤, 장 이동, 단계, 전환, 모션(등장·강조·퇴장·숫자·도식·배경·상호작용),
   실행 중에만 붙는 표시(rt)와 저장용 정리.
   이 파일들은 tools/engine/inject.py 가 하나로 묶어 슬라이드 HTML 안에 넣는다.
   ===================================================================== */
var D = document, W = window;
var SE = W.SE = W.SE || {};
SE.version = '1.0';

/* ---------- 작은 도구 ---------- */
function $(s, r) { return (r || D).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
function mk(tag, cls, html) { var e = D.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function num(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
var PATH = (function () { try { return decodeURIComponent(location.pathname); } catch (e) { return location.pathname; } })();
var store = {
  get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 공간이 없으면 넘어간다 */ } },
  del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* 무시 */ } }
};
function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + s.length; }

/* ---------- 알림(이벤트) ---------- */
var handlers = {};
SE.on = function (ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); return SE; };
function emit(ev) {
  var a = Array.prototype.slice.call(arguments, 1), r;
  (handlers[ev] || []).forEach(function (fn) {
    try { var v = fn.apply(null, a); if (v !== undefined) r = v; } catch (e) { console.error('[SE] ' + ev, e); }
  });
  return r;
}
SE.emit = emit;
// 처음으로 true 를 돌려준 처리기에서 멈춘다 (키·클릭처럼 한 곳만 처리해야 할 때)
function until(ev) {
  var a = Array.prototype.slice.call(arguments, 1), list = handlers[ev] || [];
  for (var i = 0; i < list.length; i++) { try { if (list[i].apply(null, a) === true) return true; } catch (e) { console.error('[SE] ' + ev, e); } }
  return false;
}

/* ---------- 설정 ---------- */
var cfg = {
  width: 1920, height: 1080,
  transition: 'fade',        // 장에 data-transition 이 없을 때
  sections: {},              // data-part(또는 data-section) 값 → 목차에 보일 이름
  hiddenLabel: '숨김',        // 쪽 번호 옆에 붙는 말
  stepLabel: '',             // 남은 단계가 있을 때 쪽 번호 옆 표시 (예: '답')
  progress: true,            // 엔진의 얇은 진행 막대
  skipHidden: true,          // 처음에 숨긴 장을 건너뛸지
  shapeColor: '#2F4BC8'
};
SE.config = function (o) { for (var k in o) cfg[k] = o[k]; return cfg; };

var osReduce = W.matchMedia ? W.matchMedia('(prefers-reduced-motion: reduce)') : null;
var saved = store.get('se-settings', {});
var settings = {
  motion: saved.motion != null ? saved.motion : (osReduce && osReduce.matches ? 0 : 2), // 0 끄기 1 차분 2 기본 3 화려
  speed: saved.speed || 1,
  theme: saved.theme || 'default',
  corner: saved.corner || 'bl',
  sound: saved.sound !== false
};
function saveSettings() { store.set('se-settings', settings); }
SE.settings = settings;

/* ---------- 실행 중에만 붙는 것(rt): 저장할 때 원래대로 되돌린다 ----------
   rt.cls / rt.css / rt.attr / rt.html 로 바꾼 것은 원래 값을 기억해 두고,
   rt.node 로 만든 요소(data-se-rt)는 저장할 때 빠진다. */
var RT = new WeakMap();
function rec(e) { var r = RT.get(e); if (!r) { r = {}; RT.set(e, r); } return r; }
var rt = SE.rt = {
  cls: function (e, name, on) {
    if (!e) return;
    var r = rec(e); r.cls = r.cls || {};
    if (!(name in r.cls)) r.cls[name] = e.classList.contains(name);
    e.classList.toggle(name, on === undefined ? true : !!on);
  },
  css: function (e, prop, val) {
    var r = rec(e); r.css = r.css || {};
    if (!(prop in r.css)) r.css[prop] = [e.style.getPropertyValue(prop), e.style.getPropertyPriority(prop)];
    if (val == null || val === '') e.style.removeProperty(prop); else e.style.setProperty(prop, val);
  },
  attr: function (e, name, val) {
    var r = rec(e); r.attr = r.attr || {};
    if (!(name in r.attr)) r.attr[name] = e.getAttribute(name);
    if (val == null || val === false) e.removeAttribute(name); else e.setAttribute(name, val === true ? '' : val);
  },
  html: function (e, html) { var r = rec(e); if (r.html == null) r.html = e.innerHTML; if (html != null) e.innerHTML = html; },
  keepHtml: function (e) { var r = rec(e); if (r.html == null) r.html = e.innerHTML; },
  node: function (n) { n.setAttribute('data-se-rt', ''); return n; },
  has: function (e, kind, name) { var r = RT.get(e); return !!(r && r[kind] && (name in r[kind])); },
  forget: function (e, kind, name) {
    var r = RT.get(e); if (!r) return;
    if (kind === 'html') r.html = null; else if (r[kind]) delete r[kind][name];
  },
  // rt.html 로 바꾼 내용을 원래대로 (글자를 고치기 전)
  restoreHtml: function restore(e) {
    var r = RT.get(e);
    if (r && r.html != null) { e.innerHTML = r.html; r.html = null; e.__seSplit = null; return; }
    Array.prototype.forEach.call(e.children, restore);
  },
  isRt: function (n) { return !!(n && n.closest && n.closest('[data-se-rt]')); }
};

// rt 노드 안으로는 들어가지 않고 요소를 차례대로 모은다 (살아 있는 문서와 복사본이 같은 순서가 되도록)
function listEls(root) {
  var out = [];
  (function walk(e) { out.push(e); if (e.hasAttribute && e.hasAttribute('data-se-rt')) return; for (var c = e.firstElementChild; c; c = c.nextElementSibling) walk(c); })(root);
  return out;
}
// clone 은 live.cloneNode(true) 로 막 만든 복사본이어야 한다
function cleanTree(live, clone) {
  var a = listEls(live), b = listEls(clone), n = Math.min(a.length, b.length), i, r;
  for (i = 0; i < n; i++) {
    r = RT.get(a[i]); if (!r) continue;
    var c = b[i], k;
    if (r.cls) for (k in r.cls) c.classList.toggle(k, r.cls[k]);
    if (r.css) for (k in r.css) { if (r.css[k][0]) c.style.setProperty(k, r.css[k][0], r.css[k][1]); else c.style.removeProperty(k); }
    if (r.attr) for (k in r.attr) { if (r.attr[k] == null) c.removeAttribute(k); else c.setAttribute(k, r.attr[k]); }
  }
  for (i = n - 1; i >= 0; i--) { r = RT.get(a[i]); if (r && r.html != null) b[i].innerHTML = r.html; }
  $$('[data-se-rt]', clone).forEach(function (x) { x.parentNode && x.parentNode.removeChild(x); });
  [clone].concat($$('[style],[class]', clone)).forEach(function (e) {
    if (e.getAttribute('style') === '') e.removeAttribute('style');
    if (e.getAttribute('class') === '') e.removeAttribute('class');
  });
  return clone;
}
function cleanClone(live) { return cleanTree(live, live.cloneNode(true)); }
SE.cleanClone = cleanClone;
function serialize() {
  emit('beforeserialize');
  var clone = cleanClone(D.documentElement);
  emit('clean', clone);
  return '<!doctype html>\n' + clone.outerHTML;
}
SE.serialize = serialize;

/* ---------- 무대 · 장 ---------- */
var stage, deck, viewport, slides = [], cur = -1, editing = false, inits = [];
var stepGroups = [], stepPos = 0, skipHidden = true;
var numEl, progEl, digitBuf = '', digitTimer = null;

function refreshSlides() { slides = $$(':scope > .slide', deck); SE.slides = slides; return slides; }
function slideKey(s) { return s.getAttribute('data-id') || s.getAttribute('data-n') || ('i' + slides.indexOf(s)); }
function isHidden(i) { return !!slides[i] && slides[i].hasAttribute('data-hidden'); }
function scale() { return stage.getBoundingClientRect().width / cfg.width; }
SE.scale = scale;
SE.current = function () { return slides[cur]; };
SE.index = function () { return cur; };

var bottomSpace = 0, topSpace = 0;
function fit() {
  var w = W.innerWidth, h = W.innerHeight - bottomSpace - topSpace;
  var s = Math.min(w / cfg.width, h / cfg.height);
  var x = (w - cfg.width * s) / 2, y = topSpace + (h - cfg.height * s) / 2;
  rt.css(stage, 'transform', 'translate(' + x + 'px,' + y + 'px) scale(' + s + ')');
  emit('resize', s);
}
SE.setInsets = function (top, bottom) { topSpace = top; bottomSpace = bottom; fit(); };
// 무대 좌표 (1920×1080) 로 바꾸기
function toStage(cx, cy) { var r = stage.getBoundingClientRect(), s = r.width / cfg.width; return { x: (cx - r.left) / s, y: (cy - r.top) / s }; }
function rectIn(el, ref) {
  var r = el.getBoundingClientRect(), b = (ref || stage).getBoundingClientRect(), s = scale();
  return { x: (r.left - b.left) / s, y: (r.top - b.top) / s, w: r.width / s, h: r.height / s };
}
SE.toStage = toStage;

/* ---------- 모션 수준 ---------- */
function level() { return editing ? 0 : settings.motion; }
function speed() { return settings.speed || 1; }
function applyMotionClasses() {
  var l = level();
  rt.cls(stage, 'motion', l > 0);
  rt.cls(stage, 'se-calm', l === 1);
  rt.cls(stage, 'se-vivid', l === 3);
  rt.attr(D.documentElement, 'data-se-theme', settings.theme === 'dark' ? 'dark' : null);
}
SE.setMotion = function (l) { settings.motion = clamp(l, 0, 3); saveSettings(); applyMotionClasses(); emit('settings'); };
SE.setSpeed = function (v) { settings.speed = v; saveSettings(); emit('settings'); };
SE.setTheme = function (t) { settings.theme = t; saveSettings(); applyMotionClasses(); emit('settings'); };

var EASE = 'cubic-bezier(.16,1,.3,1)', EASE_IO = 'cubic-bezier(.7,0,.2,1)';
var engineAnims = [];
function anim(e, kf, o) {
  if (!e.animate) return null;
  var a = e.animate(kf, o);
  a.__se = true;
  a.playbackRate = speed();
  engineAnims.push(a);
  if (engineAnims.length > 400) engineAnims = engineAnims.filter(function (x) { return x.playState !== 'finished' && x.playState !== 'idle'; });
  return a;
}
function cancelAnims(root) {
  engineAnims = engineAnims.filter(function (a) {
    var t = a.effect && a.effect.target;
    if (!root || (t && (t === root || root.contains(t)))) { try { a.cancel(); } catch (e) { /* 무시 */ } return false; }
    return true;
  });
}
// 차분: 슬라이드 안의 CSS 움직임을 짧은 페이드로 바꾼다. 속도: 모든 움직임의 재생 속도를 바꾼다.
function tune(root) {
  if (!root || !root.getAnimations) return;
  var l = level(), sp = speed();
  root.getAnimations({ subtree: true }).forEach(function (a) {
    if (a.__tuned) return;
    a.__tuned = true;
    if (!a.__se && l === 1 && a.effect && a.effect.setKeyframes) {
      try {
        a.effect.setKeyframes([{ opacity: 0 }, { opacity: 1 }]);
        var t = a.effect.getTiming();
        a.effect.updateTiming({ iterations: 1, duration: Math.min(num(t.duration, 500), 500) });
      } catch (e) { /* 무시 */ }
    }
    if (!a.__se) a.playbackRate = sp;
  });
}
function baseDelay(s) { var v = getComputedStyle(s).getPropertyValue('--base').trim(); return v ? num(v, 0.3) * (/ms$/.test(v) ? 0.001 : 1) : 0.3; }

/* ---------- 글자 나누기 (단어씩 · 글자씩 · 타자기) ---------- */
function split(el, mode) {
  if (el.__seSplit === mode) return $$('.se-u', el);
  if (el.__seSplit) rt.restoreHtml(el);
  rt.keepHtml(el);
  var units = [], nodes = [], tw = D.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (tw.nextNode()) nodes.push(tw.currentNode);
  nodes.forEach(function (t) {
    if (rt.isRt(t.parentNode) || !t.data.trim() && !/\S/.test(t.data)) { return; }
    var frag = D.createDocumentFragment();
    t.data.split(/(\s+)/).forEach(function (w) {
      if (!w) return;
      if (/^\s+$/.test(w)) { frag.appendChild(D.createTextNode(w)); return; }
      if (mode === 'words') { var s = mk('span', 'se-u'); s.textContent = w; frag.appendChild(s); units.push(s); return; }
      var wd = mk('span', 'se-wd');
      Array.from(w).forEach(function (ch) { var c = mk('span', 'se-u'); c.textContent = ch; wd.appendChild(c); units.push(c); });
      frag.appendChild(wd);
    });
    t.parentNode.replaceChild(frag, t);
  });
  units.forEach(function (u, i) { u.style.setProperty('--i', i); });
  el.__seSplit = mode;
  return units;
}
SE.split = split;

/* ---------- 등장 ---------- */
var ENTER = {
  fade: function () { return [{ opacity: 0 }, { opacity: 1 }]; },
  up: function (d) { return [{ opacity: 0, translate: '0 ' + 70 * d + 'px' }, { opacity: 1, translate: '0 0' }]; },
  left: function (d) { return [{ opacity: 0, translate: -160 * d + 'px 0' }, { opacity: 1, translate: '0 0' }]; },
  right: function (d) { return [{ opacity: 0, translate: 160 * d + 'px 0' }, { opacity: 1, translate: '0 0' }]; },
  pop: function (d) { return [{ opacity: 0, scale: '.3' }, { opacity: 1, scale: String(1 + .1 * d), offset: .6 }, { opacity: 1, scale: '1' }]; },
  drop: function (d) { return [{ opacity: 0, translate: '0 ' + -240 * d + 'px' }, { opacity: 1, translate: '0 0', offset: .55 }, { translate: '0 ' + -34 * d + 'px', offset: .75 }, { translate: '0 0', offset: .9 }, { translate: '0 ' + -6 * d + 'px', offset: .95 }, { opacity: 1, translate: '0 0' }]; },
  blur: function () { return [{ opacity: 0, filter: 'blur(22px)', scale: '1.15' }, { opacity: 1, filter: 'blur(0px)', scale: '1' }]; },
  zoom: function () { return [{ opacity: 0, scale: '1.6' }, { opacity: 1, scale: '1' }]; }
};
SE.entrances = ENTER;
function playEntrance(el, delay) {
  var type = el.getAttribute('data-anim');
  if (!type) return;
  var l = level(); if (!l) return;
  var d = l === 3 ? 1.5 : 1, dur = num(el.getAttribute('data-dur'), l === 3 ? 0.95 : 0.8) * 1000;
  var wait = (delay + num(el.getAttribute('data-delay'), 0)) * 1000;
  if (l === 1) { anim(el, ENTER.fade(), { duration: 500, delay: wait, fill: 'both' }); return; }
  if (type === 'words' || type === 'chars') {
    var u = split(el, type), gap = type === 'words' ? 90 : 35;
    u.forEach(function (s, i) { anim(s, type === 'words' ? ENTER.up(d * .6) : ENTER.pop(d), { duration: type === 'words' ? 650 : 450, delay: wait + i * gap, easing: EASE, fill: 'both' }); });
    return;
  }
  if (type === 'type') {
    var c = split(el, 'chars'), step = num(el.getAttribute('data-speed'), 45);
    c.forEach(function (s, i) { anim(s, [{ opacity: 0 }, { opacity: 1 }], { duration: 1, delay: wait + i * step, fill: 'both' }); });
    var caret = rt.node(mk('span', 'se-caret'));
    el.appendChild(caret);
    anim(caret, [{ opacity: 1 }, { opacity: 0 }], { duration: 500, iterations: Math.ceil((c.length * step + 1200) / 500), direction: 'alternate' });
    setTimeout(function () { caret.remove(); }, wait + c.length * step + 1200);
    return;
  }
  if (type === 'stagger') {
    Array.prototype.forEach.call(el.children, function (ch, i) {
      if (rt.isRt(ch)) return;
      anim(ch, ENTER.up(d * .8), { duration: dur, delay: wait + i * 140, easing: EASE, fill: 'both' });
    });
    return;
  }
  var kf = (ENTER[type] || ENTER.fade)(d);
  anim(el, kf, { duration: dur, delay: wait, easing: type === 'drop' ? 'ease-out' : EASE, fill: 'both' });
}

/* ---------- 숫자 올라가기 · 막대 자라기 · 선 그리기 ---------- */
function countUp(el, delay) {
  var r = rec(el);
  if (r.html == null) r.html = el.innerHTML;
  var txt = el.textContent, m = /^(\D*?)(-?[\d,]+(?:\.\d+)?)(.*)$/.exec(txt.trim());
  if (!m) { r.html = null; return; }
  var to = parseFloat(m[2].replace(/,/g, '')), dec = (m[2].split('.')[1] || '').length, comma = m[2].indexOf(',') >= 0;
  var fromAttr = el.getAttribute('data-count');
  var from = fromAttr !== null && fromAttr !== '' ? num(fromAttr, 0) : 0;
  var dur = num(el.getAttribute('data-dur'), 1.1) * 1000 / speed();
  var start = performance.now() + delay * 1000 / speed();
  var fmt = function (v) { var s = v.toFixed(dec); if (comma) s = s.replace(/\B(?=(\d{3})+(?!\d))/g, ','); return m[1] + s + m[3]; };
  var gen = el.__seCount = (el.__seCount || 0) + 1;
  el.textContent = fmt(from);
  function tick(now) {
    if (el.__seCount !== gen) return;
    var p = clamp((now - start) / dur, 0, 1), e = 1 - Math.pow(1 - p, 4);
    if (p >= 1) { finishCount(el); return; }
    el.textContent = fmt(from + (to - from) * e);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
function finishCount(el) {
  el.__seCount = (el.__seCount || 0) + 1;
  var r = RT.get(el);
  if (r && r.html != null && !el.__seSplit) { el.innerHTML = r.html; r.html = null; }
}
function runDiagrams(root, delay) {
  if (!level()) return;
  var list = $$('[data-count],[data-bar],[data-draw]', root);
  if (root.matches && root.matches('[data-count],[data-bar],[data-draw]')) list.unshift(root);
  list.forEach(function (e) {
    if (hiddenByStep(e)) return;
    var dl = delay + num(e.getAttribute('data-delay'), 0);
    if (e.hasAttribute('data-count')) {
      if (level() === 1) return;
      countUp(e, dl);
    }
    if (e.hasAttribute('data-bar')) {
      var y = e.getAttribute('data-bar') === 'y';
      anim(e, [{ scale: y ? '1 0' : '0 1', transformOrigin: y ? '50% 100%' : '0 50%' }, { scale: '1 1', transformOrigin: y ? '50% 100%' : '0 50%' }], { duration: num(e.getAttribute('data-dur'), 1) * 1000, delay: dl * 1000, easing: EASE, fill: 'both' });
    }
    if (e.hasAttribute('data-draw')) {
      $$('path,line,polyline,polygon,circle,ellipse,rect', e).forEach(function (p, i) {
        rt.attr(p, 'pathLength', '1');
        rt.css(p, 'stroke-dasharray', '1');
        anim(p, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: num(e.getAttribute('data-dur'), 1.4) * 1000, delay: (dl + i * .15) * 1000, easing: 'ease-in-out', fill: 'both' });
      });
    }
  });
}
function hiddenByStep(e) { var s = e.closest('[data-step]'); return !!(s && !s.classList.contains('se-on')); }

/* ---------- 강조 ---------- */
var SVGNS = 'http://www.w3.org/2000/svg';
function drawSvg(cls, viewBox, d, host) {
  var svg = D.createElementNS(SVGNS, 'svg'); svg.setAttribute('class', cls); svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('data-se-rt', '');
  var p = D.createElementNS(SVGNS, 'path'); p.setAttribute('d', d); p.setAttribute('pathLength', '1'); p.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.appendChild(p);
  if (getComputedStyle(host).position === 'static') rt.css(host, 'position', 'relative');
  host.appendChild(svg);
  return { svg: svg, path: p };
}
function emphOn(el, animate) {
  var t = el.getAttribute('data-emph'), go = animate && level() > 0, made = el.__seEmph = el.__seEmph || [];
  var dur = 1000 / speed();
  if (t === 'pulse' && go) anim(el, [{ scale: '1' }, { scale: '1.12' }, { scale: '1' }, { scale: '1.12' }, { scale: '1' }], { duration: 1100, easing: 'ease-in-out' });
  else if (t === 'shake' && go) anim(el, [0, -18, 16, -12, 9, -5, 0].map(function (x) { return { translate: x + 'px 0' }; }), { duration: 700, easing: 'ease-out' });
  else if (t === 'glow') { rt.cls(el, 'se-glow', true); if (go) anim(el, [{ filter: 'drop-shadow(0 0 0 rgba(255,214,0,0))' }, { filter: 'drop-shadow(0 0 30px rgba(255,214,0,1))' }, { filter: 'drop-shadow(0 0 14px rgba(255,214,0,.85))' }], { duration: 1200, easing: 'ease-out' }); }
  else if (t === 'mark') {
    if (!el.__seMark) { rt.keepHtml(el); el.innerHTML = '<span class="se-markin">' + el.innerHTML + '</span>'; el.__seMark = true; }
    var mi = el.firstElementChild;
    if (go) anim(mi, [{ backgroundSize: '0% 100%' }, { backgroundSize: '100% 100%' }], { duration: 900, easing: 'ease-in-out', fill: 'both' });
  } else if (t === 'underline' || t === 'circle') {
    var o = t === 'underline'
      ? drawSvg('se-underline', '0 0 100 10', 'M1 6 C 25 3, 55 9, 99 4', el)
      : drawSvg('se-circle', '0 0 100 100', 'M 90 32 C 84 6, 12 4, 5 42 C 0 80, 64 98, 93 66 C 103 50, 92 22, 62 14', el);
    made.push(o.svg);
    if (go) anim(o.path, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: t === 'circle' ? 900 : 600, easing: 'ease-in-out', fill: 'both' });
    else o.path.style.strokeDashoffset = '0';
  } else if (t === 'spotlight') {
    var s = el.closest('.slide'), r = rectIn(el, s), pad = 26;
    var sp = rt.node(mk('div', 'se-spot'));
    sp.style.cssText = 'left:' + (r.x - pad) + 'px;top:' + (r.y - pad) + 'px;width:' + (r.w + pad * 2) + 'px;height:' + (r.h + pad * 2) + 'px';
    s.appendChild(sp); made.push(sp);
    if (go) anim(sp, [{ opacity: 0 }, { opacity: 1 }], { duration: 500, fill: 'both' });
  }
  void dur;
}
function emphOff(el) {
  (el.__seEmph || []).forEach(function (n) { n.remove(); });
  el.__seEmph = [];
  if (el.__seMark) { rt.restoreHtml(el); el.__seMark = false; }
  rt.cls(el, 'se-glow', false);
}

/* ---------- 퇴장 ---------- */
function exitOn(el, animate) {
  var t = el.getAttribute('data-exit'), go = animate && level() > 0;
  if (t === 'strike') {
    var o = drawSvg('se-strike', '0 0 100 10', 'M0 5.5 L100 4.5', el);
    (el.__seExit = el.__seExit || []).push(o.svg);
    rt.cls(el, 'se-struck', true);
    if (go) anim(o.path, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 500, easing: 'ease-in-out', fill: 'both' });
    else o.path.style.strokeDashoffset = '0';
    return;
  }
  var kf = t === 'shrink' ? [{ scale: '1', opacity: 1 }, { scale: '0', opacity: 0 }]
    : t === 'fly' ? [{ translate: '0 0', opacity: 1 }, { translate: '0 -260px', opacity: 0 }]
      : [{ opacity: 1 }, { opacity: 0 }];
  if (go) { var a = anim(el, kf, { duration: 600, easing: EASE_IO, fill: 'forwards' }); if (a) a.onfinish = function () { rt.cls(el, 'se-gone', true); a.cancel(); }; }
  else rt.cls(el, 'se-gone', true);
}
function exitOff(el) {
  (el.__seExit || []).forEach(function (n) { n.remove(); }); el.__seExit = [];
  rt.cls(el, 'se-struck', false); rt.cls(el, 'se-gone', false); cancelAnims(el);
}

/* ---------- 단계 ---------- */
function buildSteps(s) {
  var evs = [], last = 0;
  $$('[data-step],[data-emph-step],[data-exit]', s).forEach(function (e) {
    if (e.closest('aside.notes')) return;
    [['in', 'data-step'], ['emph', 'data-emph-step'], ['exit', 'data-exit']].forEach(function (t) {
      if (!e.hasAttribute(t[1])) return;
      if (t[0] === 'emph' && !e.hasAttribute('data-emph')) return;
      var v = t[0] === 'exit' ? e.getAttribute('data-exit-step') : e.getAttribute(t[1]);
      var o = parseFloat(v);
      if (isNaN(o)) o = ++last; else last = Math.max(last, o);
      evs.push({ el: e, type: t[0], order: o, i: evs.length });
    });
  });
  evs.sort(function (a, b) { return a.order - b.order || a.i - b.i; });
  var groups = [], prev = null;
  evs.forEach(function (ev) { if (prev === null || ev.order !== prev) { groups.push([]); prev = ev.order; } groups[groups.length - 1].push(ev); });
  return groups;
}
function stepIn(el, animate) {
  rt.cls(el, 'se-on', true);
  if (!animate || !level()) { autoEmph(el, false); return; }
  playEntrance(el, 0);
  $$('[data-anim]', el).forEach(function (c) { if (!hiddenByStep(c)) playEntrance(c, 0); });
  runDiagrams(el, 0);
  autoEmph(el, true, 0.8);
  requestAnimationFrame(function () { tune(el); });
}
function stepOut(el) {
  rt.cls(el, 'se-on', false); cancelAnims(el);
  [el].concat($$('[data-emph]:not([data-emph-step])', el)).forEach(function (x) { if (x.hasAttribute('data-emph')) emphOff(x); });
  $$('[data-count]', el).forEach(finishCount);
}
function autoEmph(root, animate, delay) {
  var list = $$('[data-emph]:not([data-emph-step])', root);
  if (root.matches && root.matches('[data-emph]:not([data-emph-step])')) list.unshift(root);
  list.forEach(function (e) {
    if (hiddenByStep(e)) return;
    emphOff(e);
    if (animate && level()) {
      var t = setTimeout(function () { if (e.closest('.slide.active')) emphOn(e, true); }, (delay + num(e.getAttribute('data-emph-delay'), 0.6)) * 1000 / speed());
      timers.push(t);
    } else emphOn(e, false);
  });
}
var timers = [];
function applyGroup(g, animate) {
  g.forEach(function (ev) {
    if (ev.type === 'in') stepIn(ev.el, animate);
    else if (ev.type === 'emph') { emphOff(ev.el); emphOn(ev.el, animate); }
    else exitOn(ev.el, animate);
  });
}
function unapplyGroup(g) {
  g.slice().reverse().forEach(function (ev) {
    if (ev.type === 'in') stepOut(ev.el);
    else if (ev.type === 'emph') emphOff(ev.el);
    else exitOff(ev.el);
  });
}
function resetSlideState(s) {
  timers.forEach(clearTimeout); timers = [];
  cancelAnims(s);
  $$('.se-on', s).forEach(function (e) { rt.cls(e, 'se-on', false); });
  $$('[data-emph]', s).forEach(emphOff);
  $$('[data-exit]', s).forEach(exitOff);
  $$('[data-count]', s).forEach(finishCount);
  $$('.se-flipped,.se-open,.se-right,.se-wrong', s).forEach(function (e) { ['se-flipped', 'se-open', 'se-right', 'se-wrong'].forEach(function (c) { rt.cls(e, c, false); }); });
  $$('.se-pop', s).forEach(function (p) { p.remove(); });
}
function stepsLeft() { return stepPos < stepGroups.length; }
SE.stepsLeft = stepsLeft;

/* ---------- 전환 ---------- */
var TRANS = {};
SE.defineTransition = function (name, fn) { TRANS[name] = fn; };
function tAnim(e, kf, o) { var a = anim(e, kf, o); if (a) a.__trans = true; return a; }
TRANS.fade = function (f, t, dir, o) { return [tAnim(t, [{ opacity: 0 }, { opacity: 1 }], o)]; };
TRANS.push = function (f, t, dir, o) {
  return [tAnim(t, [{ translate: dir * 100 + '% 0' }, { translate: '0 0' }], o), f && tAnim(f, [{ translate: '0 0' }, { translate: -dir * 100 + '% 0' }], o)];
};
TRANS.cover = function (f, t, dir, o) {
  return [tAnim(t, [{ translate: dir * 100 + '% 0', boxShadow: '0 0 80px rgba(0,0,0,.4)' }, { translate: '0 0', boxShadow: '0 0 80px rgba(0,0,0,0)' }], o), f && tAnim(f, [{ filter: 'brightness(1)' }, { filter: 'brightness(.6)' }], o)];
};
TRANS.zoom = function (f, t, dir, o) {
  return [tAnim(t, [{ opacity: 0, scale: dir > 0 ? '.82' : '1.18' }, { opacity: 1, scale: '1' }], o), f && tAnim(f, [{ opacity: 1, scale: '1' }, { opacity: 0, scale: dir > 0 ? '1.18' : '.82' }], o)];
};
TRANS.flip = function (f, t, dir, o) {
  var h = Object.assign({}, o, { duration: o.duration / 2 });
  return [
    f && tAnim(f, [{ transform: 'perspective(2400px) rotateY(0deg)' }, { transform: 'perspective(2400px) rotateY(' + -dir * 90 + 'deg)' }], Object.assign({}, h, { easing: 'ease-in', fill: 'forwards' })),
    tAnim(t, [{ transform: 'perspective(2400px) rotateY(' + dir * 90 + 'deg)' }, { transform: 'perspective(2400px) rotateY(0deg)' }], Object.assign({}, h, { delay: h.duration, easing: 'ease-out' }))
  ];
};
TRANS.wipe = function (f, t, dir, o) {
  return [
    tAnim(t, [{ clipPath: dir > 0 ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], Object.assign({}, o, { easing: EASE_IO })),
    f && tAnim(f, [{ translate: '0 0', scale: '1', filter: 'brightness(1)' }, { translate: -dir * 14 + '% 0', scale: '.92', filter: 'brightness(.55)' }], Object.assign({}, o, { easing: EASE_IO }))
  ];
};
TRANS.circle = function (f, t, dir, o) {
  return [tAnim(t, [{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)' }], Object.assign({}, o, { easing: EASE_IO }))];
};
TRANS.morph = function (f, t, dir, o) {
  var out = [tAnim(t, [{ opacity: 0 }, { opacity: 1 }], o)];
  if (!f) return out;
  $$('[data-morph]', t).forEach(function (b) {
    var a = f.querySelector('[data-morph="' + b.getAttribute('data-morph') + '"]');
    if (!a) return;
    var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(), s = scale();
    if (!rb.width || !rb.height) return;
    var dx = (ra.left - rb.left) / s, dy = (ra.top - rb.top) / s, sx = ra.width / rb.width, sy = ra.height / rb.height;
    out.push(tAnim(b, [{ translate: dx + 'px ' + dy + 'px', scale: sx + ' ' + sy, transformOrigin: '0 0', opacity: 1 }, { translate: '0 0', scale: '1 1', transformOrigin: '0 0', opacity: 1 }], Object.assign({}, o, { easing: EASE_IO })));
    out.push(tAnim(a, [{ opacity: 0 }, { opacity: 0 }], o));
  });
  out.push(tAnim(f, [{ opacity: 1 }, { opacity: 0 }], o));
  return out;
};
SE.transitionNames = ['none', 'fade', 'push', 'cover', 'zoom', 'flip', 'wipe', 'circle', 'morph'];
var transDone = null;
function finishTransition() { if (transDone) { var f = transDone; transDone = null; f(); } }
function runTransition(ctx) {
  var fn = TRANS[ctx.name], l = level();
  var o = { duration: (l === 3 ? 820 : 700) * (ctx.name === 'flip' ? 1.2 : 1), easing: l === 3 ? 'cubic-bezier(.3,1.25,.5,1)' : EASE, fill: 'both' };
  if (ctx.name === 'wipe' || ctx.name === 'circle') o.easing = EASE_IO;
  var list = fn ? (fn(ctx.from, ctx.to, ctx.dir, o, ctx) || []).filter(Boolean) : [];
  if (l === 3 && ctx.name !== 'zoom' && ctx.name !== 'flip') list.push(tAnim(ctx.to, [{ scale: '1.05' }, { scale: '1' }], { duration: 1400, easing: EASE, composite: 'add' }));
  var done = function () {
    list.forEach(function (a) { try { a.cancel(); } catch (e) { /* 무시 */ } });
    if (ctx.from) { rt.cls(ctx.from, 'leaving', false); rt.cls(ctx.from, 'play', false); resetSlideState(ctx.from); }
    emit('transitionend', ctx);
  };
  transDone = done;
  var wait = list.length ? Promise.all(list.map(function (a) { return a.finished.catch(function () { }); })) : Promise.resolve();
  wait.then(function () { if (transDone === done) { transDone = null; done(); } });
}

/* ---------- 장 이동 ---------- */
function go(i, opt) {
  opt = opt || {};
  if (!slides.length || isNaN(i)) return;
  i = clamp(i, 0, slides.length - 1);
  if (i === cur && !opt.force) return;
  finishTransition();
  var prev = cur, from = prev >= 0 && slides[prev] !== slides[i] ? slides[prev] : null, to = slides[i];
  var dir = prev < 0 || i >= prev ? 1 : -1;
  var animate = level() > 0 && !!from && !opt.instant;
  if (from) { emit('leave', from); timers.forEach(clearTimeout); timers = []; }
  slides.forEach(function (s) {
    if (s === to || s === from) return;
    if (s.classList.contains('active') || s.classList.contains('leaving') || s.classList.contains('play')) { rt.cls(s, 'active', false); rt.cls(s, 'leaving', false); rt.cls(s, 'play', false); resetSlideState(s); }
  });
  if (from) { rt.cls(from, 'active', false); if (animate) rt.cls(from, 'leaving', true); else { rt.cls(from, 'play', false); resetSlideState(from); } }
  rt.cls(to, 'play', false);
  resetSlideState(to);
  rt.cls(to, 'active', true);
  cur = i;
  stepGroups = buildSteps(to); stepPos = 0;
  if (opt.revealAll) { stepGroups.forEach(function (g) { applyGroup(g, false); }); stepPos = stepGroups.length; }
  var ctx = { from: from, to: to, dir: dir, index: i, prev: prev, name: to.getAttribute('data-transition') || cfg.transition };
  if (level() === 1) ctx.name = 'fade';
  if (animate) { emit('choosetransition', ctx); runTransition(ctx); }
  enterSlide(to, opt);
  emit('enter', to, ctx);
  updateChrome();
  writeHash();
}
function enterSlide(s) {
  if (level() > 0) { void s.offsetWidth; rt.cls(s, 'play', true); }
  var base = baseDelay(s);
  if (level() > 0) {
    $$('[data-anim]', s).forEach(function (e) { if (!hiddenByStep(e) && !e.closest('[data-step]:not(.se-on)')) playEntrance(e, base); });
    runDiagrams(s, base);
  }
  autoEmph(s, level() > 0, base + 0.6);
  requestAnimationFrame(function () { tune(s); });
}
function step(dir) {
  if (cur < 0) return;
  if (dir > 0 && stepPos < stepGroups.length) { applyGroup(stepGroups[stepPos++], true); emit('step', slides[cur], stepPos); updateChrome(); return; }
  if (dir < 0 && stepPos > 0) { unapplyGroup(stepGroups[--stepPos]); emit('step', slides[cur], stepPos); updateChrome(); return; }
  var j = cur + dir;
  while (skipHidden && j >= 0 && j < slides.length && isHidden(j)) j += dir;
  if (j >= 0 && j < slides.length) go(j, { revealAll: dir < 0 });
}
SE.go = function (i, o) { go(i, o); };
SE.next = function () { step(1); };
SE.prev = function () { step(-1); };
SE.first = function () { go(0); };
SE.last = function () { go(slides.length - 1); };
SE.setSkipHidden = function (on) { skipHidden = !!on; store.set('se-skip:' + PATH, skipHidden); updateChrome(); emit('settings'); };
SE.skipHidden = function () { return skipHidden; };

/* ---------- 쪽 번호 · 진행 막대 · 주소 ---------- */
function updateChrome() {
  if (!numEl || cur < 0) return;
  var hidden = isHidden(cur);
  numEl.innerHTML = (digitBuf ? '<i class="se-digits">→ ' + esc(digitBuf) + '</i>' : '') +
    (stepsLeft() && !editing ? '<b class="se-stepflag">▸' + (cfg.stepLabel ? ' ' + esc(cfg.stepLabel) : '') + '</b>' : '') +
    '<span>' + (cur + 1) + ' / ' + slides.length + (hidden ? ' · ' + esc(cfg.hiddenLabel) : '') + '</span>';
  if (progEl) progEl.firstChild.style.width = ((cur + 1) / slides.length * 100) + '%';
  emit('chrome');
}
SE.updateChrome = updateChrome;
function readHash() { var m = /^#0*(\d+)$/.exec(location.hash); return m ? parseInt(m[1], 10) - 1 : 0; }
function writeHash() { var h = '#' + (cur + 1); if (location.hash === h) return; try { history.replaceState(null, '', h); } catch (e) { location.hash = h; } }
function pushDigit(d) {
  if (digitBuf.length >= 3) digitBuf = '';
  digitBuf += d; clearTimeout(digitTimer);
  digitTimer = setTimeout(function () { digitBuf = ''; updateChrome(); }, 1500);
  updateChrome();
}

/* ---------- 상호작용: 뒤집기 카드 · 가리개 · 퀴즈 · 크게 보기 · 핫스팟 ---------- */
function prepareInteractive(s) {
  $$('[data-flip]', s).forEach(function (e) { rt.cls(e, 'se-flip', true); });
  $$('[data-cover]', s).forEach(function (e) {
    rt.cls(e, 'se-coverable', true);
    if (!$(':scope > .se-lid', e)) { var lid = rt.node(mk('div', 'se-lid')); lid.textContent = e.getAttribute('data-cover') || '눌러서 보기'; e.appendChild(lid); }
  });
  $$('[data-quiz]', s).forEach(function (e) { rt.cls(e, 'se-quiz', true); });
  $$('[data-enlarge]', s).forEach(function (e) { rt.cls(e, 'se-enl', true); });
  $$('[data-hotspot]', s).forEach(function (e) { rt.cls(e, 'se-hot', true); });
}
function interact(t, s) {
  var e;
  if ((e = t.closest('[data-flip]')) && s.contains(e)) { rt.cls(e, 'se-flipped', !e.classList.contains('se-flipped')); return true; }
  if ((e = t.closest('[data-cover]')) && s.contains(e)) { if (!e.classList.contains('se-open')) { rt.cls(e, 'se-open', true); return true; } }
  if ((e = t.closest('[data-quiz]')) && s.contains(e)) {
    var opt = t; while (opt && opt.parentElement !== e) opt = opt.parentElement;
    if (!opt || rt.isRt(opt)) return true;
    if (opt.hasAttribute('data-correct')) {
      rt.cls(opt, 'se-right', true);
      var r = opt.getBoundingClientRect(), p = toStage(r.left + r.width / 2, r.top + r.height / 2);
      if (SE.confetti) SE.confetti(p.x, p.y, 70);
    } else {
      rt.cls(opt, 'se-wrong', true);
      if (level()) anim(opt, [0, -16, 14, -10, 7, 0].map(function (x) { return { translate: x + 'px 0' }; }), { duration: 500 });
    }
    return true;
  }
  if ((e = t.closest('[data-hotspot]')) && s.contains(e)) {
    var old = $('.se-pop', s); if (old) { var same = old.__for === e; old.remove(); if (same) return true; }
    var pop = rt.node(mk('div', 'se-pop')); pop.__for = e; pop.textContent = e.getAttribute('data-tip') || '';
    var rr = rectIn(e, s); pop.style.left = clamp(rr.x + rr.w / 2, 260, cfg.width - 260) + 'px';
    pop.style.top = (rr.y > 360 ? rr.y - 20 : rr.y + rr.h + 20) + 'px';
    if (rr.y > 360) pop.classList.add('up');
    s.appendChild(pop);
    if (level()) anim(pop, ENTER.pop(0.4), { duration: 350, easing: EASE });
    return true;
  }
  if ((e = t.closest('[data-enlarge]')) && s.contains(e)) { SE.enlarge && SE.enlarge(e); return true; }
  if (t.closest('.se-pop')) { t.closest('.se-pop').remove(); return true; }
  if (t.closest('[data-interactive],a[href],button,input,textarea,select,label')) return true;
  var openPop = $('.se-pop', s); if (openPop) { openPop.remove(); return true; }
  return false;
}

/* ---------- 배경 움직임 ---------- */
function prepareBg(s) {
  var old = $(':scope > .se-bg', s), t = s.getAttribute('data-bg');
  if (old && (!t || !old.classList.contains('se-bg-' + t))) { old.remove(); old = null; }
  if (!t || old) return;
  var bg = rt.node(mk('div', 'se-bg se-bg-' + t));
  bg.setAttribute('aria-hidden', 'true');
  var n = t === 'particles' ? 18 : t === 'drift' ? 4 : 0;
  for (var k = 0; k < n; k++) {
    var i = mk('i');
    i.style.cssText = '--x:' + ((k * 37) % 100) + '%;--y:' + ((k * 61) % 100) + '%;--d:' + (k * 0.7 % 6) + 's;--s:' + (0.6 + (k % 5) * 0.25);
    bg.appendChild(i);
  }
  s.insertBefore(bg, s.firstChild);
}

/* ---------- 장 준비 (처음, 새로 넣거나 되돌렸을 때) ---------- */
function prepareSlide(s) {
  $$('[data-split]', s).forEach(function (e) { split(e, e.getAttribute('data-split') === 'chars' ? 'chars' : 'words'); });
  $$('[data-anim="words"],[data-anim="chars"],[data-anim="type"]', s).forEach(function (e) { split(e, e.getAttribute('data-anim') === 'words' ? 'words' : 'chars'); });
  prepareInteractive(s);
  prepareBg(s);
  emit('prepare', s);
}
SE.prepareSlide = prepareSlide;
var layoutPending = false;
function relayout() {
  if (layoutPending) return;
  layoutPending = true;
  requestAnimationFrame(function () { layoutPending = false; emit('layout'); });
}
SE.relayout = relayout;

/* ---------- 입력 ---------- */
var lastSwipe = 0, touchStart = null;
function onKey(e) {
  if (until('keyfirst', e)) return;
  var t = e.target, k = e.key, code = e.code || '', ctrl = e.ctrlKey || e.metaKey, sh = e.shiftKey;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) { if (k === 'Escape' && t.blur) t.blur(); return; }
  if (editing) { if (until('editkey', e)) e.preventDefault(); return; }
  if (until('key', e)) { e.preventDefault(); return; }
  if (ctrl || e.altKey) return;
  var d = /^(?:Digit|Numpad)(\d)$/.exec(code);
  if (d && !sh) { pushDigit(d[1]); e.preventDefault(); return; }
  if (code === 'Enter' || code === 'NumpadEnter') {
    e.preventDefault();
    if (digitBuf) { var n = parseInt(digitBuf, 10) - 1; digitBuf = ''; clearTimeout(digitTimer); go(n); updateChrome(); } else step(1);
    return;
  }
  if (code === 'Backspace') { e.preventDefault(); if (digitBuf) { digitBuf = digitBuf.slice(0, -1); updateChrome(); } else step(-1); return; }
  var map = { ArrowRight: 1, ArrowDown: 1, Space: 1, PageDown: 1, ArrowLeft: -1, ArrowUp: -1, PageUp: -1 };
  if (code in map) { e.preventDefault(); step(map[code]); return; }
  if (code === 'Home') { e.preventDefault(); go(0); return; }
  if (code === 'End') { e.preventDefault(); go(slides.length - 1); return; }
  if (code === 'KeyS' && !sh) { SE.setSkipHidden(!skipHidden); SE.toast && SE.toast(skipHidden ? '숨긴 장을 건너뜁니다' : '숨긴 장도 보여 줍니다'); return; }
  if (code === 'KeyM' && !sh) { SE.setMotion((settings.motion + 1) % 4); SE.toast && SE.toast('모션: ' + ['끄기', '차분', '기본', '화려'][settings.motion]); return; }
}
function onClick(e) {
  if (editing || e.button !== 0 || Date.now() - lastSwipe < 400) return;
  if (until('stageclick', e)) return;
  var s = slides[cur]; if (!s) return;
  if (interact(e.target, s)) return;
  var r = stage.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
  step(e.clientX - r.left < r.width / 3 ? -1 : 1);
}
function onPointerDown(e) { if (e.pointerType === 'touch') touchStart = { x: e.clientX, y: e.clientY, t: Date.now() }; }
function onPointerUp(e) {
  if (!touchStart || e.pointerType !== 'touch' || editing) { touchStart = null; return; }
  var dx = e.clientX - touchStart.x, dy = e.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.3 && !(SE.ink && SE.ink.tool)) { lastSwipe = Date.now(); step(dx < 0 ? 1 : -1); }
}

/* ---------- 시작 ---------- */
function init() {
  stage = $('#stage'); if (!stage) return;
  deck = $('#deck') || stage;
  viewport = $('#viewport') || stage.parentNode;
  SE.stage = stage; SE.deck = deck;
  skipHidden = store.get('se-skip:' + PATH, cfg.skipHidden);
  numEl = rt.node(mk('div', 'se-num')); numEl.setAttribute('aria-live', 'polite'); stage.appendChild(numEl);
  if (cfg.progress) { progEl = rt.node(mk('div', 'se-progress', '<i></i>')); stage.appendChild(progEl); }
  refreshSlides();
  emit('init');
  slides.forEach(prepareSlide);
  inits.forEach(function (f) { try { f(); } catch (err) { console.error('[SE] init', err); } });
  applyMotionClasses();
  fit();
  W.addEventListener('resize', function () { fit(); relayout(); });
  D.addEventListener('keydown', onKey);
  stage.addEventListener('click', onClick);
  viewport.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('pointerup', onPointerUp);
  W.addEventListener('hashchange', function () { var n = readHash(); if (n !== cur) go(n, { instant: editing }); });
  if (osReduce && osReduce.addEventListener) osReduce.addEventListener('change', function () { if (saved.motion == null) { settings.motion = osReduce.matches ? 0 : 2; applyMotionClasses(); } });
  $$('img', deck).forEach(function (img) { img.addEventListener('load', relayout); });
  go(readHash(), { instant: true });
  if (D.fonts && D.fonts.ready) D.fonts.ready.then(relayout);
  W.addEventListener('load', relayout);
  relayout();
  SE.ready = true;
  emit('ready');
}
SE.refresh = function () { refreshSlides(); if (cur >= slides.length) cur = slides.length - 1; updateChrome(); };
if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init); else setTimeout(init, 0);
