/* =====================================================================
   슬라이드 엔진 · 발표 도구 (타이머 · 뽑기 · 색종이 · 화면 가리기 · 효과음 · 발표자 보기)
   ===================================================================== */
var tools = SE.tools = {};

/* ---------- 효과음 (타이머와 뽑기에만) ---------- */
var actx = null;
function audio() {
  if (!actx) { var C = W.AudioContext || W.webkitAudioContext; if (C) { try { actx = new C(); } catch (e) { actx = null; } } }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
function beep(f, dur, type, vol, when) {
  if (!settings.sound) return;
  var a = audio(); if (!a) return;
  var t = a.currentTime + (when || 0), o = a.createOscillator(), g = a.createGain();
  o.type = type || 'sine'; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
var sfx = tools.sfx = {
  tick: function () { beep(1400, 0.035, 'square', 0.05); },
  done: function () { [0, 0.35, 0.7].forEach(function (w) { beep(880, 0.25, 'triangle', 0.3, w); beep(1320, 0.25, 'sine', 0.12, w); }); },
  win: function () { [523, 659, 784, 1047].forEach(function (f, i) { beep(f, 0.3, 'triangle', 0.22, i * 0.09); }); },
  warn: function () { beep(660, 0.12, 'sine', 0.15); }
};
function soundBtn() { return '<button type="button" class="se-t se-snd" aria-label="효과음 켜기·끄기">' + icon(settings.sound ? 'sound' : 'mute') + '</button>'; }
function bindSound(c) {
  var b = $('.se-snd', c); if (!b) return;
  b.addEventListener('click', function () { settings.sound = !settings.sound; saveSettings(); b.innerHTML = icon(settings.sound ? 'sound' : 'mute'); emit('settings'); });
}

/* ---------- 타이머 ---------- */
var tm = tools.timerState = { mode: 'down', total: 300, left: 300, up: 0, running: false, last: 0, raf: 0, ended: false };
function fmt(sec) { sec = Math.max(0, Math.round(sec)); var m = Math.floor(sec / 60), s = sec % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
tools.timerText = function () { return fmt(tm.mode === 'down' ? Math.ceil(tm.left) : Math.floor(tm.up)); };
function tickTimer(now) {
  if (!tm.running) return;
  var dt = (now - tm.last) / 1000; tm.last = now;
  if (tm.mode === 'down') {
    var before = Math.ceil(tm.left);
    tm.left -= dt;
    if (Math.ceil(tm.left) !== before && tm.left > 0 && tm.left <= 5) sfx.warn();
    if (tm.left <= 0) { tm.left = 0; tm.running = false; tm.ended = true; sfx.done(); toast('시간이 다 됐어요', 3500); }
  } else tm.up += dt;
  renderTimer();
  if (tm.running) tm.raf = requestAnimationFrame(tickTimer);
}
function renderTimer() {
  var c = SE.cardOpen('timer'), txt = tools.timerText();
  if (c) {
    $('.se-big', c).textContent = txt;
    c.classList.toggle('se-ended', tm.ended);
    $('[data-t="run"]', c).innerHTML = icon(tm.running ? 'pause' : 'play') + (tm.running ? '멈춤' : '시작');
    $$('.se-tab', c).forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-mode') === tm.mode ? 'true' : 'false'); });
    $('.se-presets', c).hidden = tm.mode !== 'down';
  }
  chip.hidden = !!c || !(tm.running || tm.ended || (tm.mode === 'up' ? tm.up > 0 : tm.left < tm.total));
  chip.textContent = txt; chip.classList.toggle('se-ended', tm.ended);
  emit('timer', txt);
}
var chip;
tools.timer = function () {
  var c = SE.card('timer', '타이머',
    '<div class="se-seg se-tabs"><button type="button" class="se-tab" data-mode="down">남은 시간</button><button type="button" class="se-tab" data-mode="up">지난 시간</button></div>' +
    '<div class="se-big" aria-live="off">00:00</div>' +
    '<div class="se-presets se-row se-wrap">' + [1, 3, 5, 10].map(function (m) { return '<button type="button" class="se-btn" data-min="' + m + '">' + m + '분</button>'; }).join('') +
    '<button type="button" class="se-btn" data-add="-60">−1분</button><button type="button" class="se-btn" data-add="60">+1분</button><button type="button" class="se-btn" data-add="10">+10초</button></div>' +
    '<div class="se-row se-gap"><button type="button" class="se-btn se-primary" data-t="run"></button><button type="button" class="se-btn" data-t="reset">' + icon('reset') + '처음으로</button>' + soundBtn() + '</div>', { cls: 'se-card-timer' });
  if (!c) { renderTimer(); return; }
  bindSound(c);
  c.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    audio();
    if (b.hasAttribute('data-mode')) { tm.mode = b.getAttribute('data-mode'); tm.running = false; tm.ended = false; }
    else if (b.hasAttribute('data-min')) { tm.total = tm.left = +b.getAttribute('data-min') * 60; tm.ended = false; }
    else if (b.hasAttribute('data-add')) { tm.left = Math.max(0, tm.left + +b.getAttribute('data-add')); tm.total = Math.max(tm.total, tm.left); tm.ended = false; }
    else if (b.getAttribute('data-t') === 'run') {
      if (tm.mode === 'down' && tm.left <= 0) { tm.left = tm.total; tm.ended = false; }
      tm.running = !tm.running;
      if (tm.running) { tm.last = performance.now(); tm.raf = requestAnimationFrame(tickTimer); }
    } else if (b.getAttribute('data-t') === 'reset') { tm.running = false; tm.ended = false; tm.left = tm.total; tm.up = 0; }
    renderTimer();
  });
  renderTimer();
};

/* ---------- 랜덤 뽑기 ---------- */
var pk = { from: 1, to: 30, names: '', useNames: false, exclude: true, picked: [] };
tools.pick = function () {
  var c = SE.card('pick', '랜덤 뽑기',
    '<div class="se-seg se-tabs"><button type="button" class="se-tab" data-src="num">번호</button><button type="button" class="se-tab" data-src="name">이름</button></div>' +
    '<div class="se-row se-pk-num"><input class="se-input" id="se-pk-from" type="number" min="1" value="' + pk.from + '" aria-label="처음 번호"><span>~</span><input class="se-input" id="se-pk-to" type="number" min="1" value="' + pk.to + '" aria-label="끝 번호"></div>' +
    '<textarea class="se-input se-pk-names" id="se-pk-names" rows="4" placeholder="한 줄에 한 사람씩 적어 주세요"></textarea>' +
    '<label class="se-check"><input type="checkbox" id="se-pk-ex"' + (pk.exclude ? ' checked' : '') + '> 뽑힌 것은 다시 뽑지 않기</label>' +
    '<div class="se-big se-pk-out">?</div><p class="se-pk-hist"></p>' +
    '<div class="se-row se-gap"><button type="button" class="se-btn se-primary" data-p="go">' + icon('pick') + '뽑기</button><button type="button" class="se-btn" data-p="reset">' + icon('reset') + '다시 처음부터</button>' + soundBtn() + '</div>', { cls: 'se-card-pick' });
  if (!c) return;
  bindSound(c);
  var ta = $('#se-pk-names', c); ta.value = pk.names;
  var sync = function () {
    $$('.se-tab', c).forEach(function (b) { b.setAttribute('aria-pressed', (b.getAttribute('data-src') === 'name') === pk.useNames ? 'true' : 'false'); });
    $('.se-pk-num', c).hidden = pk.useNames; ta.hidden = !pk.useNames;
    $('.se-pk-hist', c).textContent = pk.picked.length ? '뽑힌 것: ' + pk.picked.join(', ') : '';
  };
  sync();
  c.addEventListener('input', function () { pk.from = +$('#se-pk-from', c).value || 1; pk.to = +$('#se-pk-to', c).value || 1; pk.names = ta.value; pk.exclude = $('#se-pk-ex', c).checked; });
  c.addEventListener('change', function () { pk.exclude = $('#se-pk-ex', c).checked; });
  c.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-src')) { pk.useNames = b.getAttribute('data-src') === 'name'; pk.picked = []; sync(); return; }
    if (b.getAttribute('data-p') === 'reset') { pk.picked = []; $('.se-pk-out', c).textContent = '?'; sync(); return; }
    if (b.getAttribute('data-p') !== 'go') return;
    audio();
    var pool = pk.useNames ? pk.names.split('\n').map(function (x) { return x.trim(); }).filter(Boolean) : [];
    if (!pk.useNames) { var a = Math.min(pk.from, pk.to), z = Math.max(pk.from, pk.to); if (z - a > 999) z = a + 999; for (var n = a; n <= z; n++) pool.push(String(n)); }
    var left = pk.exclude ? pool.filter(function (x) { return pk.picked.indexOf(x) < 0; }) : pool;
    if (!left.length) { toast(pool.length ? '모두 뽑았어요. \'다시 처음부터\'를 눌러 주세요' : '뽑을 이름을 적어 주세요'); return; }
    var result = left[Math.floor(Math.random() * left.length)], out = $('.se-pk-out', c);
    b.disabled = true;
    var finish = function () {
      out.textContent = result; out.classList.add('se-win'); b.disabled = false;
      if (pk.exclude) pk.picked.push(result);
      sfx.win(); sync();
      if (level()) out.animate(ENTER.pop(0.6), { duration: 450, easing: EASE });
    };
    out.classList.remove('se-win');
    if (!level()) { finish(); return; }
    var steps = 18, i = 0;
    (function roll() {
      out.textContent = left[Math.floor(Math.random() * left.length)];
      sfx.tick();
      if (++i >= steps) { finish(); return; }
      setTimeout(roll, 30 + i * i * 0.6);
    })();
  });
};

