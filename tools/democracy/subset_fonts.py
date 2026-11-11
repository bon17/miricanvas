"""democracy/fonts 의 웹폰트(woff2)를 만든다.

원본 글꼴(SIL OFL)은 google/fonts 저장소에서 받는다.
  https://github.com/google/fonts/tree/main/ofl/blackhansans
  https://github.com/google/fonts/tree/main/ofl/ibmplexsanskr

슬라이드에 쓰인 글자 + 자주 쓰는 한글 2,350자(KS X 1001) + 영문·숫자·문장 부호만 남긴다.
교사가 문구를 고쳐도 대부분의 글자가 같은 글꼴로 보이도록 2,350자를 함께 넣는다.

사용법:
  pip install fonttools brotli
  python3 -I tools/democracy/subset_fonts.py <원본 ttf 폴더>
    (폴더 안에 BlackHanSans-Regular.ttf, IBMPlexSansKR-Regular.ttf,
     IBMPlexSansKR-SemiBold.ttf, IBMPlexSansKR-Bold.ttf 가 있어야 한다)
"""
import pathlib
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parents[2]
DECK = ROOT / "democracy"
OUT = DECK / "fonts"
FONTS = [
    "BlackHanSans-Regular",
    "IBMPlexSansKR-Regular",
    "IBMPlexSansKR-SemiBold",
    "IBMPlexSansKR-Bold",
]


def charset() -> str:
    chars = set((DECK / "index.html").read_text(encoding="utf-8"))
    ranges = [
        (0x20, 0x7F),      # 영문·숫자·기호
        (0xA0, 0x100),     # 라틴-1 기호 (· 등)
        (0x2000, 0x2070),  # 문장 부호 (… ‘ ’ “ ” – —)
        (0x2160, 0x2190),  # 로마 숫자 (Ⅶ)
        (0x2190, 0x2200),  # 화살표 (→)
        (0x2460, 0x2500),  # 원 숫자 (①②③)
        (0x3000, 0x3040),  # CJK 기호 (「」 등)
        (0x3131, 0x318F),  # 한글 자모
    ]
    for lo, hi in ranges:
        chars |= {chr(c) for c in range(lo, hi)}
    for a in range(0xB0, 0xC9):  # KS X 1001 완성형 한글 2,350자
        for b in range(0xA1, 0xFF):
            try:
                chars.add(bytes([a, b]).decode("euc-kr"))
            except UnicodeDecodeError:
                pass
    return "".join(sorted(c for c in chars if ord(c) >= 0x20))


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 2
    src = pathlib.Path(sys.argv[1])
    text = charset()
    OUT.mkdir(parents=True, exist_ok=True)
    for name in FONTS:
        font = TTFont(str(src / f"{name}.ttf"))
        opts = subset.Options()
        opts.flavor = "woff2"
        opts.layout_features = ["*"]
        opts.name_IDs = ["*"]
        opts.notdef_outline = True
        sub = subset.Subsetter(opts)
        sub.populate(text=text)
        sub.subset(font)
        font.flavor = "woff2"
        dest = OUT / f"{name}.woff2"
        font.save(str(dest))
        print(f"{dest.relative_to(ROOT)}: {len(font.getGlyphOrder())} glyphs, {dest.stat().st_size / 1e3:.0f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
