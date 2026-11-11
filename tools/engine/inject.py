"""슬라이드 엔진(engine/)을 슬라이드 HTML 파일 안에 넣는다.

엔진은 디자인과 따로 있다. 이 도구로 어떤 슬라이드 파일에든 같은 엔진을 넣거나 새 엔진으로 바꿀 수 있다.
  - engine/se.css      → <style id="se-css"> … </style>
  - engine/src/*.js    → <script id="se-js"> … </script>  (파일 이름 순서로 이어 붙여 하나의 함수로 감싼다)

사용법:
  python3 -I tools/engine/inject.py 슬라이드.html [슬라이드2.html …]

파일에 <style id="se-css"> 가 없으면 </head> 바로 앞에, <script id="se-js"> 가 없으면
덱 스크립트(첫 번째 <script>) 바로 앞에 넣는다. 엔진 스크립트는 덱 스크립트보다 먼저 와야 한다.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
ENGINE = ROOT / "engine"


def engine_parts():
    css = (ENGINE / "se.css").read_text(encoding="utf-8").strip()
    files = sorted((ENGINE / "src").glob("*.js"))
    body = "\n\n".join(f"/* ---- {p.name} ---- */\n" + p.read_text(encoding="utf-8").strip() for p in files)
    js = "(function () {\n'use strict';\n" + body + "\n})();"
    for name, text, bad in (("se.css", css, "</style"), ("엔진 스크립트", js, "</script")):
        if bad in text.lower():
            raise SystemExit(f"{name} 안에 {bad} 가 있어 HTML 에 넣을 수 없습니다")
    return css, js


def inject(path: pathlib.Path, css: str, js: str) -> None:
    html = path.read_text(encoding="utf-8")
    style = f'<style id="se-css">\n{css}\n</style>'
    script = f'<script id="se-js">\n{js}\n</script>'
    # 줄 맨 앞에 있는 칸만 찾는다 (주석 안의 글자와 헷갈리지 않게)
    pat_s = re.compile(r'^<style id="se-css">.*?</style>', re.S | re.M)
    pat_j = re.compile(r'^<script id="se-js">.*?</script>', re.S | re.M)
    if pat_s.search(html):
        html = pat_s.sub(lambda m: style, html, count=1)
    else:
        i = html.lower().index("</head>")
        html = html[:i] + style + "\n" + html[i:]
    if pat_j.search(html):
        html = pat_j.sub(lambda m: script, html, count=1)
    else:
        i = html.lower().find("<script", html.lower().index("<body"))
        if i < 0:
            i = html.lower().rindex("</body>")
        html = html[:i] + script + "\n" + html[i:]
    path.write_text(html, encoding="utf-8")
    print(f"{path}: 엔진을 넣었습니다 (CSS {len(css) // 1024}KB · JS {len(js) // 1024}KB)")


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    css, js = engine_parts()
    for a in sys.argv[1:]:
        inject(pathlib.Path(a), css, js)
    return 0


if __name__ == "__main__":
    sys.exit(main())