/* ---------- 색종이 ---------- */
var fx, fxParts = [], fxRaf = 0;
SE.confetti = function (x, y, count) {
  var colors = ['#E5484D', '#2F6FEB', '#22A06B', '#F5C518', '#8E4EC6', '#FFFFFF'];
  var burst = x != null;
  count = count || 180;
  if (!level()) {
    if (burst) return;
    for (var q = 0; q < 90; q++) fxParts.push({ x: Math.random() * cfg.width, y: Math.random() * cfg.height, vx: 0, vy: 0, r: 0, vr: 0, s: 10 + Math.random() * 12, c: colors[q % colors.length], life: 1.2, still: true });
  } else {
    for (var i = 0; i < count; i++) {
      var a = burst ? Math.random() * Math.PI * 2 : (-Math.PI / 2 + (Math.random() - .5) * 1.1), sp = burst ? 6 + Math.random() * 14 : 18 + Math.random() * 16;
      var ox = burst ? x : (i % 2 ? cfg.width * 0.12 : cfg.width * 0.88), oy = burst ? y : cfg.height + 20;
      if (!burst) a += i % 2 ? 0.35 : -0.35;
      fxParts.push({ x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: Math.random() * 6, vr: (Math.random() - .5) * .4, s: 12 + Math.random() * 14, c: colors[i % colors.length], life: burst ? 1.4 : 3.4 });
    }
  }
  if (!fxRaf) { fx.width = cfg.width; fx.height = cfg.height; fxRaf = requestAnimationFrame(fxLoop); }
};
var fxLast = 0;
function fxLoop(now) {
  var dt = fxLast ? Math.min(0.05, (now - fxLast) / 1000) : 0.016; fxLast = now;
  var c = fx.getContext('2d'); c.clearRect(0, 0, fx.width, fx.height);
  fxParts = fxParts.filter(function (p) { return (p.life -= dt) > 0 && p.y < cfg.height + 80; });
  fxParts.forEach(function (p) {
    if (!p.still) { p.vy += 32 * dt; p.vx *= 0.99; p.x += p.vx * dt * 60 * 0.6; p.y += p.vy * dt * 60 * 0.6; p.r += p.vr; }
    c.save(); c.globalAlpha = Math.min(1, p.life * 1.5); c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = p.c;
    c.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2 * (0.4 + Math.abs(Math.sin(p.r * 2)) * 0.8)); c.restore();
  });
  if (fxParts.length) fxRaf = requestAnimationFrame(fxLoop); else { fxRaf = 0; fxLast = 0; c.clearRect(0, 0, fx.width, fx.height); }
}

