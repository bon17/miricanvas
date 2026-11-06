"""원본 학습지(hwpx) 뒤에 페이지를 덧붙인다. 원본 내용은 건드리지 않는다.

python3 -I worksheet.py <원본.hwpx> <결과.hwpx>
"""
import re
import sys
import zipfile
from xml.sax.saxutils import escape

SRC, OUT = sys.argv[1], sys.argv[2]

# 원본 문서에 이미 있는 스타일 번호 (header.xml)
PP_JUST, PP_CENTER, PP_BULLET, PP_LEFT, PP_TOP = 0, 19, 39, 43, 37
CP_BODY, CP_BOLD, CP_SUB, CP_HEAD12, CP_TEXT11, CP_RED = 34, 33, 38, 39, 40, 44
BF_LINE, BF_GRAY = 3, 20
W = 53294  # 원본 표 너비

_id = [1239340000]


def nid():
    _id[0] += 1
    return _id[0]


_z = [40]


def nz():
    _z[0] += 1
    return _z[0]


def run(cp, text=None):
    if text is None:
        return f'<hp:run charPrIDRef="{cp}"/>'
    return f'<hp:run charPrIDRef="{cp}"><hp:t>{escape(text)}</hp:t></hp:run>'


def cpara(pp, runs):
    """표 칸 안 문단. runs: [(charPr, text)] 또는 [] (빈 줄)"""
    body = ''.join(run(c, t) for c, t in runs) if runs else run(CP_BODY)
    return (f'<hp:p id="2147483648" paraPrIDRef="{pp}" styleIDRef="0" pageBreak="0" '
            f'columnBreak="0" merged="0">{body}</hp:p>')


def para(pp, runs, page_break=False):
    """본문 문단"""
    body = ''.join(run(c, t) for c, t in runs) if runs else run(CP_BODY)
    return (f'<hp:p id="0" paraPrIDRef="{pp}" styleIDRef="0" pageBreak="{1 if page_break else 0}" '
            f'columnBreak="0" merged="0">{body}</hp:p>')


def blank_runs(parts):
    """'글 ( 답 ) 글' 형태: parts = ['앞 글', ('답',), '뒤 글', ...] → 빈칸 안 답은 빨간 기울임(원본 방식)"""
    out = []
    for p in parts:
        if isinstance(p, tuple):
            out += [(CP_BODY, '(  '), (CP_RED, p[0]), (CP_BODY, '      )')]
        else:
            out.append((CP_BODY, p))
    return out


class Cell:
    def __init__(self, paras, cs=1, rs=1, bf=BF_LINE, va='CENTER'):
        self.paras, self.cs, self.rs, self.bf, self.va = paras, cs, rs, bf, va


def C(text, **kw):  # 가운데 정렬 보통 글
    return Cell([cpara(PP_CENTER, [(CP_BODY, text)])], **kw)


def H(text, **kw):  # 회색 머리 칸
    kw.setdefault('bf', BF_GRAY)
    return Cell([cpara(PP_CENTER, [(CP_BOLD, text)])], **kw)


def L(runs, **kw):  # 왼쪽 정렬
    return Cell([cpara(PP_LEFT, runs)], **kw)


def E(**kw):  # 빈 칸(쓰는 곳)
    return Cell([cpara(PP_LEFT, [])], **kw)


def R(text, **kw):  # 정답(빨간 기울임) 가운데
    return Cell([cpara(PP_CENTER, [(CP_RED, text)])], **kw)


