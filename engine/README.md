# 슬라이드 엔진

수업용 HTML 슬라이드에 넣는 기능 코드입니다. 이동, 필기, 발표 도구, 편집 모드, 모션을 맡습니다. 슬라이드 디자인과는 따로 있어서, 디자인이 다른 슬라이드 파일에도 같은 엔진을 넣을 수 있습니다.

```
engine/
├── se.css        ← 엔진의 모양 (도구 단추, 카드, 편집 표시 등. 모두 se- 로 시작)
├── src/          ← 엔진 스크립트 (00-core, 10-ui, 20-ink, 30-tools, 40-edit 순서로 이어 붙음)
├── demo.html     ← 견본 덱. 모든 모션과 상호작용이 들어 있다
└── README.md
```

## 슬라이드 파일에 넣기

```bash
python3 -I tools/engine/inject.py democracy/index.html
```

- 파일 안의 `<style id="se-css">`와 `<script id="se-js">` 칸을 새 엔진으로 바꿉니다. 칸이 없으면 만들어 넣습니다.
- 넣은 뒤에도 HTML 파일 하나입니다. 더블클릭으로 열리고, 인터넷이 없어도 됩니다. 외부 라이브러리는 쓰지 않습니다.
- 엔진을 고쳤다면 이 명령을 다시 실행해 각 슬라이드 파일에 반영합니다.

## 슬라이드 파일이 지킬 것

```html
<div id="viewport">            <!-- 화면 전체 (없으면 #stage 의 부모) -->
  <div id="stage">             <!-- 1920×1080 무대. 엔진이 화면에 맞게 확대·축소한다 -->
    <main id="deck">
      <section class="slide" data-title="표지">…<aside class="notes">교사 메모</aside></section>
      …
    </main>
  </div>
</div>
<script id="se-js"></script>   <!-- 엔진 (inject.py 가 채운다) -->
<script>SE.config({ transition: 'fade' });</script>   <!-- 덱 스크립트는 엔진 뒤에 -->
```

- 장은 `#deck` 바로 아래의 `.slide`입니다. 엔진은 지금 장에 `active`, 넘어가는 장에 `leaving`, 모션이 켜져 있으면 `play`를 붙입니다. 무대(`#stage`)에는 모션이 켜져 있으면 `motion`이 붙습니다. 덱 CSS는 `.motion .play …`로 자기 모션을 만들 수 있습니다.
- `aside.notes`는 교사 메모입니다. N 키와 발표자 보기에 나옵니다.

## 모션 (data- 속성으로 적는다)

| 속성 | 값 | 뜻 |
| --- | --- | --- |
| `data-transition` (장) | `fade` `push` `cover` `zoom` `flip` `wipe` `circle` `morph` `none` | 이 장으로 들어올 때의 전환 |
| `data-morph` | 이름 | 모프 전환 때 앞 장의 같은 이름 요소에서 이어서 움직인다 |
| `data-anim` | `fade` `up` `left` `right` `pop` `drop` `blur` `zoom` `words` `chars` `type` `stagger` | 등장 (단어씩 · 글자씩 · 타자기 · 차례로 포함) |
| `data-step` | 비움 또는 순서 숫자 | 다음 키를 누를 때 나타난다 |
| `data-delay` `data-dur` | 초 | 기다리는 시간 · 걸리는 시간 |
| `data-emph` | `pulse` `shake` `glow` `mark` `underline` `circle` `spotlight` | 강조. `data-emph-step`이 있으면 누를 때 |
| `data-exit` | `strike` `fade` `shrink` `fly` | 퇴장 (누를 때). `data-exit-step`으로 순서 |
| `data-count` | 시작 숫자 | 글자의 숫자까지 올라간다 (1,250처럼 쉼표도 됨) |
| `data-bar` | `x` 또는 `y` | 막대 자라기 |
| `data-draw` | — | 안의 SVG 선이 그려진다 |
| `data-bg` (장) | `drift` `particles` `gradient` | 배경 움직임 |
| `data-flip` | — | 뒤집기 카드 (첫째 자식이 앞면, 둘째가 뒷면) |
| `data-cover` | 덮개 글 | 누르면 걷히는 가리개 |
| `data-quiz` | — | 퀴즈. 자식이 보기이고 정답에 `data-correct` |
| `data-enlarge` | — | 누르면 크게 보기 |
| `data-hotspot` + `data-tip` | 설명 글 | 누르면 설명이 뜨는 점 |
| `data-hidden` (장) | — | 숨긴 장. 건너뛰기를 켜면 넘길 때 빠진다 |
| `data-split` | `words` `chars` | 글을 단어 · 글자 단위 `span.se-u`로 나눈다 (덱 CSS 모션용) |

모션 강도는 끄기 · 차분 · 기본 · 화려 네 단계이고(M 키, 설정), 속도는 느리게 · 보통 · 빠르게입니다. 컴퓨터의 '동작 줄이기'가 켜져 있으면 처음에는 모션을 끕니다. 차분에서는 덱 CSS의 움직임도 짧은 페이드로 바뀝니다.

## 덱 스크립트가 쓰는 것

```js
SE.config({ transition: 'wipe', sections: { s1: '평등' }, hiddenLabel: '선택', stepLabel: '답', progress: false, skipHidden: false });
SE.on('prepare', function (slide) { … });        // 장을 준비할 때 (처음, 장을 새로 넣거나 되돌렸을 때)
SE.on('enter', function (slide, ctx) { … });     // 장에 들어올 때 (ctx.prev, ctx.dir, ctx.from)
SE.on('leave', function (slide) { … });
SE.on('layout', function () { … });              // 창 크기 · 글꼴 · 사진이 바뀌었을 때 다시 맞추기
SE.on('choosetransition', function (ctx) { ctx.name = 'sweep'; });
SE.defineTransition('sweep', function (from, to, dir, opt) { return [/* Animation */]; });
```

실행 중에만 바꾸는 것은 `SE.rt`로 바꿉니다. 편집 모드에서 파일로 저장할 때 원래대로 남습니다.

- `rt.cls(el, 'on', true)`, `rt.css(el, 'width', '300px')`, `rt.attr(el, 'src', …)`, `rt.html(el, '…')`
- `rt.node(el)`: 저장할 때 빠지는 요소

글을 템플릿에서 만들어 여러 장에 넣는다면, 만든 요소에 `data-se-proxy`를 붙입니다. 편집 모드에서 그 칸을 고치면 `proxyedit` 알림이 오므로 템플릿에 옮겨 적으면 됩니다.

## 검수 (개발용)

```bash
node tools/engine/test.js
```

견본 덱으로 다음을 실제로 눌러 봅니다.

- 이동 · 단계 · 숨긴 장 · 목차 · 썸네일 · 클릭
- 강조 · 퇴장 · 숫자 · 상호작용 · 전환 · 모프
- 필기와 칠판: 펜 · 형광펜 · 지우개 · 레이저 · 되돌리기 · 장마다 저장 · 창 크기
- 발표 도구: 타이머 · 뽑기 · 색종이 · 화면 가리기 · 메모 · 발표자 보기
- 설정과 전체 화면
- 편집 모드: 선택 · 이동 · 크기 · 회전 · 스타일 · 글자 · 추가 · 복제 · 정렬 · 장 관리 · 되돌리기 · 임시 저장 복구 · 파일 저장