/* ---------- 화면 가리기 ---------- */
var coverEl;
tools.cover = function (color) {
  if (!color || coverEl.getAttribute('data-c') === color && !coverEl.hidden) { coverEl.hidden = true; coverEl.removeAttribute('data-c'); return; }
  coverEl.setAttribute('data-c', color); coverEl.hidden = false;
};
tools.covered = function () { return !coverEl.hidden; };

/* ---------- 발표자 보기 ---------- */
var pvw = null, pwStart = 0, pwTimer = 0;
tools.presenter = function () {
  if (pvw && !pvw.closed) { pvw.focus(); return; }
  pvw = W.open('', 'se-presenter', 'width=1280,height=800');
  if (!pvw) { toast('팝업이 막혔어요. 주소창 오른쪽에서 이 파일의 팝업을 허용해 주세요.', 4500); return; }
  var styles = $$('style').map(function (s) { return s.outerHTML; }).join('\n');
  pvw.document.open();
  pvw.document.write('<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>발표자 보기</title><base href="' + esc(location.href) + '">' + styles +
    '</head><body class="se-pv"><header class="se-pv-h"><b class="se-pv-num"></b><span class="se-pv-step"></span><span class="se-pv-sp"></span>' +
    '<span class="se-pv-lab">지난 시간</span><b class="se-pv-el">00:00</b><button type="button" data-pv="reset">처음으로</button>' +
    '<span class="se-pv-lab">타이머</span><b class="se-pv-tm">—</b><span class="se-pv-lab">시각</span><b class="se-pv-clock"></b>' +
    '<button type="button" data-pv="prev">◀ 이전</button><button type="button" data-pv="next">다음 ▶</button></header>' +
    '<main class="se-pv-m"><section class="se-pv-cur"><p class="se-pv-cap">지금</p><div class="se-pv-frame" id="pv-cur"></div></section>' +
    '<aside class="se-pv-side"><p class="se-pv-cap">다음</p><div class="se-pv-frame" id="pv-next"></div><p class="se-pv-cap">메모</p><div class="se-pv-notes"></div></aside></main></body></html>');
  pvw.document.close();
  pwStart = Date.now();
  pvw.document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pv]'); if (!b) return;
    var a = b.getAttribute('data-pv');
    if (a === 'next') step(1); else if (a === 'prev') step(-1); else if (a === 'reset') { pwStart = Date.now(); pvTick(); }
  });
  pvw.document.addEventListener('keydown', function (e) {
    if (/^(ArrowRight|ArrowDown|PageDown|Space|Enter)$/.test(e.code)) { e.preventDefault(); step(1); }
    else if (/^(ArrowLeft|ArrowUp|PageUp|Backspace)$/.test(e.code)) { e.preventDefault(); step(-1); }
  });
  pvw.addEventListener('resize', pvUpdate);
  clearInterval(pwTimer); pwTimer = setInterval(pvTick, 500);
  pvUpdate(); pvTick();
};
function pvFrame(box, s, fresh) {
  box.innerHTML = '';
  if (!s) { box.innerHTML = '<p class="se-pv-end">마지막 장입니다</p>'; return; }
  var w = box.clientWidth || 640, k = w / cfg.width;
  var inner = pvw.document.createElement('div'); inner.className = 'se-pv-in';
  inner.style.transform = 'scale(' + k + ')';
  var c = s.cloneNode(true);
  $$('[id]', c).forEach(function (e) { e.removeAttribute('id'); });
  ['leaving', 'play'].forEach(function (x) { c.classList.remove(x); });
  c.classList.add('active', 'se-pv-slide');
  if (fresh) $$('.se-on', c).forEach(function (e) { e.classList.remove('se-on'); });
  $$('.se-spot,.se-pop', c).forEach(function (e) { e.remove(); });
  inner.appendChild(c);
  box.style.height = (cfg.height * k) + 'px';
  box.appendChild(inner);
}
function pvUpdate() {
  if (!pvw || pvw.closed || cur < 0) return;
  var d = pvw.document, s = slides[cur];
  d.querySelector('.se-pv-num').textContent = (cur + 1) + ' / ' + slides.length + ' · ' + titleOf(s);
  d.querySelector('.se-pv-step').textContent = stepsLeft() ? '이 장에 남은 단계 ' + (stepGroups.length - stepPos) + '개' : '';
  pvFrame(d.getElementById('pv-cur'), s, false);
  var j = cur + 1; while (skipHidden && j < slides.length && isHidden(j)) j++;
  pvFrame(d.getElementById('pv-next'), stepsLeft() ? s : slides[j], !stepsLeft());
  var a = $(':scope > aside.notes', s), nb = d.querySelector('.se-pv-notes');
  nb.innerHTML = a && a.textContent.trim() ? a.innerHTML : '<span class="none">메모 없음</span>';
}
function pvTick() {
  if (!pvw || pvw.closed) { clearInterval(pwTimer); return; }
  var d = pvw.document, now = new Date();
  d.querySelector('.se-pv-el').textContent = fmt((Date.now() - pwStart) / 1000);
  d.querySelector('.se-pv-clock').textContent = (now.getHours() < 10 ? '0' : '') + now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
  d.querySelector('.se-pv-tm').textContent = tm.running || tm.ended || tm.up > 0 || tm.left < tm.total ? tools.timerText() : '—';
}
tools.presenterWindow = function () { return pvw; };