def table(widths, rows, heights, page_break=False):
    assert sum(widths) == W, sum(widths)
    nrow, ncol = len(rows), len(widths)
    # 칸 주소 계산 (rowSpan/colSpan 고려)
    occupied = set()
    trs = []
    for r, cells in enumerate(rows):
        c = 0
        tcs = []
        for cell in cells:
            while (r, c) in occupied:
                c += 1
            for dr in range(cell.rs):
                for dc in range(cell.cs):
                    occupied.add((r + dr, c + dc))
            w = sum(widths[c:c + cell.cs])
            h = sum(heights[r:r + cell.rs])
            tcs.append(
                f'<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="{cell.bf}">'
                f'<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="{cell.va}" linkListIDRef="0" '
                f'linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">{"".join(cell.paras)}</hp:subList>'
                f'<hp:cellAddr colAddr="{c}" rowAddr="{r}"/><hp:cellSpan colSpan="{cell.cs}" rowSpan="{cell.rs}"/>'
                f'<hp:cellSz width="{w}" height="{h}"/><hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>')
            c += cell.cs
        trs.append('<hp:tr>' + ''.join(tcs) + '</hp:tr>')
    assert len(occupied) == nrow * ncol, (len(occupied), nrow, ncol)
    tbl = (f'<hp:tbl id="{nid()}" zOrder="{nz()}" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" '
           f'lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="{nrow}" colCnt="{ncol}" cellSpacing="0" '
           f'borderFillIDRef="{BF_LINE}" noAdjust="0"><hp:sz width="{W}" widthRelTo="ABSOLUTE" height="{sum(heights)}" '
           f'heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="0" affectLSpacing="0" flowWithText="1" allowOverlap="0" '
           f'holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" '
           f'horzOffset="0"/><hp:outMargin left="141" right="141" top="141" bottom="141"/>'
           f'<hp:inMargin left="510" right="510" top="141" bottom="141"/>{"".join(trs)}</hp:tbl>')
    return (f'<hp:p id="0" paraPrIDRef="{PP_TOP}" styleIDRef="0" pageBreak="{1 if page_break else 0}" columnBreak="0" '
            f'merged="0"><hp:run charPrIDRef="32">{tbl}<hp:t/></hp:run></hp:p>')


# ---------- 원본 읽기 ----------
zin = zipfile.ZipFile(SRC)
sec = zin.read('Contents/section0.xml').decode('utf-8')

# 원본의 소제목 문단(아이콘 + '제3 세계의 등장과 성장')을 본떠 새 소제목을 만든다
m = re.search(r'<hp:p id="0"[^>]*pageBreak="1"[^>]*>(?:(?!</hp:p>).)*?<hp:t>제3 세계의 등장과 성장</hp:t>.*?</hp:p>', sec, re.S)
HEAD_TPL = m.group(0)


def heading(text, page_break=False):
    x = HEAD_TPL.replace('<hp:t>제3 세계의 등장과 성장</hp:t>', f'<hp:t>{escape(text)}</hp:t>')
    x = re.sub(r'pageBreak="1"', f'pageBreak="{1 if page_break else 0}"', x, count=1)
    x = re.sub(r'(<hp:pic id=")\d+', lambda mm: mm.group(1) + str(nid()), x)
    x = re.sub(r'(instid=")\d+', lambda mm: mm.group(1) + str(nid()), x)
    x = re.sub(r'zOrder="\d+"', f'zOrder="{nz()}"', x, count=1)
    x = re.sub(r'<hp:linesegarray>.*?</hp:linesegarray>', '', x, flags=re.S)
    return x


def gap():
    return para(PP_JUST, [])


def note(text, cp=CP_TEXT11):
    return para(PP_JUST, [(cp, text)])


def sub(text):  # ● 작은 제목 (원본의 '● 냉전의 확산'과 같은 모양)
    return para(PP_BULLET, [(CP_SUB, text)])


out = []

# ===== 3쪽: 수업 속 질문 =====
out.append(heading('수업 속 질문', page_break=True))
out.append(note('수업 중에 나오는 질문이에요. 수업을 들으며 내 생각을 짧게 써 보세요.'))
QS = [
    ('냉전의 성립', [
        '제2차 세계 대전 때 함께 싸운 미국과 소련은 왜 대립하게 되었을까?',
        '냉전은 미국과 소련이 전혀 싸우지 않았다는 뜻일까?',
        '베를린 봉쇄와 쿠바 미사일 위기는 어떤 방식의 대립이었을까?',
        '6·25 전쟁과 베트남 전쟁을 ‘냉전 속 열전’이라 부르는 까닭은?']),
    ('제3 세계의 성장', [
        '새로 독립한 나라들은 반드시 미국과 소련 중 한 편에 서야 했을까?',
        '독립하면 강대국의 영향에서 완전히 벗어났을까?',
        '식민 지배를 겪은 나라들이 ‘주권 존중’과 ‘내정 불간섭’을 강조한 까닭은?']),
    ('냉전의 완화와 해체', [
        '1989년, 베를린 장벽 위에 올라선 사람들은 어떤 마음이었을까?']),
]
rows, hts = [[H('질문', cs=2), H('나의 생각')]], [1900]
n = 0
for part, qs in QS:
    rows.append([Cell([cpara(PP_BULLET, [(CP_SUB, part)])], cs=3)])
    hts.append(1900)
    for q in qs:
        n += 1
        rows.append([C(str(n)), L([(CP_BODY, q)]), E()])
        hts.append(4300)
