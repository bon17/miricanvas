# 인계: 「민주주의와 인권의 확산」 수업 슬라이드

중2 역사 Ⅶ-02 「민주주의와 인권의 확산」(교과서 228~233쪽) 45분 수업용 HTML 슬라이드 78장과, 그 위에서 도는 슬라이드 엔진에 대한 인계입니다. 다음 작업을 시작하기 전에 이 문서를 먼저 읽어 주세요.

## 1. 어디에 있나

- 저장소: `bon17/miricanvas`
- 브랜치: `claude/new-session-pkcg61`
  - 마지막 작업 커밋은 "슬라이드 엔진(A안…)을 따로 만들고 78장 수업 파일에 넣음"입니다.
  - 아직 기본 브랜치에 합치지 않았고, PR도 없습니다.
  - 이 브랜치에서 이어서 작업합니다.
- 새 계정에서 저장소가 안 보이면 사용자에게 저장소 접근 권한을 받아야 합니다.

```
democracy/
├── index.html      ← 수업 슬라이드 78장 (슬라이드 HTML + 이 덱의 CSS + 덱 스크립트 + 엔진이 한 파일에)
├── README.md       ← 교사용 설명서 (조작, 고치는 법, 파일 하나로 만들기, 검수)
├── HANDOFF.md      ← 이 문서
├── fonts/          ← Black Han Sans, IBM Plex Sans KR (SIL OFL, 쓰는 글자만 남긴 woff2)
├── images/         ← 사진 넣는 곳. README.txt 만 저장소에 있다 (아래 3번)
└── dist/           ← 파일 하나로 묶은 결과물. 저장소에 올리지 않는다
engine/
├── se.css, src/00-core.js … 40-edit.js   ← 슬라이드 엔진 (디자인과 분리)
├── demo.html       ← 엔진 견본 덱 (모든 모션 · 상호작용)
└── README.md       ← 엔진 사용법, data- 속성 목록, 덱 스크립트 API
tools/democracy/    ← build_single.py, extract_images.py, check.js, interact.js, subset_fonts.py
tools/engine/       ← inject.py (엔진을 슬라이드 파일에 넣기), test.js (엔진 검수)
slides/             ← 별개의 '냉전' 덱 (build.py 로 만듦). 이번 작업에서 건드리지 않았다
```

## 2. 꼭 지킬 것

- **교과서 사진은 저작권이 있어 저장소에 올리지 않습니다.**
  - `democracy/images/*`(README.txt 제외)와 `democracy/dist/`는 .gitignore 에 들어 있습니다.
  - 사진이 든 결과 파일은 사용자에게 파일로만 보냅니다.
- **엔진 칸은 손으로 고치지 않습니다.**
  - `democracy/index.html` 안의 `<style id="se-css">`와 `<script id="se-js">` 두 칸이 엔진입니다.
  - 엔진을 바꿀 때는 `engine/se.css`, `engine/src/*.js`를 고칩니다.
  - 그다음 아래를 실행해 두 파일에 반영합니다. inject.py 는 줄 맨 앞의 `<style id="se-css">` / `<script id="se-js">`만 찾습니다. 주석 안에 이 태그 글자를 쓰지 마세요.

```bash
python3 -I tools/engine/inject.py democracy/index.html engine/demo.html
```

- **실행 중에만 바꾸는 것은 `SE.rt`로 바꿉니다.**
  - `rt.cls`, `rt.css`, `rt.attr`, `rt.html`, `rt.node`를 씁니다.
  - 편집 모드에서 Ctrl+S로 저장할 때 엔진이 이 기록을 보고 원래대로 되돌립니다. 그래서 저장 파일에 실행 흔적이 남지 않습니다.
  - 덱 스크립트에서 DOM을 직접 바꾸면 저장 파일에 섞여 들어갑니다.
- 숨은 요소를 다시 보일 때는 `visibility:visible`이 아니라 `inherit`을 씁니다. `visible`을 쓰면 숨긴 장 위로 그 요소만 남아 보이는 버그가 났었습니다.
- 커밋 메시지는 한국어로 씁니다. 모델 이름은 넣지 않습니다. PR은 사용자가 요청할 때만 만듭니다.

## 3. 사진 받기 (새 환경에서)

저장소에는 사진이 없습니다. 사용자가 가진 `민주주의와 인권의 확산.html`(약 10MB, 사진 36장이 data URI로 들어 있음)을 받아 아래로 꺼냅니다.

