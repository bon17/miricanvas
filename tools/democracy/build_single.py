"""democracy/index.html 을 파일 하나로 묶는다 (내려받아 바로 여는 용).

fonts/*.woff2 와 사진 폴더에 있는 사진을 data URI 로 HTML 안에 넣는다.
사진 폴더에 없는 사진은 원래대로 images/파일명 을 가리키므로, 결과 파일 옆에
images 폴더를 두고 그 사진을 넣으면 그대로 보인다. 없으면 자리표시가 나온다.

사용법:
  python3 -I tools/democracy/build_single.py <결과.html> [사진 폴더]
    사진 폴더를 생략하면 democracy/images 를 쓴다.

교과서 사진이 들어간 결과 파일은 저장소에 올리지 않는다 (.gitignore: democracy/dist/).
"""
import base64
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
DECK = ROOT / "democracy"
MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif"}


def data_uri(path: pathlib.Path, mime: str) -> str:
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"


def main() -> int:
    if len(sys.argv) not in (2, 3):
        print(__doc__)
        return 2
    out = pathlib.Path(sys.argv[1])
    images = pathlib.Path(sys.argv[2]) if len(sys.argv) == 3 else DECK / "images"
    html = (DECK / "index.html").read_text(encoding="utf-8")

    def font(m):
        return f'url("{data_uri(DECK / "fonts" / m.group(1), "font/woff2")}")'

    html, n_fonts = re.subn(r'url\("fonts/([^"]+\.woff2)"\)', font, html)

    cache, embedded, missing = {}, set(), set()

    def image(m):
        name = m.group(1)
        if name not in cache:
            path = images / name
            mime = MIME.get(path.suffix.lower())
            if path.is_file() and mime:
                cache[name] = data_uri(path, mime)
                embedded.add(name)
            else:
                cache[name] = None
                missing.add(name)
        return f'src="{cache[name]}"' if cache[name] else m.group(0)

    html = re.sub(r'src="images/([^"]+)"', image, html)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"{out}: {out.stat().st_size / 1e6:.1f} MB · 글꼴 {n_fonts}개 · 사진 {len(embedded)}장 넣음")
    if missing:
        print("사진 없음(자리표시로 보임):", ", ".join(sorted(missing)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