out.append(table([3000, 21294, 29000], rows, hts))

# ===== 4쪽: 1955년 활동 + 타임라인 퀴즈 =====
out.append(heading('활동: 1955년, 우리나라의 선택은?', page_break=True))
out.append(note('오랫동안 식민 지배를 받다가 막 독립한 우리나라. 미국과 소련이 서로 자기편이 되어 달라고 요청해요. '
                '새 나라의 외교 정책을 정해 봅시다!'))
rows = [[H(''), H('① 미국 진영과 협력'), H('② 소련 진영과 협력'), H('③ 비동맹 노선')]]
hts = [1900]
for label in ['고른 이유', '기대되는 장점', '걱정되는 어려움']:
    rows.append([H(label), E(), E(), E()])
    hts.append(3600)
rows.append([H('우리 모둠의 선택'), L([(CP_BODY, '①  ·  ②  ·  ③  중 하나에 ○ 하고, 까닭을 한 줄로 써 보세요.')], cs=3)])
hts.append(2600)
rows.append([H('정리'), Cell([cpara(PP_LEFT, [(CP_BOLD, '실제로 많은 신생 독립국이 비동맹 노선을 택한 까닭은?')]),
                              cpara(PP_LEFT, [(CP_RED, '강대국의 간섭에서 벗어나 주권을 지키고, 냉전에 휘말리지 않기 위해서')])],
                             cs=3, va='TOP')])
hts.append(3600)
out.append(table([8294, 15000, 15000, 15000], rows, hts))
out.append(gap())

out.append(heading('타임라인 퀴즈: 사건을 순서대로!'))
out.append(note('<보기>의 사건을 일어난 순서대로 기호를 쓰고, 연도와 시기도 써 보세요.'))
out.append(table([8294, 45000], [
    [H('사건'), Cell([cpara(PP_LEFT, [(CP_BODY, 'ㄱ. 소련 해체      ㄴ. 핑퐁 외교      ㄷ. 베를린 장벽 붕괴      ㄹ. 닉슨 독트린')]),
                    cpara(PP_LEFT, [(CP_BODY, 'ㅁ. 고르바초프의 개혁·개방      ㅂ. 독일 통일      ㅅ. 닉슨의 중국 방문')])])],
    [H('시기'), L([(CP_BODY, '긴장 완화   ·   사회주의 체제 변화   ·   냉전 질서 종식')])],
], [3300, 1900]))
out.append(gap())
cw = [8294] + [6428] * 6 + [6432]
out.append(table(cw, [
    [H('순서')] + [H(str(i)) for i in range(1, 8)],
    [H('기호')] + [R(x) for x in ['ㄹ', 'ㄴ', 'ㅅ', 'ㅁ', 'ㄷ', 'ㅂ', 'ㄱ']],
    [H('연도')] + [R(x) for x in ['1969', '1971', '1972', '1980년대 중반', '1989', '1990', '1991']],
    [H('시기'), R('긴장 완화', cs=3), R('사회주의 체제 변화'), R('냉전 질서 종식', cs=3)],
], [1900, 2600, 2600, 2600]))

# ===== 5쪽: Think & Talk + 한 흐름으로 정리 =====
out.append(heading('Think & Talk: 냉전은 하루아침에 끝났을까?', page_break=True))
out.append(para(PP_CENTER, [(CP_SUB, '긴장 완화  →  사회주의 체제 변화  →  냉전 해체')]))
rows = [[H('주제'), H('질문'), H('나의 생각'), H('친구의 생각')]]
hts = [1900]
for t, q in [('미·중 관계', '미국과 중국의 관계 개선은 냉전의 어떤 변화를 보여 줄까?'),
             ('개혁·개방', '고르바초프는 왜 개혁·개방을 추진했을까?'),
             ('장벽과 해체', '베를린 장벽 붕괴와 소련 해체는 같은 사건일까?')]:
    rows.append([H(t), L([(CP_BODY, q)]), E(), E()])
    hts.append(4800)
out.append(table([8294, 15000, 15000, 15000], rows, hts))
out.append(gap())

out.append(heading('한 흐름으로 정리'))
out.append(para(PP_JUST, [(CP_SUB, '큰 질문  '), (CP_TEXT11, '제2차 세계 대전 이후 세계 질서는 어떻게 형성되고, '
                                                         '제3 세계의 등장과 냉전의 해체를 거치며 어떻게 변화했을까?')]))
