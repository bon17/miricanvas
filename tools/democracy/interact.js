// democracy/index.html 조작 검수 (헤드리스 Chromium + Playwright)
//   node tools/democracy/interact.js [index.html 경로]
// 사진이 없는 상태(저장소 그대로)를 기준으로 한다.
// 처음 명세(77장)의 장 번호는 N(옛 번호)로 바꿔 쓴다. 13번 뒤에 14번(같은 시기 남아프리카 공화국)이 들어갔다.
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');

const file = path.resolve(process.argv[2] || path.join(__dirname, '../../democracy/index.html'));
const url = 'file://' + file;
const TOTAL = 78;
const N = (old) => (old <= 13 ? old : old + 1);
const OPTIONAL = [18, 25, 37, 46, 49, 69].map(N);
const BOARD = [19, 29, 45, 57, 67].map(N);
let fails = 0;
function ok(cond, msg) { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);

  const cur = () => page.evaluate(() => Number(document.querySelector('#deck > .slide.active').getAttribute('data-n')));
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(60); };
  const goto = async (n) => { await page.evaluate((x) => { location.hash = '#' + x; }, n); await page.waitForTimeout(80); };
  const shown = (sel) => page.evaluate((s) => { const el = document.querySelector('.slide.active ' + s); return !!el && el.classList.contains('shown'); }, sel);
  const stepFlag = () => page.evaluate(() => getComputedStyle(document.getElementById('stepflag')).display !== 'none');

  ok(await cur() === 1, '처음 열면 1장');
  ok(await page.evaluate(() => document.querySelectorAll('#deck > section.slide').length) === TOTAL, `${TOTAL}장`);
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('progress')).display === 'none'), '01번에는 진행 표시 없음');

  // 다음 · 이전 키
  const seq = [['ArrowRight', 2], ['Space', 3], ['PageDown', 4], ['Enter', 5], ['ArrowDown', 6],
    ['ArrowLeft', 5], ['ArrowUp', 4], ['PageUp', 3], ['Backspace', 2], ['End', TOTAL], ['Home', 1]];
  for (const [k, want] of seq) { await press(k); ok(await cur() === want, `${k} → ${want}`); }

  // 숫자 + Enter
  await press('3'); await press('6'); await press('Enter');
  ok(await cur() === 36, '"36" Enter → 36');
  ok(await page.evaluate(() => location.hash) === '#36', '주소에 #36');
  await page.reload(); await page.waitForTimeout(150);
  ok(await cur() === 36, '새로고침해도 36');
  await press('4'); await page.waitForTimeout(1600); await press('Enter');
  ok(await cur() === 37, '숫자 입력 1.5초 뒤 Enter는 다음 장(37)');
  await press('4'); await press('5'); await press('Backspace'); await press('Enter');
  ok(await cur() === 4, '"45" Backspace Enter → 4');
  await press('Numpad1'); await press('Numpad2'); await press('Enter');
  ok(await cur() === 12, '숫자패드 "12" Enter → 12');

  // 단계 공개: 14번(남아프리카 공화국), 20·21번(답), 37번(8시간)
  await goto(14);
  ok(!(await shown('.ct-panel.sa')) && await stepFlag(), '14: 처음엔 오른쪽(남아공)이 숨어 있고 "▸ 답" 표시');
  await press('ArrowRight');
  ok(await cur() === 14 && await shown('.ct-panel.sa') && !(await stepFlag()), '14: → 한 번 더 누르면 같은 장에서 오른쪽이 나타남');
  await press('ArrowRight');
  ok(await cur() === 15, '14: 단계를 다 보인 뒤 → 는 다음 장(15)');
  await press('ArrowLeft');
  ok(await cur() === 14 && await shown('.ct-panel.sa'), '뒤로 돌아오면 단계가 다 보인 채로');
  await press('ArrowLeft');
  ok(await cur() === 14 && !(await shown('.ct-panel.sa')), '← 는 단계를 먼저 거둔다');
  await press('ArrowLeft');
  ok(await cur() === 13, '그다음 ← 는 이전 장');
  for (const n of [N(19), N(20)]) {
    await goto(n);
    const before = await shown('.answer');
    await press('ArrowRight');
    ok(!before && await cur() === n && await shown('.answer'), `${n}: 다음 키로 답 카드가 나타남`);
  }
  await goto(N(36));
  const a8before = await shown('.a8');
  await press('ArrowRight');
  ok(!a8before && await cur() === N(36) && await shown('.a8'), `${N(36)}: 다음 키로 8시간 셋이 나타남`);
  await goto(N(38));
  ok(await page.evaluate(() => /메이데이를 정했을까/.test(document.querySelector('.slide.active .why').textContent)), `${N(38)}: 메이데이를 정한 까닭이 보임`);

  // 선택 장 건너뛰기 (단계가 있는 장은 단계까지 넘기며 끝까지)
  await press('Home'); await press('KeyS');
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('skipflag')).display !== 'none'), 'S: "선택 장 건너뜀" 표시');
  const visited = new Set([await cur()]);
  for (let i = 0; i < 200 && (await cur()) !== TOTAL; i++) { await press('ArrowRight'); visited.add(await cur()); }
  const skipped = Array.from({ length: TOTAL }, (_, i) => i + 1).filter((n) => !visited.has(n));
  ok(JSON.stringify(skipped) === JSON.stringify(OPTIONAL), `S 모드 앞으로: ${OPTIONAL.join(',')} 건너뜀 → ` + skipped.join(','));
  const back = new Set([await cur()]);
  for (let i = 0; i < 200 && (await cur()) !== 1; i++) { await press('ArrowLeft'); back.add(await cur()); }
  ok(back.size === TOTAL - OPTIONAL.length && !OPTIONAL.some((n) => back.has(n)), 'S 모드 뒤로도 선택 장 건너뜀');
  await goto(N(18)); ok(await cur() === N(18), 'S 모드에서도 번호로는 선택 장에 갈 수 있음');
  await press('KeyS'); await goto(N(17)); await press('ArrowRight');
  ok(await cur() === N(18), `S 끄면 ${N(18)}장도 나옴`);

  // 메모
  await goto(5); await press('KeyN');
  const notes = await page.evaluate(() => ({ vis: getComputedStyle(document.getElementById('notes-panel')).display, text: document.getElementById('notes-body').textContent }));
  ok(notes.vis === 'block' && notes.text.includes('잠시 뒤 연설문에서'), 'N: 05번 메모 보임');
  await press('ArrowRight');
  ok((await page.evaluate(() => document.getElementById('notes-body').textContent)).includes('링컨'), '메모가 장을 따라 바뀜');
  await press('KeyN');
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('notes-panel')).display === 'none'), 'N 다시: 메모 숨김');

  // 전체 목록
  await press('KeyO');
  const ov = await page.evaluate(() => ({ vis: getComputedStyle(document.getElementById('overview')).display, n: document.querySelectorAll('.ov-item').length, opt: [...document.querySelectorAll('.ov-item.opt')].map((b) => +b.dataset.i + 1), op: getComputedStyle(document.querySelector('.ov-item.opt')).opacity }));
  ok(ov.vis === 'block' && ov.n === TOTAL, `O: ${TOTAL}장 목록`);
  ok(JSON.stringify(ov.opt) === JSON.stringify(OPTIONAL) && Number(ov.op) < 0.5, '목록에서 선택 장 흐림');
  await press('ArrowRight');
  ok(await cur() === 6, '목록이 열려 있으면 방향키 무시');
  await page.locator('.ov-item[data-i="9"]').click();
  ok(await cur() === 10 && await page.evaluate(() => getComputedStyle(document.getElementById('overview')).display === 'none'), '목록에서 10번 누르면 이동하고 닫힘');
  await press('KeyO'); await press('Escape');
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('overview')).display === 'none'), 'Esc로 목록 닫힘');

  // 마우스 클릭
  await page.mouse.click(1280 * 0.8, 360); await page.waitForTimeout(80);
  ok(await cur() === 11, '오른쪽 2/3 클릭 → 다음');
  await page.mouse.click(1280 * 0.2, 360); await page.waitForTimeout(80);
  ok(await cur() === 10, '왼쪽 1/3 클릭 → 이전');
  await page.mouse.click(1280 * 0.4, 360); await page.waitForTimeout(80);
  ok(await cur() === 11, '가운데(1/3~2/3) 클릭 → 다음');

  // 비교 슬라이더: 마우스
  const CMP = N(61);
  await goto(CMP);
  const box = await page.locator('.slide.active .compare').boundingBox();
  const pos = () => page.evaluate(() => document.querySelector('.slide.active .compare').style.getPropertyValue('--pos'));
  ok((await pos()) === '50%', `${CMP} 시작 위치 50%`);
  await page.waitForTimeout(1000); // 나타나는 움직임이 끝난 뒤 끈다
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up(); await page.waitForTimeout(80);
  ok(Math.abs(parseFloat(await pos()) - 20) < 2 && await cur() === CMP, '마우스로 끌기: 경계 20%, 장은 그대로 → ' + (await pos()));
  await page.mouse.click(box.x + box.width * 0.9, box.y + 50); await page.waitForTimeout(80);
  ok(await cur() === CMP, '사진 클릭은 장을 넘기지 않음');

  // 비교 슬라이더: 터치 (CDP)
  const cdp = await ctx.newCDPSession(page);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const cy = box.y + box.height / 2;
  await touch('touchStart', box.x + box.width * 0.2, cy);
  for (let i = 1; i <= 6; i++) await touch('touchMove', box.x + box.width * (0.2 + 0.1 * i), cy);
  await touch('touchEnd'); await page.waitForTimeout(150);
  ok(Math.abs(parseFloat(await pos()) - 80) < 2 && await cur() === CMP, '터치로 끌기: 경계 80%, 장은 그대로 → ' + (await pos()));

  // 터치 스와이프
  await goto(12);
  await touch('touchStart', 900, 400); for (let i = 1; i <= 5; i++) await touch('touchMove', 900 - i * 60, 405); await touch('touchEnd'); await page.waitForTimeout(150);
  ok(await cur() === 13, '왼쪽으로 스와이프 → 다음');
  await touch('touchStart', 300, 400); for (let i = 1; i <= 5; i++) await touch('touchMove', 300 + i * 60, 405); await touch('touchEnd'); await page.waitForTimeout(150);
  ok(await cur() === 12, '오른쪽으로 스와이프 → 이전');

  // 교토 → 파리 원
  const KYOTO = N(66), PARIS = N(67);
  await goto(KYOTO); await press('ArrowRight');
  const grow = await page.evaluate(() => { const c = document.querySelector('.slide.active .circle'); return { cls: c.classList.contains('grow'), anim: c.getAnimations().map((a) => a.animationName) }; });
  ok(grow.cls && grow.anim.includes('circleGrow'), `${KYOTO}→${PARIS}: 원이 커지는 애니메이션`);
  await page.waitForTimeout(1200);
  ok(await page.evaluate(() => document.querySelector('.slide.active .circle').getBoundingClientRect().width) > 600 * 1280 / 1920, '애니메이션 뒤 큰 원');
  await goto(KYOTO - 1); await goto(PARIS);
  ok(await page.evaluate(() => !document.querySelector('.slide.active .circle').classList.contains('grow')), '번호로 이동: 처음부터 큰 원, 애니메이션 없음');

  // 움직임: 장에 들어오면 요소 애니메이션이 돈다
  const noAnim = [];
  for (let n = 1; n <= TOTAL; n++) {
    await goto(n);
    const c = await page.evaluate(() => { const s = document.querySelector('#deck > .slide.active'); return s.classList.contains('play') ? document.getAnimations().filter((a) => a.effect.target && s.contains(a.effect.target)).length : -1; });
    if (c <= 0) noAnim.push(n);
  }
  ok(noAnim.length === 0, `움직임: ${TOTAL}장 모두 들어올 때 애니메이션이 돈다` + (noAnim.length ? ' → 없음: ' + noAnim.join(',') : ''));
  await goto(N(30)); await page.waitForTimeout(200); await press('ArrowRight');
  const wipe = await page.evaluate(() => [...document.querySelectorAll('#deck > .slide')].map((s) => s.className).filter((c) => /enter-|leave-/.test(c)).join(' | '));
  ok(/enter-next/.test(wipe) && /leave-next/.test(wipe), '같은 이야기 안에서는 닦아 내는 장 전환 → ' + wipe);
  await page.waitForTimeout(1100); await press('ArrowRight');
  const sw = await page.evaluate(() => ({ go: document.getElementById('sweep').classList.contains('go'), text: document.getElementById('sweep').textContent }));
  ok(sw.go && sw.text === '노동', `이야기가 바뀌면(${N(31)}→${N(32)}) 색 띠가 지나감 → ` + sw.text);
  await page.waitForTimeout(1100);
  await press('KeyM');
  const off = await page.evaluate(() => ({ flag: getComputedStyle(document.getElementById('motionflag')).display, motion: document.getElementById('stage').classList.contains('motion') }));
  await press('ArrowRight'); await page.waitForTimeout(50);
  const offAnims = await page.evaluate(() => document.getAnimations().map((a) => (a.animationName || a.transitionProperty) + '@' + (a.effect.target.id || a.effect.target.className)));
  ok(off.flag !== 'none' && !off.motion && offAnims.length === 0, 'M: 움직임 끄면 애니메이션 없음, "움직임 끔" 표시 → ' + JSON.stringify({ flag: off.flag, motion: off.motion, offAnims }));
  await press('KeyM');
  ok(await page.evaluate(() => document.getElementById('stage').classList.contains('motion')), 'M 다시: 움직임 켜짐');

  // 장마다 구성
  const facts = await page.evaluate(([n]) => {
    const slides = [...document.querySelectorAll('#deck > .slide')];
    const by = (k) => slides[k - 1];
    const vis = (el) => el && getComputedStyle(el).display !== 'none';
    const rows = (k) => [...by(k).querySelectorAll('tbody tr')].map((tr) => ({ name: tr.cells[0].textContent, filled: !tr.classList.contains('empty'), hl: tr.classList.contains('hl'), bg: getComputedStyle(tr.cells[1]).backgroundColor }));
    const cal = [...by(n.cal).querySelectorAll('.cal > div')];
    const firstIdx = cal.findIndex((d) => d.classList.contains('d') && d.textContent.trim().startsWith('1') && d.textContent.includes('노동절'));
    return {
      board: slides.filter((s) => s.querySelector('.board-icon')).map((s) => +s.dataset.n),
      mark08: getComputedStyle(by(8).querySelector('mark')).backgroundColor,
      mark09: getComputedStyle(by(9).querySelector('mark')).backgroundColor,
      same: by(8).querySelector('.source-box').textContent === by(9).querySelector('.source-box').textContent,
      figPhil: vis(by(n.phil).querySelector('figure')), figMap: vis(by(n.vmap).querySelector('figure')),
      textPhil: vis(by(n.phil).querySelector('.big')),
      phCount: document.querySelectorAll('#deck figure.ph.missing').length,
      phLeft: [...document.querySelectorAll('#deck figure.ph')].filter((f) => !f.classList.contains('missing') && !f.classList.contains('gone')).length,
      calHead: cal[(firstIdx - 7) % 7].textContent, calCol: (firstIdx - 7) % 7,
      r1: rows(n.s[0]), r2: rows(n.s[1]), r3: rows(n.s[2]), r4: rows(n.s[3]),
      pattern: n.p.map((k) => [...by(k).querySelectorAll('.pt-step')].filter((e) => !e.classList.contains('later')).length),
      tail: n.p.map((k) => by(k).querySelector('.pt-tail').classList.contains('later') ? 'hidden' : 'visible'),
      parts: slides.map((s) => s.dataset.part),
      nums: slides.map((s) => s.dataset.n).join(','),
    };
  }, [{ cal: N(33), phil: N(43), vmap: N(49), s: [N(31), N(47), N(70), N(71)], p: [N(73), N(74), N(75), N(76)] }]);
  ok(facts.nums === Array.from({ length: TOTAL }, (_, i) => String(i + 1).padStart(2, '0')).join(','), `장 번호(data-n)가 01–${TOTAL} 순서대로`);
  ok(JSON.stringify(facts.board) === JSON.stringify(BOARD), `연필 아이콘은 ${BOARD.join(',')}에만 → ` + facts.board.join(','));
  ok(facts.mark08 === 'rgba(0, 0, 0, 0)' && facts.mark09 === 'rgb(255, 228, 92)' && facts.same, '08 강조 없음, 09만 형광펜, 본문은 같음');
  ok(!facts.figPhil && !facts.figMap && facts.textPhil, `${N(43)}·${N(49)}: 사진 없으면 이미지 자리 숨김, 글자는 보임`);
  ok(facts.phLeft === 0, `사진 없을 때 자리표시 ${facts.phCount}개, 빈 틀 없음`);
  ok(facts.calHead === '금' && facts.calCol === 5, `${N(33)}: 5월 1일이 금요일 칸`);
  const sumOk = (r, fill, hl) => r.every((x) => x.filled === fill.includes(x.name) && x.hl === hl.includes(x.name));
  const all = ['민권', '여성', '노동', '반전 평화', '환경'];
  ok(sumOk(facts.r1, ['민권', '여성'], ['민권', '여성']), `${N(31)}: 민권·여성 채움, 둘 다 강조`);
  ok(sumOk(facts.r2, ['민권', '여성', '노동'], ['노동']), `${N(47)}: 노동까지 채움, 노동만 강조`);
  ok(sumOk(facts.r3, all, ['반전 평화', '환경']), `${N(70)}: 전부 채움, 반전 평화·환경 강조`);
  ok(sumOk(facts.r4, all, []) && facts.r4.every((x) => x.bg === 'rgba(0, 0, 0, 0)'), `${N(71)}: 전부 채움, 강조 없음`);
  ok(JSON.stringify(facts.pattern) === '[1,2,3,4]' && JSON.stringify(facts.tail) === '["hidden","hidden","hidden","visible"]', `${N(73)}–${N(76)}: 단계가 하나씩 늘고 끝 화살표는 마지막에만`);

  // 진행 표시
  const bands = [];
  for (const n of [1, 2, 3, 4, N(31), N(32), N(47), N(48), N(70), N(71), TOTAL]) {
    await goto(n);
    bands.push(await page.evaluate(() => { const on = document.querySelector('#progress .on'); const band = getComputedStyle(document.getElementById('progress')).display; return band === 'none' ? '없음' : on.textContent; }));
  }
  ok(bands.join(',') === '없음,도입,도입,평등,평등,노동,노동,생존,생존,정리,정리', '진행 표시 구간 → ' + bands.join(','));
  const expectPart = (k) => k <= 3 ? 'intro' : k <= N(31) ? 's1' : k <= N(47) ? 's2' : k <= N(70) ? 's3' : 'outro';
  ok(facts.parts.every((p, i) => p === expectPart(i + 1)), '모든 장의 data-part가 구간과 일치');

  // 전체 화면 키 (헤드리스에서는 실제로 바뀌지 않아도 오류가 없어야 한다)
  await press('KeyF'); await page.waitForTimeout(100);

  // 한글 입력 상태에서도 글자 키 동작 (e.code 사용)
  await goto(N(20));
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ㅜ', code: 'KeyN', bubbles: true })));
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('notes-panel')).display === 'block'), '한글 자판 상태(ㅜ)에서도 N 동작');
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Process', code: 'KeyN', bubbles: true })));

  // 편집 모드: 고치고 저장한 파일을 다시 열어 확인
  await goto(12);
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });
  await press('KeyE');
  const ed = await page.evaluate(() => ({ on: document.body.classList.contains('editing'), n: document.querySelectorAll('#deck [contenteditable="true"]').length, bar: getComputedStyle(document.getElementById('edit-bar')).display }));
  ok(ed.on && ed.n > 300 && ed.bar !== 'none', `E: 편집 모드, 고칠 수 있는 글자 ${ed.n}곳, 편집 도구 막대`);
  await page.locator('.slide.active .headline').click();
  await page.keyboard.press('End'); await page.keyboard.type('(고침)');
  await press('Escape');
  await goto(N(31));
  const cellText = await page.evaluate(() => { const td = document.querySelector('.slide.active tbody tr td:nth-child(2)'); td.focus(); return td.textContent; });
  await page.keyboard.press('End'); await page.keyboard.type('★');
  const synced = await page.evaluate(([a]) => document.querySelectorAll('#deck > .slide')[a - 1].querySelector('tbody tr td:nth-child(2)').textContent, [N(71)]);
  ok(synced === cellText + '★', `정리표 칸을 고치면 다른 정리표 장(${N(71)})에도 바로 반영`);
  await press('Escape');
  ok(/고친 곳 2개/.test(await page.evaluate(() => document.getElementById('edit-count').textContent)), '고친 곳 2개로 표시');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  const saved = path.join(os.tmpdir(), 'democracy-saved-' + process.pid + '.html');
  await dl.saveAs(saved);
  const html = fs.readFileSync(saved, 'utf8');
  ok(html.startsWith('<!doctype html>') && html.length > 100000, 'Ctrl+S: HTML 파일로 저장');
  const p3 = await ctx.newPage();
  const errs3 = [];
  p3.on('pageerror', (e) => errs3.push(e.message));
  await p3.goto('file://' + saved + '#12'); await p3.waitForTimeout(400);
  const re = await p3.evaluate(([s1]) => ({
    slides: document.querySelectorAll('#deck > section.slide').length,
    head: document.querySelector('.slide.active .headline').textContent,
    cell: document.querySelectorAll('#deck > .slide')[s1 - 1].querySelector('tbody tr td:nth-child(2)').textContent,
    tables: document.querySelectorAll('table.sum').length,
    crowds: [...document.querySelectorAll('.slide[data-layout="placard"]')].map((s) => s.querySelectorAll('.crowd').length),
    pts: [...document.querySelectorAll('.slide[data-layout="pattern"]')].map((s) => s.querySelectorAll('.pt').length),
    words: [...document.querySelectorAll('.bs')].every((p) => !p.querySelector('.w .w')),
    icons: document.querySelectorAll('.board-icon').length,
    editAttr: !!document.querySelector('[contenteditable], [spellcheck]'),
    editing: document.body.classList.contains('editing'),
  }), [N(47)]);
  ok(re.slides === TOTAL && /\(고침\)$/.test(re.head) && /★$/.test(re.cell), '저장한 파일을 다시 열면 고친 글이 그대로');
  ok(!re.editAttr && !re.editing, '저장한 파일에 편집 흔적(contenteditable 등)이 남지 않음');
  ok(re.tables === 4 && re.crowds.every((c) => c === 1) && re.pts.every((c) => c === 1) && re.words && re.icons === BOARD.length && errs3.length === 0, '저장한 파일에 표·군중·패턴·연필이 겹쳐 생기지 않음, 오류 없음');
  await p3.close();
  fs.unlinkSync(saved);
  await press('KeyE');
  ok(await page.evaluate(() => !document.body.classList.contains('editing') && !document.querySelector('#deck [contenteditable]')), 'E 다시: 편집 끝');

  ok(errors.length === 0, '스크립트 오류 없음' + (errors.length ? ' → ' + errors.join(' | ') : ''));

  // 움직임 줄이기 설정
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const p2 = await ctx2.newPage();
  await p2.goto(url + '#' + KYOTO);
  await p2.keyboard.press('ArrowRight'); await p2.waitForTimeout(50);
  const rm = await p2.evaluate(() => ({ grow: document.querySelector('.slide.active .circle').classList.contains('grow'), moving: !!document.querySelector('.slide.play, .slide.leaving') || document.getAnimations().length > 0, w: document.querySelector('.slide.active .circle').getBoundingClientRect().width }));
  ok(!rm.grow && !rm.moving && rm.w > 600 * 1280 / 1920, 'prefers-reduced-motion: 움직임 없음, 바로 큰 원');

  await browser.close();
  console.log(fails ? `\n${fails}개 실패` : '\n모두 통과');
  process.exit(fails ? 1 : 0);
})();