/* ---------- 키 ---------- */
SE.on('keyfirst', function (e) {
  if (!coverEl || coverEl.hidden) return false;
  if (e.code === 'KeyB' || e.code === 'KeyW' || e.code === 'Period' || e.key === 'Escape') { tools.cover(null); }
  e.preventDefault();
  return true;
});
SE.on('key', function (e) {
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return false;
  var code = e.code;
  if (code === 'KeyT') { tools.timer(); return true; }
  if (code === 'KeyR') { tools.pick(); return true; }
  if (code === 'KeyC') { SE.confetti(); return true; }
  if (code === 'KeyB' || code === 'Period') { tools.cover('black'); return true; }
  if (code === 'KeyW') { tools.cover('white'); return true; }
  if (code === 'KeyV') { tools.presenter(); return true; }
  return false;
});

inits.push(function () {
  fx = rt.node(mk('canvas', 'se-fx')); stage.appendChild(fx);
  coverEl = mk('div', 'se-cover'); coverEl.hidden = true; ui.appendChild(coverEl);
  coverEl.addEventListener('click', function () { tools.cover(null); });
  chip = mk('button', 'se-tchip'); chip.type = 'button'; chip.hidden = true; ui.appendChild(chip);
  chip.addEventListener('click', tools.timer);
  SE.on('enter', pvUpdate); SE.on('step', pvUpdate);
  SE.on('cardclose', function (id) { if (id === 'timer') renderTimer(); });
  W.addEventListener('beforeunload', function () { if (pvw && !pvw.closed) pvw.close(); });
});