flow = [
    ['미국과 소련을 중심으로 세계가 ', ('두 진영',), '으로 나뉘어 대립했다.'],
    ['일부 신생 독립국이 ', ('비동맹 중립주의',), '로 영향력을 넓혔다.'],
    ['', ('닉슨 독트린',), ', 미·중 관계 개선 등으로 긴장이 누그러졌다.'],
    ['소련·동유럽의 변화 속에서 ', ('냉전 질서',), '가 끝났다.'],
]
out.append(table([13323, 13323, 13323, 13325], [
    [H(x) for x in ['1945~', '1955~', '1969~', '~1991']],
    [Cell([cpara(PP_CENTER, [(CP_SUB, x)])]) for x in ['냉전의 성립', '제3 세계의 성장', '냉전의 완화', '냉전의 해체']],
    [Cell([cpara(PP_LEFT, blank_runs(parts))], va='TOP') for parts in flow],
], [1700, 1900, 4600]))
out.append(para(PP_JUST, [(CP_BOLD, '답안 구조  '), (CP_BODY, '냉전의 성립  →  냉전 속 제3 세계의 성장  →  긴장 완화와 냉전 해체')]))
out.append(table([W], [
    [Cell([cpara(PP_LEFT, [(CP_BOLD, '큰 질문에 대한 나의 답 '), (CP_BODY, '(답안 구조에 맞춰 3~4문장으로 써 보세요)')]),
           cpara(PP_LEFT, [])], va='TOP')],
], [9000]))

# ===== 6쪽: 확인 문제 =====
out.append(heading('확인 문제', page_break=True))
out.append(sub('빈칸 채우기'))
rows, hts = [], []
for label, parts in [
    ('① 냉전', ['냉전은 ', ('미국',), '과 ', ('소련',), ' 중심의 두 진영이 대립한 체제이다.']),
    ('② 열전', ['한국과 베트남에서는 실제 ', ('전쟁',), '이 벌어졌다.']),
    ('③ 제3 세계', ['', ('비동맹 중립주의',), ' 노선을 추구하고, 1955년 ', ('반둥',), ' 회의에서 평화 10원칙을 제시했다.']),
    ('④ 냉전의 해체', ['소련의 ', ('개혁·개방',), ' → 1989년 ', ('베를린 장벽',), ' 붕괴 → 1991년 ', ('소련',), ' 해체']),
]:
    rows.append([H(label), L(blank_runs(parts))])
    hts.append(2400)
out.append(table([9294, 44000], rows, hts))
out.append(gap())
out.append(sub('O, X 퀴즈'))
rows, hts = [[H('번호'), H('내용'), H('O / X')]], [1900]
for i, (q, a) in enumerate([
    ('냉전 시기 미국과 소련은 서로 직접 전쟁을 벌이지 않았지만, 세계 곳곳에서 실제 전쟁(열전)이 일어났다.', 'O'),
    ('제3 세계는 미국 진영에 들어간 신생 독립국들을 가리킨다.', 'X'),
    ('1955년 반둥 회의에서 아시아·아프리카 나라들이 평화 10원칙을 발표하였다.', 'O'),
    ('닉슨 독트린은 “아시아의 방위는 미국이 책임진다.”라는 내용이다.', 'X'),
    ('베를린 장벽이 무너진 1989년에 소련도 해체되었다.', 'X'),
], 1):
    rows.append([C(str(i)), L([(CP_BODY, q)]), R(a)])
    hts.append(2200)
out.append(table([3294, 44000, 6000], rows, hts))
out.append(gap())
out.append(sub('오늘의 배움'))
out.append(table([26647, 26647], [
    [H('새롭게 알게 된 것'), H('더 궁금한 것')],
    [E(va='TOP'), E(va='TOP')],
], [1900, 5200]))

# ---------- 덧붙이기 + 저장 ----------
end = sec.rindex('</hs:sec>')
new_sec = sec[:end] + ''.join(out) + sec[end:]
assert new_sec[:end] == sec[:end]  # 원본 부분은 그대로

with zipfile.ZipFile(OUT, 'w') as zout:
    for info in zin.infolist():
        data = zin.read(info.filename)
        if info.filename == 'Contents/section0.xml':
            data = new_sec.encode('utf-8')
        zi = zipfile.ZipInfo(info.filename, date_time=info.date_time)
        zi.compress_type = zipfile.ZIP_STORED if info.filename == 'mimetype' else info.compress_type
        zi.external_attr = info.external_attr
        zout.writestr(zi, data)
print('ok', OUT, len(out), 'blocks')