```bash
python3 -I tools/democracy/extract_images.py "받은파일.html" democracy/images
```

- 파일 목록과 각 사진이 쓰이는 장은 `democracy/images/README.txt`에 있습니다(교과서 사진 19장, 따로 구한 사진 17장).
- 사진이 없으면 슬라이드에는 점선 자리표시(파일명 · 설명 · 쪽수)가 나옵니다. 오류는 아닙니다.
- 사진을 다 넣은 결과 파일 만들기:

```bash
python3 -I tools/democracy/build_single.py "democracy/dist/민주주의와 인권의 확산.html" democracy/images
```

- build_single.py 는 글꼴과 사진을 data URI로 넣습니다. 같은 사진은 처음 한 곳(`data-src-key`)에만 넣고, 나머지는 `data-src-ref`로 가리킵니다. 그 연결은 덱 스크립트가 실행할 때 채웁니다.

## 4. 덱 구조 (78장)

| 구간(`data-part`) | 장 | 진행 띠 이름 |
| --- | --- | --- |
| intro | 1–3 | 도입 |
| s1 | 4–32 | 평등 |
| s2 | 33–48 | 노동 |
| s3 | 49–71 | 생존 |
| outro | 72–78 | 정리 |

- **선택 장(`data-hidden`)**: 19, 26, 38, 47, 50, 70. 이 덱은 처음에 건너뛰지 않도록 설정했습니다(`skipHidden:false`). S 키로 바꿉니다.
- **판서 장(`data-board="true"`, 연필 아이콘)**: 20, 30, 46, 58, 68
- **단계(`data-step`, 다음 키로 답이 나타남)**: 14(남아공 칸), 20·21(답 카드), 37(8시간 셋)
- **정리표(`data-layout="summary"`)**: 32, 48, 71, 72. 표는 `<template id="summary-data">` 한 곳에서 만듭니다.
- **패턴(`data-layout="pattern"`, `data-pattern="1~4"`)**: 74–77. `<template id="pattern-data">` 한 곳에서 만듭니다.
- 생성된 표 · 패턴에는 `data-se-proxy`가 붙어 있습니다. 편집 모드에서 그 칸을 고치면 덱 스크립트가 템플릿에 옮겨 적고 같은 데이터를 쓰는 장을 모두 다시 만듭니다.
- **08 · 09 연설문**: 본문은 08번 `#speech` 한 곳에만 있고, 09번(`data-same-as="speech"`)은 실행할 때 복사됩니다. 09번은 편집 모드에서 잠겨 있습니다.
- **62번**: 아랄해 1989/2008 비교 슬라이더(덱 스크립트)
- **61 · 62번**: 사진 틀 너비를 1989 사진 비율에 맞춥니다.
- **67→68**: 67번에서 넘어올 때만 원이 커집니다(`data-grow-from="67"`).
- **장마다 붙은 속성**: `data-n`(01–78, 고정 ID로 씀), `data-part`, `data-layout`, `data-title`. 교사 메모는 `aside.notes`입니다.
- **사진 틀**: `figure.ph > img`에 `data-desc`, `data-page`, `data-focus`(잘리는 위치), `data-zoom`(28번), `data-fit="contain"`, `data-optional-image`가 붙습니다.
  - 사진 장 · 사진과 질문 장 · 오른쪽 사진 단은 틀이 사진 비율에 맞춰집니다(`fitFrames`, 잘리지 않게).
  - 콜라주 · 카드 · 패턴의 작은 사진은 틀에 맞춰 잘립니다.
- **이 덱의 모션**: 덱 CSS의 `.motion .play …` 규칙입니다. 엔진은 장에 들어올 때 `play`, 무대에 `motion`을 붙입니다.
  - 이야기(part)가 바뀔 때는 덱이 정의한 `sweep` 전환(색 띠)이 돌고, 그 장은 `after-sweep`(`--base:.6s`)이 됩니다.
  - 큰 연도는 엔진의 숫자 올라가기(`data-count`, 덱이 실행 중에 붙임)를 씁니다.
- **덱 스크립트**: `index.html` 맨 아래 두 번째 `<script>`입니다. `SE.config`, `SE.on('prepare'|'enter'|'leave'|'layout'|'choosetransition'|'proxyedit'|'textstart'|'textedit'|'newslide')`, `SE.defineTransition('sweep')`를 씁니다.

## 5. 엔진 (A안: 구석의 둥근 단추와 부채꼴 메뉴)

