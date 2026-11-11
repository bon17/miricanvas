// democracy/index.html 검수 스크립트 (헤드리스 Chromium + Playwright)
//
//   node tools/democracy/check.js [index.html 경로] [스크린샷 폴더] [창 너비x높이]
//
// - 77장 번호, 콘솔 오류, 글꼴 로드 여부
// - 장마다: 무대 밖으로 나간 글자, 넘친 글상자, 진행 표시 띠와 겹친 내용, 32px 미만 학생용 글자
// - 장마다 스크린샷(1920×1080 무대 기준)
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const file = path.resolve(process.argv[2] || path.join(__dirname, '../../democracy/index.html'));
const outDir = process.argv[3] ? path.resolve(process.argv[3]) : null;
const [vw, vh] = (process.argv[4] || '1920x1080').split('x').map(Number);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, offline: true, reducedMotion: 'reduce' }); // 인터넷 없이, 움직임 없이 최종 화면
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[console.${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => { if (!/\/images\//.test(r.url())) errors.push(`[requestfailed] ${r.url()}`); });

  await page.goto('file://' + file);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  const info = await page.evaluate(() => {
    const slides = [...document.querySelectorAll('#deck > section.slide')];
    const fonts = [...document.fonts].map((f) => `${f.family} ${f.weight}: ${f.status}`);
    return { count: slides.length, nums: slides.map((s) => s.getAttribute('data-n')), fonts };
  });
  const expected = Array.from({ length: 77 }, (_, i) => String(i + 1).padStart(2, '0'));
  console.log(`slides: ${info.count}` + (JSON.stringify(info.nums) === JSON.stringify(expected) ? ' (01–77 순서 일치)' : ' !! 번호 불일치 ' + info.nums.join(',')));
  console.log('fonts: ' + info.fonts.join(' | '));

  if (outDir) fs.mkdirSync(outDir, { recursive: true });
  const problems = [];
  for (let i = 1; i <= info.count; i++) {
    await page.evaluate((n) => { location.hash = '#' + n; }, i);
    await page.waitForTimeout(420);
    const res = await page.evaluate(() => {
      const stage = document.getElementById('stage');
      const sr = stage.getBoundingClientRect();
      const k = sr.width / 1920;
      const slide = document.querySelector('#deck > section.slide.active');
      const out = [];
      const band = document.getElementById('progress');
      const bandOn = getComputedStyle(band).display !== 'none';
      const skip = (el) => el.closest('aside.notes, .ph-box, .board-icon, .later, template, .teacher');
      // 글자가 들어 있는 요소
      const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      let node;
      while ((node = walker.nextNode())) {
        if (!node.textContent.trim()) continue;
        const el = node.parentElement;
        if (skip(el) || seen.has(el)) continue;
        seen.add(el);
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.color === 'rgba(0, 0, 0, 0)') continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        const rects = [...range.getClientRects()].filter((r) => r.width > 0);
        const label = node.textContent.trim().slice(0, 24);
        const fs = parseFloat(cs.fontSize);
        if (fs < 32) out.push(`작은 글자 ${fs}px: "${label}"`);
        for (const r of rects) {
          const x0 = (r.left - sr.left) / k, x1 = (r.right - sr.left) / k;
          const y0 = (r.top - sr.top) / k, y1 = (r.bottom - sr.top) / k;
          if (x0 < -1 || x1 > 1921 || y0 < -1 || y1 > 1081) { out.push(`무대 밖: "${label}" (${x0.toFixed(0)},${y0.toFixed(0)})-(${x1.toFixed(0)},${y1.toFixed(0)})`); break; }
          if (bandOn && y0 < 56) { out.push(`진행 표시와 겹침: "${label}" y=${y0.toFixed(0)}`); break; }
          if (y1 > 1040 && x1 > 1700) { out.push(`장 번호와 겹칠 수 있음: "${label}"`); break; }
        }
      }
      // 표·사진 틀이 장 번호 자리(아래 40px)까지 내려왔는지
      for (const el of slide.querySelectorAll('table, figure.ph, .rm-cards, .pt-step, .cal')) {
        if (skip(el) || getComputedStyle(el).display === 'none') continue;
        const r = el.getBoundingClientRect();
        const y1 = (r.bottom - sr.top) / k;
        if (y1 > 1040) out.push(`아래 여백 침범: <${el.tagName.toLowerCase()} class="${el.className}"> bottom=${y1.toFixed(0)}`);
      }
      // 넘친 글상자
      for (const el of slide.querySelectorAll('p, h1, h2, li, td, figcaption, .placard, .rm-card, .pt-step, .source-box, .circle')) {
        if (skip(el)) continue;
        if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) {
          if (getComputedStyle(el).overflow !== 'visible' || el.matches('.rm-card, .pt-step, .circle, td')) out.push(`넘침: <${el.tagName.toLowerCase()} class="${el.className}"> ${el.scrollWidth}x${el.scrollHeight} > ${el.clientWidth}x${el.clientHeight}`);
        }
      }
      return { n: slide.getAttribute('data-n'), out };
    });
    if (res.out.length) problems.push(`${res.n}: ` + res.out.join(' / '));
    if (outDir) await page.locator('#stage').screenshot({ path: path.join(outDir, `${String(i).padStart(2, '0')}.png`) });
  }
  console.log(problems.length ? '문제:\n  ' + problems.join('\n  ') : '문제: 없음');
  console.log(errors.length ? '오류:\n  ' + [...new Set(errors)].join('\n  ') : '콘솔 오류: 없음');
  await browser.close();
})();
