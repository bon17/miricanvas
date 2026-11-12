"""파일 하나로 묶은 수업 파일(build_single.py 결과)에서 사진을 꺼내 images 폴더에 다시 놓는다.

교과서 사진은 저작권 때문에 저장소에 올리지 않는다. 새 컴퓨터나 새 작업 환경에서는
이전에 받은 '민주주의와 인권의 확산.html'(사진이 들어 있는 파일)에서 사진을 꺼내 쓴다.

사용법:
  python3 -I tools/democracy/extract_images.py <묶은 파일.html> [사진 폴더]
    사진 폴더를 생략하면 democracy/images 에 넣는다. 같은 이름의 파일은 덮어쓴다.
"""
import base64
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}


def main() -> int:
    if len(sys.argv) not in (2, 3):
        print(__doc__)
        return 2
    src = pathlib.Path(sys.argv[1])
    out = pathlib.Path(sys.argv[2]) if len(sys.argv) == 3 else ROOT / "democracy" / "images"
    out.mkdir(parents=True, exist_ok=True)
    html = src.read_text(encoding="utf-8")
    # build_single.py 는 같은 사진을 처음 한 곳에만 넣는다: src="data:…" data-src-key="파일명"
    pat = re.compile(r'src="data:(image/[a-z+]+);base64,([A-Za-z0-9+/=]+)"\s+data-src-key="([^"]+)"')
    names = []
    for m in pat.finditer(html):
        mime, data, name = m.groups()
        name = pathlib.Path(name).name  # 폴더 이름이 섞여 있어도 파일 이름만 쓴다
        if not name or name.startswith("."):
            continue
        (out / name).write_bytes(base64.b64decode(data))
        names.append(name)
    print(f"{out}: 사진 {len(names)}장을 꺼냈습니다")
    for n in sorted(names):
        print("  " + n)
    return 0 if names else 1


if __name__ == "__main__":
    sys.exit(main())
