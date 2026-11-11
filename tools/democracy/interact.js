// democracy/index.html 조작 검수 (헤드리스 Chromium + Playwright)
//   node tools/democracy/interact.js [index.html 경로]
// 사진이 없는 상태(저장소 그대로)를 기준으로 한다.
const path = require('path');
const { chromium } = require('playwright');

const file = path.resolve(process.argv[2] || path.join(__dirname, '../../democracy/index.html'));
const url = 'file://' + file;
let fails = 0;
function ok(cond, msg) { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);

  const cur = () => page.evaluate(() => Number(document.querySelector('#deck > .slide.active').getAttribute('data-n')));
  const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(60); };
  const goto = async (n) => { await page.evaluate((x) => { location.hash = '#' + x; }, n); await page.waitForTimeout(80); };

  ok(await cur() === 1, '처음 열면 1장');
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('progress')).display === 'none'), '01번에는 진행 표시 없음');

  // 다음 · 이전 키
  const seq = [['ArrowRight', 2], ['Space', 3], ['PageDown', 4], ['Enter', 5], ['ArrowDown', 6],
    ['ArrowLeft', 5], ['ArrowUp', 4], ['PageUp', 3], ['Backspace', 2], ['End', 77], ['Home', 1]];
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

  // 선택 장 건너뛰기
  await press('Home'); await press('KeyS');
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('skipflag')).display !== 'none'), 'S: "선택 장 건너뜀" 표시');
  const visited = [await cur()];
  for (let i = 0; i < 80; i++) { await press('ArrowRight'); const c = await cur(); if (c === visited[visited.length - 1]) break; visited.push(c); }
  const skipped = Array.from({ length: 77 }, (_, i) => i + 1).filter((n) => !visited.includes(n));
  ok(JSON.stringify(skipped) === JSON.stringify([18, 25, 37, 46, 49, 69]), 'S 모드 앞으로: 18,25,37,46,49,69 건너뜀 → ' + skipped.join(','));
  const back = [await cur()];
  for (let i = 0; i < 80; i++) { await press('ArrowLeft'); const c = await cur(); if (c === back[back.length - 1]) break; back.push(c); }
  ok(back.length === 71 && !back.some((n) => [18, 25, 37, 46, 49, 69].includes(n)), 'S 모드 뒤로도 선택 장 건너뜀');
  await goto(18); ok(await cur() === 18, 'S 모드에서도 번호로는 선택 장에 갈 수 있음');
  await press('KeyS'); await goto(17); await press('ArrowRight');
  ok(await cur() === 18, 'S 끄면 18장도 나옴');

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
  ok(ov.vis === 'block' && ov.n === 77, 'O: 77장 목록');
  ok(JSON.stringify(ov.opt) === '[18,25,37,46,49,69]' && Number(ov.op) < 0.5, '목록에서 선택 장 흐림');
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

  // 61 비교 슬라이더: 마우스
  await goto(61);
  const box = await page.locator('.slide.active .compare').boundingBox();
  const pos = () => page.evaluate(() => document.querySelector('.slide.active .compare').style.getPropertyValue('--pos'));
  ok((await pos()) === '50%', '61 시작 위치 50%');
  await page.waitForTimeout(1000); // 나타나는 움직임이 끝난 뒤 끈다
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up(); await page.waitForTimeout(80);
  ok(Math.abs(parseFloat(await pos()) - 20) < 2 && await cur() === 61, '마우스로 끌기: 경계 20%, 장은 그대로 → ' + (await pos()));
  await page.mouse.click(box.x + box.width * 0.9, box.y + 50); await page.waitForTimeout(80);
  ok(await cur() === 61, '사진 클릭은 장을 넘기지 않음');

  // 61 비교 슬라이더: 터치 (CDP)
  const cdp = await ctx.newCDPSession(page);
  const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const cy = box.y + box.height / 2;
  await touch('touchStart', box.x + box.width * 0.2, cy);
  for (let i = 1; i <= 6; i++) await touch('touchMove', box.x + box.width * (0.2 + 0.1 * i), cy);
  await touch('touchEnd'); await page.waitForTimeout(150);
  ok(Math.abs(parseFloat(await pos()) - 80) < 2 && await cur() === 61, '터치로 끌기: 경계 80%, 장은 그대로 → ' + (await pos()));

  // 터치 스와이프
  await goto(12);
  await touch('touchStart', 900, 400); for (let i = 1; i <= 5; i++) await touch('touchMove', 900 - i * 60, 405); await touch('touchEnd'); await page.waitForTimeout(150);
  ok(await cur() === 13, '왼쪽으로 스와이프 → 다음');
  await touch('touchStart', 300, 400); for (let i = 1; i <= 5; i++) await touch('touchMove', 300 + i * 60, 405); await touch('touchEnd'); await page.waitForTimeout(150);
  ok(await cur() === 12, '오른쪽으로 스와이프 → 이전');

  // 66 → 67 원
  await goto(66); await press('ArrowRight');
  const grow = await page.evaluate(() => { const c = document.querySelector('.slide.active .circle'); return { cls: c.classList.contains('grow'), anim: c.getAnimations().map((a) => a.animationName) }; });
  ok(grow.cls && grow.anim.includes('circleGrow'), '66→67: 원이 커지는 애니메이션');
  await page.waitForTimeout(1200);
  ok(await page.evaluate(() => document.querySelector('.slide.active .circle').getBoundingClientRect().width) > 600 * 1280 / 1920, '애니메이션 뒤 큰 원');
  await goto(65); await goto(67);
  ok(await page.evaluate(() => !document.querySelector('.slide.active .circle').classList.contains('grow')), '65→67(번호 이동): 처음부터 큰 원, 애니메이션 없음');

  // 움직임: 장에 들어오면 요소 애니메이션이 돈다
  const noAnim = [];
  for (let n = 1; n <= 77; n++) {
    await goto(n);
    const c = await page.evaluate(() => { const s = document.querySelector('#deck > .slide.active'); return s.classList.contains('play') ? document.getAnimations().filter((a) => a.effect.target && s.contains(a.effect.target)).length : -1; });
    if (c <= 0) noAnim.push(n);
  }
  ok(noAnim.length === 0, '움직임: 77장 모두 들어올 때 애니메이션이 돈다' + (noAnim.length ? ' → 없음: ' + noAnim.join(',') : ''));
  await goto(30); await page.waitForTimeout(200); await press('ArrowRight');
  const wipe = await page.evaluate(() => [...document.querySelectorAll('#deck > .slide')].map((s) => s.className).filter((c) => /enter-|leave-/.test(c)).join(' | '));
  ok(/enter-next/.test(wipe) && /leave-next/.test(wipe), '같은 이야기 안에서는 닦아 내는 장 전환 → ' + wipe);
  await page.waitForTimeout(1100); await press('ArrowRight');
  const sw = await page.evaluate(() => ({ go: document.getElementById('sweep').classList.contains('go'), text: document.getElementById('sweep').textContent }));
  ok(sw.go && sw.text === '노동', '이야기가 바뀌면(31→32) 색 띠가 지나감 → ' + sw.text);
  await page.waitForTimeout(1100);
  await press('KeyM');
  const off = await page.evaluate(() => ({ flag: getComputedStyle(document.getElementById('motionflag')).display, motion: document.getElementById('stage').classList.contains('motion') }));
  await press('ArrowRight'); await page.waitForTimeout(50);
  const offAnims = await page.evaluate(() => document.getAnimations().map((a) => (a.animationName || a.transitionProperty) + '@' + (a.effect.target.id || a.effect.target.className)));
  ok(off.flag !== 'none' && !off.motion && offAnims.length === 0, 'M: 움직임 끄면 애니메이션 없음, "움직임 끔" 표시 → ' + JSON.stringify({ flag: off.flag, motion: off.motion, offAnims }));
  await press('KeyM');
  ok(await page.evaluate(() => document.getElementById('stage').classList.contains('motion')), 'M 다시: 움직임 켜짐');

  // 장마다 구성
  const facts = await page.evaluate(() => {
    const slides = [...document.querySelectorAll('#deck > .slide')];
    const by = (n) => slides[n - 1];
    const vis = (el) => el && getComputedStyle(el).display !== 'none';
    const rows = (n) => [...by(n).querySelectorAll('tbody tr')].map((tr) => ({ name: tr.cells[0].textContent, filled: !tr.classList.contains('empty'), hl: tr.classList.contains('hl'), bg: getComputedStyle(tr.cells[1]).backgroundColor }));
    const cal = [...by(33).querySelectorAll('.cal > div')];
    const firstIdx = cal.findIndex((d) => d.classList.contains('d') && d.textContent.trim().startsWith('1') && d.textContent.includes('노동절'));
    return {
      board: slides.filter((s) => s.querySelector('.board-icon')).map((s) => +s.dataset.n),
      mark08: getComputedStyle(by(8).querySelector('mark')).backgroundColor,
      mark09: getComputedStyle(by(9).querySelector('mark')).backgroundColor,
      same: by(8).querySelector('.source-box').textContent === by(9).querySelector('.source-box').textContent,
      fig43: vis(by(43).querySelector('figure')), fig49: vis(by(49).querySelector('figure')),
      text43: vis(by(43).querySelector('.big')),
      phCount: document.querySelectorAll('#deck figure.ph.missing').length,
      phLeft: [...document.querySelectorAll('#deck figure.ph')].filter((f) => !f.classList.contains('missing') && !f.classList.contains('gone')).length,
      calHead: cal[(firstIdx - 7) % 7].textContent, calCol: (firstIdx - 7) % 7,
      r31: rows(31), r47: rows(47), r70: rows(70), r71: rows(71),
      pattern: [73, 74, 75, 76].map((n) => [...by(n).querySelectorAll('.pt-step')].filter((e) => !e.classList.contains('later')).length),
      tail: [73, 74, 75, 76].map((n) => by(n).querySelector('.pt-tail').classList.contains('later') ? 'hidden' : 'visible'),
      parts: slides.map((s) => s.dataset.part),
    };
  });
  ok(JSON.stringify(facts.board) === '[19,29,45,57,67]', '연필 아이콘은 19,29,45,57,67에만 → ' + facts.board.join(','));
  ok(facts.mark08 === 'rgba(0, 0, 0, 0)' && facts.mark09 === 'rgb(255, 228, 92)' && facts.same, '08 강조 없음, 09만 형광펜, 본문은 같음');
  ok(!facts.fig43 && !facts.fig49 && facts.text43, '43·49: 사진 없으면 이미지 자리 숨김, 글자는 보임');
  ok(facts.phLeft === 0, `사진 없을 때 자리표시 ${facts.phCount}개, 빈 틀 없음`);
  ok(facts.calHead === '금' && facts.calCol === 5, '33: 5월 1일이 금요일 칸');
  const sumOk = (r, fill, hl) => r.every((x) => x.filled === fill.includes(x.name) && x.hl === hl.includes(x.name));
  const all = ['민권', '여성', '노동', '반전 평화', '환경'];
  ok(sumOk(facts.r31, ['민권', '여성'], ['민권', '여성']), '31: 민권·여성 채움, 둘 다 강조');
  ok(sumOk(facts.r47, ['민권', '여성', '노동'], ['노동']), '47: 노동까지 채움, 노동만 강조');
  ok(sumOk(facts.r70, all, ['반전 평화', '환경']), '70: 전부 채움, 반전 평화·환경 강조');
  ok(sumOk(facts.r71, all, []) && facts.r71.every((x) => x.bg === 'rgba(0, 0, 0, 0)'), '71: 전부 채움, 강조 없음');
  ok(JSON.stringify(facts.pattern) === '[1,2,3,4]' && JSON.stringify(facts.tail) === '["hidden","hidden","hidden","visible"]', '73–76: 단계가 하나씩 늘고 끝 화살표는 76에만');

  // 진행 표시
  const bands = [];
  for (const n of [1, 2, 3, 4, 31, 32, 47, 48, 70, 71, 77]) {
    await goto(n);
    bands.push(await page.evaluate(() => { const on = document.querySelector('#progress .on'); const band = getComputedStyle(document.getElementById('progress')).display; return band === 'none' ? '없음' : on.textContent; }));
  }
  ok(bands.join(',') === '없음,도입,도입,평등,평등,노동,노동,생존,생존,정리,정리', '진행 표시 구간 → ' + bands.join(','));
  const expectPart = (n) => n <= 3 ? 'intro' : n <= 31 ? 's1' : n <= 47 ? 's2' : n <= 70 ? 's3' : 'outro';
  ok(facts.parts.every((p, i) => p === expectPart(i + 1)), '모든 장의 data-part가 구간과 일치');

  // 전체 화면 키 (헤드리스에서는 실제로 바뀌지 않아도 오류가 없어야 한다)
  await press('KeyF'); await page.waitForTimeout(100);

  // 한글 입력 상태에서도 글자 키 동작 (e.code 사용)
  await goto(20);
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ㅜ', code: 'KeyN', bubbles: true })));
  ok(await page.evaluate(() => getComputedStyle(document.getElementById('notes-panel')).display === 'block'), '한글 자판 상태(ㅜ)에서도 N 동작');
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Process', code: 'KeyN', bubbles: true })));

  ok(errors.length === 0, '스크립트 오류 없음' + (errors.length ? ' → ' + errors.join(' | ') : ''));

  // 움직임 줄이기 설정
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const p2 = await ctx2.newPage();
  await p2.goto(url + '#66');
  await p2.keyboard.press('ArrowRight'); await p2.waitForTimeout(50);
  const rm = await p2.evaluate(() => ({ grow: document.querySelector('.slide.active .circle').classList.contains('grow'), moving: !!document.querySelector('.slide.play, .slide.leaving') || document.getAnimations().length > 0, w: document.querySelector('.slide.active .circle').getBoundingClientRect().width }));
  ok(!rm.grow && !rm.moving && rm.w > 600 * 1280 / 1920, 'prefers-reduced-motion: 움직임 없음, 바로 큰 원');

  await browser.close();
  console.log(fails ? `\n${fails}개 실패` : '\n모두 통과');
  process.exit(fails ? 1 : 0);
})();
