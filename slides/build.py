"""슬라이드 빌드 스크립트.

src/index.html 안의 {{img:이름}} 자리를 assets/이름.jpg 의 data URI 로 바꿔
이미지가 모두 들어간 단일 파일 dist/index.html 을 만든다.

assets/PretendardVariable.woff2 가 있고 fontTools(+brotli)가 설치돼 있으면
슬라이드에 쓰인 글자만 남긴 Pretendard 폰트를 파일 안에 넣어
인터넷이 없는 교실 PC에서도 같은 글꼴로 보이게 한다.
없으면 CDN 링크를 그대로 둔다.

사용법:  python3 slides/build.py
"""
import base64
import io
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src" / "index.html"
ASSETS = ROOT / "assets"
OUT = ROOT / "dist" / "index.html"
FONT = ASSETS / "PretendardVariable.woff2"
CDN_LINK = re.compile(r'<link rel="stylesheet" href="https://cdn\.jsdelivr\.net/gh/orioncactus/pretendard[^"]*">\n?')


def embed_font(html: str) -> str:
    if not FONT.exists():
        print("font: assets/PretendardVariable.woff2 없음 → CDN 사용")
        return html
    try:
        from fontTools import subset
        from fontTools.ttLib import TTFont
    except ImportError:
        print("font: fontTools 미설치 → CDN 사용 (pip install fonttools brotli)")
        return html

    # 소스에 나오는 글자 + 편집 모드에서 새로 칠 글자(자주 쓰는 한글 2350자, 기호)
    chars = set(html)
    for lo, hi in [(0x20, 0x7F), (0xA0, 0x100), (0x2000, 0x2070), (0x2190, 0x2200),
                   (0x2460, 0x2500), (0x25A0, 0x2600), (0x3000, 0x3040), (0x3131, 0x318F)]:
        chars |= {chr(c) for c in range(lo, hi)}
    for a in range(0xB0, 0xC9):  # KS X 1001 완성형 한글
        for b in range(0xA1, 0xFF):
            try:
                chars.add(bytes([a, b]).decode("euc-kr"))
            except UnicodeDecodeError:
                pass
    text = "".join(sorted(c for c in chars if ord(c) >= 0x20))

    font = TTFont(str(FONT))
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(text=text)
    sub.subset(font)
    buf = io.BytesIO()
    font.flavor = "woff2"
    font.save(buf)
    data = base64.b64encode(buf.getvalue()).decode("ascii")
    face = (
        "<style>@font-face{font-family:\"Pretendard Variable\";font-weight:45 920;"
        "font-style:normal;font-display:block;"
        f"src:url(data:font/woff2;base64,{data}) format(\"woff2\")}}</style>\n"
    )
    print(f"font: {len(text)} glyphs embedded ({len(buf.getvalue()) / 1e3:.0f} KB)")
    html, n = CDN_LINK.subn(face, html, count=1)
    if not n:
        html = html.replace("</head>", face + "</head>", 1)
    return html


def main() -> int:
    html = SRC.read_text(encoding="utf-8")
    missing = []
    cache = {}

    def repl(m):
        name = m.group(1)
        if name not in cache:
            path = ASSETS / f"{name}.jpg"
            if not path.exists():
                missing.append(name)
                cache[name] = ""
            else:
                data = base64.b64encode(path.read_bytes()).decode("ascii")
                cache[name] = f"data:image/jpeg;base64,{data}"
        return cache[name]

    html = embed_font(html)
    html = re.sub(r"\{\{img:([a-z0-9_]+)\}\}", repl, html)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size / 1e6:.1f} MB), images: {len(cache)}")
    if missing:
        print("missing images:", ", ".join(sorted(set(missing))))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