- **UI**: 왼쪽 아래 둥근 단추(네 구석으로 끌어 옮길 수 있음)를 누르면 이동 · 필기 · 발표 도구 · 칠판 · 편집 · 설정이 부채꼴로 펼쳐집니다.
  - 색은 칠판 초록 `#1F2D27`, 분필 흰색 `#EDEFE6`, 분필 노랑 `#F1D35C`입니다.
  - 사용자가 다음 세 가지는 쓰지 말라고 했습니다: 아래쪽에 길게 늘어선 아이콘+글자 툴바, 오른쪽 세로 툴바, 주황색 강조.
- **기능**: 엔진 README 와 `?` 키 단축키 목록에 다 있습니다.
  - 이동 · 단계 · 목차 · 썸네일 · 숨긴 장
  - 필기: 펜(필압) · 형광펜 · 지우개 · 레이저, 장마다 브라우저 localStorage 에 무대 좌표로 저장
  - 칠판(여러 장), 타이머, 뽑기, 색종이, 검은/흰 화면, 효과음, 발표자 보기(새 창)
  - 전체 화면(슬라이드와 쪽 번호만, 가장자리에서 도구가 잠깐 나타남)
  - 편집 모드: 선택 · 이동 · 크기 · 회전 · 스타일 · 추가 · 정렬 · 모션 지정 · 장 관리 · 되돌리기 · 파일 저장 · IndexedDB 임시 저장과 복구 · 점검
  - 모션 강도(끄기 · 차분 · 기본 · 화려) · 속도 · 테마 · 도구 위치
- **알려진 한계**
  - 필기는 파일이 아니라 브라우저에 저장됩니다. 다른 컴퓨터에서는 보이지 않습니다.
  - '어둡게' 테마는 화면 색을 뒤집는 방식입니다(사진은 원래 색).
  - 발표자 보기는 팝업이라 브라우저가 막으면 허용해야 합니다.
  - 모션 설정 창은 작은 화면에서 스크롤됩니다.
  - 냉전 덱(`slides/`)에는 아직 엔진을 넣지 않았습니다.

## 6. 검수 (바꾼 뒤 꼭 돌리기)

```bash
node tools/democracy/check.js democracy/index.html [스크린샷폴더] 1920x1080
```

```bash
node tools/democracy/interact.js
```

```bash
node tools/engine/test.js
```

- **check.js**: 78장 번호, 글꼴, 콘솔 오류를 봅니다. 장마다 무대 밖 글자, 넘침, 32px 미만 글자, 아래 여백 침범을 찾고 스크린샷을 남깁니다. 사진이 없을 때 생기는 `ERR_FILE_NOT_FOUND`만 정상입니다.
- **interact.js**: 사진이 없는 저장소 상태를 기준으로 합니다. 사진이 든 dist 파일에 돌리면 '사진 없을 때' 두 항목만 실패하는데, 정상입니다. 처음 명세(77장) 번호를 `N(old)`로 바꿔 씁니다(13번 뒤에 14번이 들어감).
- **engine/test.js**: 견본 덱으로 엔진 기능 전체를 실제로 눌러 봅니다.
- 작업한 시점에는 세 검사가 모두 통과했습니다.
- 헤드리스 Chromium과 Playwright를 씁니다. 화면 확인은 check.js 스크린샷으로 합니다.
- 글꼴을 다시 줄이려면(`tools/democracy/subset_fonts.py`) 원본 TTF가 필요합니다. 저장소에는 없으니 IBM Plex Sans KR, Black Han Sans(SIL OFL) 원본을 받아서 씁니다.

## 7. 사용자에 대해

- 한국어로 답합니다. 짧고 쉬운 말을 좋아합니다.
- 교실 전자칠판(터치)과 크롬 · 엣지 · 웨일에서, 인터넷 없이 파일을 더블클릭해 엽니다.
- 결과물은 파일 하나로 내려받아 쓰는 것을 좋아합니다.
- 이전에 요청 · 지적한 것:
  - 화려한 모션, 여백이 적고 이미지가 많은 화면
  - 사진이 틀에 잘리지 않을 것
  - 답 보이기 단계
  - 전체 화면에서 편집 버튼이 보이지 않을 것
  - 넘긴 뒤 답 상자가 남지 않을 것(고침)
- UI를 크게 바꾸기 전에는 시안을 2~3개 먼저 보여 달라고 했습니다.
