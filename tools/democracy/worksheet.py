"""「민주주의와 인권의 확산」 수업 학습지(hwpx)를 선생님 양식으로 만든다.

python3 -I tools/democracy/worksheet.py <양식.hwpx> [결과 폴더] [--html 미리보기 폴더] [--font-css 글꼴.css] [--thumbs 그림 폴더]

- 양식: 선생님 수업 학습지(NO.34 냉전 학습지와 같은 양식). 머리 표 · 로고 · 제목 아이콘 · 글꼴 · 표 스타일을 그대로 쓰고,
  머리 표 글자만 바꾼 뒤 본문을 새로 채운다.
- 결과: 학생용(정답이 흰 글씨) · 교사용(정답이 빨간 기울임) 두 파일. 결과 폴더를 생략하면 democracy/dist.
- --html: 같은 내용으로 미리보기 HTML(2쪽, 학생용 · 교사용)을 그 폴더에 만든다. 한글이 없는 곳에서 모양을 확인할 때 쓴다.
- --thumbs: 그 폴더의 학생용.png · 교사용.png 를 hwpx 의 미리보기 그림(Preview/PrvImage.png)으로 넣는다.
  넣지 않으면 양식의 미리보기 그림(이전 학습지 모습)이 그대로 남는다.
- 내용은 슬라이드(democracy/index.html)에만 맞춘다. 빈칸 [[정답]] 의 답은 모두 슬라이드 화면에 있는 말이다.
"""
import base64
import html as H
import pathlib
import re
import sys
import zipfile
from xml.sax.saxutils import escape

ROOT = pathlib.Path(__file__).resolve().parents[2]

# ============================================================
# 1. 내용 (슬라이드 순서) — [[정답]] 빈칸, <small> 작은 글씨, <b> 굵게, <br> 줄바꿈
#    연표: (연도, 짧은 이름[, 강조]) — 연표에는 빈칸 답이 나오지 않게 한다
#    노트: (표시, 문장) — 표시 1~5 는 연표 번호, '•' 는 연도 없는 내용, '★' 는 정리
# ============================================================
HEADER = {
    '중단원': '2. 민주주의와 인권의 확산',
    'NO': '35',
    '학습 주제': '민권 · 여성 · 노동 · 반전 평화 · 환경 운동',
    '교과서': '',
    '성취기준': '[9역07-02] 20세기 후반 민주주의와 인권의 신장을 위한 노력에 관심을 갖는다.',
}

DOC = [
    ('h2', '① 사람은 누구나 평등한가?'),
    ('sub', '민권 운동'),
    ('band', [('1863·1865', '노예제 폐지'), ('1963', '워싱턴 평화 행진'), ('1964', '법 제정'),
              ('1965', '흑인의 권리'), ('같은 시기', '남아프리카 공화국')]),
    ('notes', [
        (1, '노예 해방 선언(1863) 뒤에도 [[차별]]은 남았다 <small>(학교 · 버스 · 식당을 인종에 따라 따로 쓰게 했다)</small>'),
        (2, '마틴 루서 킹이 비폭력 저항 운동으로 차별 철폐를 요구했다'),
        (3, '[[민권법]] 제정 → 인종 차별을 불법으로 규정'),
        (4, '모든 흑인에게 완전한 [[참정권]] 보장'),
        (5, '[[아파르트헤이트]] : 인종 분리 정책을 실시하고 흑인의 참정권을 부정한 극단적인 인종 차별 정책<br>'
            '[[넬슨 만델라]] : 비폭력·불복종 운동으로 맞섬 → 감옥 → 석방 후 아파르트헤이트 폐지, 노벨 평화상'),
        ('★', '<b>법의 의미</b>  인종에 관계없이 동등한 권리를 가진다는 원칙이 [[제도]]로 자리 잡았다'),
    ]),
    ('sub', '여성 운동'),
    ('band', [('세계 대전 전후', '끊임없는 노력'), ('1967', '보스턴 마라톤'), ('1971', '영국 여성 행진'),
              ('1972', '보스턴 마라톤'), ('2018', '사우디아라비아')]),
    ('notes', [
        (1, '두 차례 세계 대전 전후, 여성들은 남성과 동등한 [[참정권]]을 얻었다'),
        (2, '번호표를 달고 정식으로 참가한 최초의 여성 <small>(감독관의 저지에도 끝까지 완주)</small>'),
        (4, '여성 참가를 [[공식 허용]]'),
        (3, '교육 · 취업 · [[임금]]의 평등 요구 → 일상에 남아 있던 성차별과 성 역할 분리에 도전했다'),
        (5, '여성 [[운전]] 허용 <small>(1990년 즈음부터 여성들이 기습적으로 운전하며 항의해 왔다)</small>'),
        ('★', '<b>핵심 용어</b>  [[남성]] 중심 사회 체제 → 인식의 전환과 현실적 변화 <small>(여성 운동은 지금도 계속된다)</small>'),
    ]),
    ('h2', '② 일하는 사람에게는 어떤 권리가 필요할까?'),
    ('sub', '노동 운동'),
    ('band', [('1886', '노동자 파업'), ('1889', '프랑스 파리'), ('1919', '베르사유 조약'),
              ('1944', 'ILO 총회'), ('2026', '지금 우리나라', 1)]),
    ('notes', [
        (5, '올해 5월 1일, 학교는 왜 쉬었을까? → 근로자의 날이 2026년부터 \'[[노동절]]\', [[법정 공휴일]]이 되었다'),
        (1, '미국 [[시카고]] 노동자들이 하루 [[8시간]] 노동을 요구 <small>(일하는 8시간 · 쉬는 8시간 · 하고 싶은 일을 하는 8시간)</small>'),
        (2, '세계의 노동자들이 5월 1일을 \'[[메이데이]]\'로 정했다 → 1886년 5월 1일 노동자들의 운동을 기리기 위해'),
        ('•', '노동조합을 만들었다 · [[단체 교섭권]] : 노동자 대표가 회사와 협상할 수 있는 권리'),
        (3, '[[국제 노동 기구]](ILO) 설립 → 1일 8시간 · 1주 48시간을 국제 표준으로'),
        (4, '[[필라델피아]] 선언 : “노동은 [[상품]]이 아니다.”'),
        ('★', '<b>정리</b>  노동자들의 요구가 국제 기준이 되었다'),
    ]),
    ('h2p', '③ 인류의 생존을 위협하는 문제는 어떻게 해결할까?'),  # 새 쪽
    ('sub', '반전 평화 운동'),
    ('band', [('1960년대 후반', '반전 운동 확산'), ('2003', '미국의 이라크 침공'), ('2022', '러시아의 우크라이나 침공')]),
    ('notes', [
        (1, '[[베트남]] 전쟁 반대 운동이 전 세계로 퍼졌다 → 미군이 철수하는 데 큰 영향을 미쳤다'),
        ('•', '핵 실험 반대 → [[핵 확산 금지 조약]](NPT) : 핵무기 같은 대량 살상 무기가 더 많은 나라로 퍼지는 것을 막기 위한 국제 협약'),
        ('②③', '이탈리아, 오스트레일리아 등 세계 곳곳에서 반대 운동과 시위가 이어졌다'),
        ('★', '<b>생각할 점</b>  시위가 늘 전쟁을 바로 멈추지는 못한다. 그래도 평화를 요구하는 목소리와 [[연대]]는 계속된다.'),
    ]),
    ('sub', '환경 운동'),
    ('band', [('1989→2008', '아랄해'), ('1992', '국제 연합 회의'), ('1997', '교토 의정서'), ('2015', '파리 협정')]),
    ('notes', [
        ('•', '대표적인 환경 문제: [[지구 온난화]] · 사막화 · 열대림 파괴와 생물종 감소 · 오존층 파괴 '
              '<small>(산업화 · 인구 증가로 자원 소비와 폐기물 급증)</small>'),
        (1, '강물을 [[목화밭]]에 대려고 대량으로 끌어 썼다 → 호수가 말라붙고 사막화가 일어났다'),
        (2, '[[리우 선언]](환경과 개발에 관한 공동 선언) 발표 → 생물 다양성 협약 · 사막화 방지 협약 · 기후 변화 협약'),
        (3, '최초로 온실가스 감축 비율 제시 · 감축 의무: [[선진국]]만'),
        (4, '온실가스 감축의 구체적인 수치 제시 · 감축 의무: 선진국과 [[개발 도상국]] 모두'),
        ('•', '그린피스(1971년 설립): 핵 실험 반대와 자연 보호 운동 등을 펼치는 국제 환경 보호 단체 '
              '→ 비정부 기구(NGO)도 환경 운동을 이끈다'),
    ]),
    ('h2', '오늘의 핵심 정리'),
    ('sub', '다섯 운동 한눈에 보기'),
    # 슬라이드 72번 정리표. 핵심 용어 칸은 학생이 쓴다(정답은 흰 글씨 / 빨간 글씨)
    ('summary', ['운동', '핵심 용어', '무엇이 바뀌었나'], [
        ('민권', '흑인 민권 운동, 아파르트헤이트', '민권법(1964)·참정권 보장, 인종 차별 금지'),
        ('여성', '남성 중심 사회 체제', '참정권 이후 교육·취업·임금 평등 요구'),
        ('노동', '단체 교섭권, 국제 노동 기구, 필라델피아 선언', '8시간 요구(1886) → 1일 8시간 국제 표준(1919)'),
        ('반전 평화', '핵 확산 금지 조약(NPT)', '미군 베트남 철수에 영향, 핵 확산 방지'),
        ('환경', '리우 선언, 교토 의정서, 파리 협정', '선진국만 감축 → 모든 나라가 감축'),
    ]),
    ('sub', '다섯 운동의 공통 패턴'),
    ('pattern', [('문제', '인종 차별, 성차별,<br>장시간 노동, 전쟁, 환경 파괴'),
                 ('[[사람들의 행동]]', '행진, 파업, 시위,<br>국제 연대'),
                 ('[[법·제도·국제 협약]]', '민권법, 국제 노동 기구,<br>핵 확산 금지 조약, 파리 협정'),
                 ('[[아직 남은 과제]]', '지금도 남아 있는 차별,<br>산업 재해, 전쟁, 기후 변화', 1)]),
    ('key', '민주주의와 인권은 사람들의 [[노력]]으로 확대되었으며, 그 노력은 지금도 계속되고 있다.'),
]

NUM = '①②③④⑤⑥⑦⑧⑨'


def parse(text):
    """문장 → 문단 목록. 문단은 [(종류, 글)] — 종류: body · small · bold · ans"""
    paras, runs, small, bold = [], [], False, False
    for tok in re.split(r'(\[\[.+?\]\]|<small>|</small>|<b>|</b>|<br>)', text):
        if not tok:
            continue
        if tok == '<br>':
            paras.append(runs)
            runs = []
        elif tok in ('<small>', '</small>'):
            small = tok == '<small>'
        elif tok in ('<b>', '</b>'):
            bold = tok == '<b>'
        elif tok.startswith('[['):
            runs.append(('ans', tok[2:-2]))
        else:
            runs.append(('small' if small else 'bold' if bold else 'body', tok))
    paras.append(runs)
    return paras


def mark_of(m):
    return NUM[m - 1] if isinstance(m, int) else m


# ============================================================
# 2. hwpx 만들기
# ============================================================
# 양식에 이미 있는 스타일 번호 (header.xml) — slides/worksheet.py 와 같은 양식
PP_JUST, PP_CENTER, PP_BULLET, PP_TOP = 0, 19, 39, 37
PP_LEFT_T, PP_CENTER_T = 11, 36          # 줄 간격 130% (표 안)
CP_BODY, CP_BOLD, CP_SUB, CP_SMALL, CP_RED = 34, 33, 38, 42, 44
BF_NONE, BF_LINE, BF_GRAY = 1, 3, 20
W = 53294  # 양식 표 너비 (188mm)


class Hwpx:
    def __init__(self, template, student, thumb=None):
        self.zin = zipfile.ZipFile(template)
        self.sec = self.zin.read('Contents/section0.xml').decode('utf-8')
        self.hdr = self.zin.read('Contents/header.xml').decode('utf-8')
        self.student = student
        self.thumb = thumb
        self._id, self._z = 1239340000, 40
        self.add_styles()

    # ---------- 스타일 더하기 ----------
    def add_styles(self):
        hdr = self.hdr

        def add(kind, item, src_id, new_id, edit):
            nonlocal hdr
            m = re.search(rf'<hh:{item} id="{src_id}".*?</hh:{item}>', hdr, re.S)
            x = edit(m.group(0).replace(f'<hh:{item} id="{src_id}"', f'<hh:{item} id="{new_id}"', 1))
            end = hdr.index(f'</hh:{kind}>')
            hdr = hdr[:end] + x + hdr[end:]
            hdr = re.sub(rf'(<hh:{kind} itemCnt=")(\d+)', lambda mm: mm.group(1) + str(int(mm.group(2)) + 1), hdr, count=1)
            return new_id

        ncp = int(re.search(r'<hh:charProperties itemCnt="(\d+)"', hdr).group(1))
        nbf = int(re.search(r'<hh:borderFills itemCnt="(\d+)"', hdr).group(1))
        # 학생용 정답: 빨간 기울임(44)을 본떠 흰 글씨로
        self.CP_WHITE = add('charProperties', 'charPr', CP_RED, ncp,
                            lambda x: re.sub(r'textColor="#[0-9A-Fa-f]+"', 'textColor="#FFFFFF"', x, count=1))
        fill = lambda c: (lambda x: re.sub(r'faceColor="[^"]+"', f'faceColor="{c}"', x))
        self.BF_LIGHT = add('borderFills', 'borderFill', BF_GRAY, nbf + 1, fill('#F2F2F2'))
        self.BF_THICK = add('borderFills', 'borderFill', BF_LINE, nbf + 2,
                            lambda x: re.sub(r'(Border type="SOLID" width=")[^"]+', r'\g<1>0.4 mm', x))
        self.hdr = hdr
        self.CP_ANS = self.CP_WHITE if self.student else CP_RED

    def nid(self):
        self._id += 1
        return self._id

    def nz(self):
        self._z += 1
        return self._z

    # ---------- 글 ----------
    def runs(self, runs, base=CP_BODY, blank='wide'):
        out = []
        cp = {'body': base, 'small': CP_SMALL, 'bold': CP_BOLD}
        for kind, t in runs:
            if kind == 'ans':
                if blank == 'none':
                    out.append((self.CP_ANS, t))
                else:
                    pad = '      ' if blank == 'wide' else '  '
                    out += [(base, '( '), (self.CP_ANS, t), (base, pad + ')')]
            else:
                out.append((cp[kind], t))
        return ''.join(f'<hp:run charPrIDRef="{c}"><hp:t>{escape(t)}</hp:t></hp:run>' for c, t in out) \
            or f'<hp:run charPrIDRef="{base}"/>'

    def cpara(self, pp, body):
        return (f'<hp:p id="2147483648" paraPrIDRef="{pp}" styleIDRef="0" pageBreak="0" '
                f'columnBreak="0" merged="0">{body}</hp:p>')

    def cell_text(self, text, pp=PP_LEFT_T, base=CP_BODY, blank='wide'):
        return [self.cpara(pp, self.runs(r, base, blank)) for r in parse(text)]

    def para(self, pp, body, page_break=False):
        return (f'<hp:p id="0" paraPrIDRef="{pp}" styleIDRef="0" pageBreak="{1 if page_break else 0}" '
                f'columnBreak="0" merged="0">{body}</hp:p>')

    # ---------- 표 (slides/worksheet.py 와 같은 방식) ----------
    def table(self, widths, rows, heights, tbf=BF_LINE):
        """rows: [[(문단들, colspan, rowspan, borderFill)]]"""
        assert sum(widths) == W, sum(widths)
        nrow, ncol = len(rows), len(widths)
        occupied, trs = set(), []
        for r, cells in enumerate(rows):
            c, tcs = 0, []
            for paras, cs, rs, bf in cells:
                while (r, c) in occupied:
                    c += 1
                for dr in range(rs):
                    for dc in range(cs):
                        occupied.add((r + dr, c + dc))
                w, h = sum(widths[c:c + cs]), sum(heights[r:r + rs])
                tcs.append(
                    f'<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="{bf}">'
                    f'<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" '
                    f'linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">{"".join(paras)}</hp:subList>'
                    f'<hp:cellAddr colAddr="{c}" rowAddr="{r}"/><hp:cellSpan colSpan="{cs}" rowSpan="{rs}"/>'
                    f'<hp:cellSz width="{w}" height="{h}"/><hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>')
                c += cs
            trs.append('<hp:tr>' + ''.join(tcs) + '</hp:tr>')
        assert len(occupied) == nrow * ncol, (len(occupied), nrow, ncol)
        tbl = (f'<hp:tbl id="{self.nid()}" zOrder="{self.nz()}" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" '
               f'textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="0" rowCnt="{nrow}" '
               f'colCnt="{ncol}" cellSpacing="0" borderFillIDRef="{tbf}" noAdjust="0"><hp:sz width="{W}" '
               f'widthRelTo="ABSOLUTE" height="{sum(heights)}" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="0" '
               f'affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" '
               f'vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin left="141" right="141" '
               f'top="141" bottom="141"/><hp:inMargin left="510" right="510" top="141" bottom="141"/>{"".join(trs)}</hp:tbl>')
        return self.para(PP_TOP, f'<hp:run charPrIDRef="32">{tbl}<hp:t/></hp:run>')

    # ---------- 블록 ----------
    def heading(self, text, page_break=False):
        m = re.search(r'<hp:p id="0"[^>]*>(?:(?!</hp:p>).)*?<hp:pic .*?</hp:p>', self.tail, re.S)
        x = m.group(0)
        x = re.sub(r'<hp:t>[^<]*</hp:t>', f'<hp:t>{escape(text)}</hp:t>', x, count=1)
        x = re.sub(r'pageBreak="\d"', f'pageBreak="{1 if page_break else 0}"', x, count=1)
        x = re.sub(r'(<hp:pic id=")\d+', lambda mm: mm.group(1) + str(self.nid()), x)
        x = re.sub(r'(instid=")\d+', lambda mm: mm.group(1) + str(self.nid()), x)
        x = re.sub(r'zOrder="\d+"', f'zOrder="{self.nz()}"', x, count=1)
        return re.sub(r'<hp:linesegarray>.*?</hp:linesegarray>', '', x, flags=re.S)

    def sub(self, text):
        return self.para(PP_BULLET, f'<hp:run charPrIDRef="{CP_SUB}"><hp:t>{escape(text)}</hp:t></hp:run>')

    def band(self, chips, numbered=True, pattern=False):
        n, aw = len(chips), 1417
        cw = (W - (n - 1) * aw) // n
        widths = []
        for i in range(n):
            widths += ([aw] if i else []) + [cw]
        widths[-1] += W - sum(widths)
        top, bottom = [], []
        for i, (head, body, *now) in enumerate(chips):
            if i:
                top.append(([self.cpara(PP_CENTER_T, f'<hp:run charPrIDRef="{CP_BODY}"><hp:t>➔</hp:t></hp:run>')], 1, 2, BF_NONE))
            h = (NUM[i] + ' ' + head) if numbered else head
            hbf = BF_LINE if pattern else BF_GRAY if now else self.BF_LIGHT  # 빈칸 칸은 흰 바탕
            top.append((self.cell_text(h, PP_CENTER_T, CP_SUB, 'tight'), 1, 1, hbf))
            bottom.append((self.cell_text(body, PP_CENTER_T, CP_SMALL, 'tight'), 1, 1, BF_LINE))
        return self.table(widths, [top, bottom], [1800, 2400 if pattern else 1700], tbf=BF_NONE)

    def notes(self, items):
        rows, hts = [], []
        for m, text in items:
            star = m == '★'
            paras = self.cell_text(text)
            rows.append([([self.cpara(PP_CENTER_T, self.runs([('body', mark_of(m))], CP_SUB))], 1, 1,
                           BF_GRAY if star else self.BF_LIGHT),
                         (paras, 1, 1, BF_LINE)])  # 빈칸이 있는 칸은 흰 바탕
            hts.append(1250 * len(paras) + 400)
        return self.table([2551, W - 2551], rows, hts)

    def summary(self, head, data):
        rows = [[(self.cell_text(h, PP_CENTER_T, CP_SUB), 1, 1, self.BF_LIGHT) for h in head]]
        hts = [1800]
        for mv, terms, changed in data:
            rows.append([(self.cell_text(mv, PP_CENTER_T, CP_SUB), 1, 1, self.BF_LIGHT),
                         (self.cell_text(f'[[{terms}]]', PP_LEFT_T, CP_BODY, 'none'), 1, 1, BF_LINE),
                         (self.cell_text(changed, PP_LEFT_T, CP_SMALL), 1, 1, BF_LINE)])
            hts.append(2200)
        return self.table([7300, 21000, W - 28300], rows, hts)

    def key(self, text):
        return self.table([W], [[(self.cell_text(text, PP_CENTER_T, CP_SUB), 1, 1, self.BF_THICK)]], [2600])

    # ---------- 머리 표 ----------
    def fix_header(self, first):
        def cell_text(old, new, pp=None):
            nonlocal first
            m = re.search(rf'<hp:p [^>]*>(?:(?!</hp:p>).)*?<hp:t>{re.escape(old)}.*?</hp:p>', first, re.S)
            assert m, old
            p = m.group(0)
            cp = re.search(r'<hp:run charPrIDRef="(\d+)"', p).group(1)
            head = re.match(r'<hp:p [^>]*>', p).group(0)
            if pp is not None:
                head = re.sub(r'paraPrIDRef="\d+"', f'paraPrIDRef="{pp}"', head)
            body = f'<hp:run charPrIDRef="{cp}"><hp:t>{escape(new)}</hp:t></hp:run>' if new else f'<hp:run charPrIDRef="{cp}"/>'
            first = first.replace(p, head + body + '</hp:p>', 1)

        # 양식의 중단원 · 학습 주제 칸은 자동 번호(1.)가 붙는 문단이라, 번호 없는 가운데 정렬로 바꾸고 번호를 글로 쓴다
        cell_text('냉전 체제와 제3 세계의 형성', HEADER['중단원'], PP_CENTER)
        cell_text('냉전 체제의 형성과 전개', HEADER['학습 주제'], PP_CENTER)
        cell_text('34', HEADER['NO'])
        cell_text('216~223', HEADER['교과서'])
        cell_text('[9역06-01]', HEADER['성취기준'])
        return re.sub(r'<hp:linesegarray>.*?</hp:linesegarray>', '', first, flags=re.S)

    # ---------- 만들기 ----------
    def build(self, out_path):
        sec = self.sec
        start = sec.index('<hp:p ')
        end = sec.rindex('</hs:sec>')
        # 맨 위 문단(쪽 설정 + 머리 표)의 끝 찾기
        depth = 0
        for m in re.finditer(r'<hp:p [^>]*>|</hp:p>', sec[start:]):
            depth += 1 if m.group(0) != '</hp:p>' else -1
            if depth == 0:
                first_end = start + m.end()
                break
        first = sec[start:first_end]
        self.tail = sec[first_end:end]  # 제목 문단(아이콘)을 본뜰 곳
        out = [self.fix_header(first)]
        for blk in DOC:
            k = blk[0]
            if k in ('h2', 'h2p'):
                out.append(self.heading(blk[1], page_break=(k == 'h2p')))
            elif k == 'sub':
                out.append(self.sub(blk[1]))
            elif k == 'band':
                out.append(self.band(blk[1]))
            elif k == 'pattern':
                out.append(self.band(blk[1], numbered=False, pattern=True))
            elif k == 'notes':
                out.append(self.notes(blk[1]))
            elif k == 'summary':
                out.append(self.summary(blk[1], blk[2]))
            elif k == 'key':
                out.append(self.key(blk[1]))
        new_sec = sec[:start] + ''.join(out) + sec[end:]

        hpf = self.zin.read('Contents/content.hpf').decode('utf-8')
        used = set(re.findall(r'binaryItemIDRef="([^"]+)"', new_sec))
        drop = set()
        for m in re.finditer(r'<opf:item id="([^"]+)" href="(BinData/[^"]+)"[^>]*/>', hpf):
            if m.group(1) not in used:  # 쓰지 않는 그림(냉전 지도 등)은 뺀다
                drop.add(m.group(2))
                hpf = hpf.replace(m.group(0), '')
        settings = self.zin.read('settings.xml').decode('utf-8')
        settings = re.sub(r'<ha:CaretPosition [^>]*/>', '<ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/>', settings)
        prv = '\r\n'.join(t for t in re.findall(r'<hp:t>([^<]*)</hp:t>', ''.join(out)))[:1000]

        with zipfile.ZipFile(out_path, 'w') as zout:
            for info in self.zin.infolist():
                name = info.filename
                if name in drop:
                    continue
                data = self.zin.read(name)
                if name == 'Contents/section0.xml':
                    data = new_sec.encode('utf-8')
                elif name == 'Contents/header.xml':
                    data = self.hdr.encode('utf-8')
                elif name == 'Contents/content.hpf':
                    data = hpf.encode('utf-8')
                elif name == 'settings.xml':
                    data = settings.encode('utf-8')
                elif name == 'Preview/PrvText.txt':
                    data = H.unescape(prv).encode('utf-8')
                elif name == 'Preview/PrvImage.png' and self.thumb:
                    data = pathlib.Path(self.thumb).read_bytes()
                zi = zipfile.ZipInfo(name, date_time=info.date_time)
                zi.compress_type = zipfile.ZIP_STORED if name == 'mimetype' else info.compress_type
                zi.external_attr = info.external_attr
                zout.writestr(zi, data)
        return out_path


# ============================================================
# 3. 미리보기 HTML (한글이 없는 곳에서 모양 확인용)
# ============================================================
CSS = """
*{box-sizing:border-box}html,body{margin:0;background:#fff}
body{font-family:"나눔고딕","Nanum Gothic",sans-serif;font-size:10pt;color:#000;line-height:1.45}
.page{width:210mm;height:297mm;padding:10mm 10.5mm;position:relative;overflow:hidden}
table{border-collapse:collapse;width:100%}td{padding:0}
.hd td{font-family:"G마켓 산스","GmarketSansMedium";text-align:center;vertical-align:middle;border:.25mm solid #000;line-height:1.2}
.hd .lab{background:#F2F2F2;font-size:11pt}.hd .logo{border:none;border-right:.4mm solid #000}
.hd .logo img{width:31.3mm;height:31.3mm;display:block;margin:0 auto}
.hd tr:first-child td:not(.logo){border-top:.4mm solid #000}.hd tr:last-child td:not(.logo){border-bottom:.4mm solid #000}
.hd td.r{border-right:.4mm solid #000}
h2{font-family:"G마켓 산스","GmarketSansMedium";font-weight:400;font-size:13pt;margin:2.6mm 0 1mm;display:flex;align-items:center;gap:1.2mm}
h2 img{width:7.8mm;height:7.8mm}
.sub{font-family:"나눔스퀘어라운드";font-weight:700;font-size:11pt;margin:1.4mm 0 .8mm}
.band{display:flex;align-items:stretch;margin:0 0 1.3mm}
.chip{flex:1;border:.12mm solid #000;text-align:center;display:flex;flex-direction:column}
.chip .yr{background:#F2F2F2;border-bottom:.12mm solid #000;font-family:"나눔스퀘어라운드";font-weight:800;font-size:10.5pt;padding:.7mm 0}
.chip .ev{padding:1mm;font-size:9.5pt;line-height:1.35;flex:1;display:flex;align-items:center;justify-content:center}
.chip.now .yr{background:#D9D9D9}
.arr{width:5mm;flex:none;display:flex;align-items:center;justify-content:center;font-size:11pt}
.band .a{padding:0 .9em 0 .6em}
.nt td{border:.12mm solid #000;padding:.75mm 2.2mm;vertical-align:middle}
.nt td.m{width:9mm;background:#F2F2F2;text-align:center;font-family:"나눔스퀘어라운드";font-weight:800;font-size:10.5pt;padding:.75mm 0;white-space:nowrap}
.nt td.m.two{font-size:9pt;letter-spacing:-.5px}
.nt tr.s td.m{background:#D9D9D9}
.nt b{font-family:"나눔스퀘어라운드";font-weight:800}
.sm{font-size:9pt}.bl{white-space:nowrap}
.a{color:#FF0000;font-style:italic;display:inline-block;padding:0 1.6em 0 .7em}
.sum td{border:.12mm solid #000;padding:1.2mm 2.2mm;height:8mm}
.sum td.h{background:#F2F2F2;text-align:center;font-family:"나눔스퀘어라운드";font-weight:700}
.sum td.t .a{padding:0}
.pat .chip .yr{background:#fff}.pat .chip .ev{font-size:9pt;padding:1.2mm 1.5mm}
.key{border:.4mm solid #000;padding:2.4mm 3mm;text-align:center;font-family:"나눔스퀘어라운드";font-weight:700;font-size:11.5pt;margin-top:1.3mm}
.foot{position:absolute;bottom:5mm;left:0;right:0;text-align:center;font-size:9pt}
"""


def html_text(text, blank='wide'):
    out = []
    for i, runs in enumerate(parse(text)):
        if i:
            out.append('<br>')
        for kind, t in runs:
            t = H.escape(t)
            if kind == 'ans':
                out.append(f'<span class="a">{t}</span>' if blank == 'none'
                           else f'<span class="bl">(<span class="a">{t}</span>)</span>')
            elif kind == 'small':
                out.append(f'<span class="sm">{t}</span>')
            elif kind == 'bold':
                out.append(f'<b>{t}</b>')
            else:
                out.append(t)
    return ''.join(out)


def html_preview(template, path, font_css='', student=False):
    z = zipfile.ZipFile(template)
    img = lambda n: 'data:image/png;base64,' + base64.b64encode(z.read(n)).decode()
    logo, icon = img('BinData/image1.PNG'), img('BinData/image2.PNG')
    mm = lambda h: f'{h / 283.465:.2f}mm'
    cols = ''.join(f'<col style="width:{mm(x)}">' for x in [10345, 5562, 7063, 3311, 4304, 6676, 4758, 1334, 4660, 5283])
    hd = (f'<table class="hd"><colgroup>{cols}</colgroup>'
          f'<tr style="height:{mm(2258)}"><td class="logo" rowspan="4"><img src="{logo}"></td><td class="lab">대단원</td>'
          f'<td colspan="2" style="font-size:9pt">Ⅶ. 현대 세계의<br>전개와 과제</td><td class="lab">중단원</td>'
          f'<td colspan="3" style="font-size:9.5pt">{HEADER["중단원"]}</td><td class="lab">NO.</td><td class="r">{HEADER["NO"]}</td></tr>'
          f'<tr style="height:{mm(2565)}"><td class="lab">학습 주제</td><td colspan="6" style="font-size:11.5pt">{HEADER["학습 주제"]}</td>'
          f'<td class="lab">교과서</td><td class="r">{HEADER["교과서"]}</td></tr>'
          f'<tr style="height:{mm(1975)}"><td class="lab">성취기준</td><td colspan="8" class="r" style="font-size:9.5pt">{HEADER["성취기준"]}</td></tr>'
          f'<tr style="height:{mm(2258)}"><td class="lab" colspan="2"></td><td class="lab">학번</td><td colspan="2"></td>'
          f'<td class="lab">이름</td><td colspan="3" class="r"></td></tr></table>')
    pages, cur = [], [hd]

    def band(chips, numbered=True, cls='band'):
        parts = []
        for i, (head, body, *now) in enumerate(chips):
            if i:
                parts.append('<div class="arr">➔</div>')
            h = (NUM[i] + ' ' + head) if numbered else head
            parts.append(f'<div class="chip{" now" if now else ""}"><div class="yr">{html_text(h)}</div>'
                         f'<div class="ev"><div>{html_text(body)}</div></div></div>')
        return f'<div class="{cls}">' + ''.join(parts) + '</div>'

    for blk in DOC:
        k = blk[0]
        if k == 'h2p':
            pages.append(cur)
            cur = []
        if k in ('h2', 'h2p'):
            cur.append(f'<h2><img src="{icon}"><span>{H.escape(blk[1])}</span></h2>')
        elif k == 'sub':
            cur.append(f'<p class="sub">● {H.escape(blk[1])}</p>')
        elif k == 'band':
            cur.append(band(blk[1]))
        elif k == 'pattern':
            cur.append(band(blk[1], numbered=False, cls='band pat'))
        elif k == 'notes':
            rows = ''
            for m, text in blk[1]:
                mk = mark_of(m)
                rows += (f'<tr{" class=s" if m == "★" else ""}><td class="m{" two" if len(mk) > 1 else ""}">{mk}</td>'
                         f'<td>{html_text(text)}</td></tr>')
            cur.append(f'<table class="nt">{rows}</table>')
        elif k == 'summary':
            head, data = blk[1], blk[2]
            rows = '<tr>' + ''.join(f'<td class="h">{h}</td>' for h in head) + '</tr>'
            for mv, terms, changed in data:
                rows += (f'<tr><td class="h">{mv}</td><td class="t">{html_text("[[" + terms + "]]", "none")}</td>'
                         f'<td class="sm">{html_text(changed)}</td></tr>')
            cur.append(f'<table class="sum"><colgroup><col style="width:25.8mm"><col style="width:74mm"><col></colgroup>{rows}</table>')
        elif k == 'key':
            cur.append(f'<div class="key">{html_text(blk[1])}</div>')
    pages.append(cur)
    body = ''.join(f'<div class="page">{"".join(p)}<div class="foot">- {i + 1} -</div></div>' for i, p in enumerate(pages))
    css = CSS.replace('.a{color:#FF0000', '.a{color:#FFFFFF') if student else CSS
    pathlib.Path(path).write_text(f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>학습지 미리보기</title>'
                                  f'<style>{font_css}{css}</style></head><body>{body}</body></html>', encoding='utf-8')


# ============================================================
def main():
    args = sys.argv[1:]
    opts = {}
    for flag in ('--html', '--font-css', '--thumbs'):
        if flag in args:
            i = args.index(flag)
            opts[flag] = args[i + 1]
            del args[i:i + 2]
    if not args:
        print(__doc__)
        return 2
    template = pathlib.Path(args[0])
    out_dir = pathlib.Path(args[1]) if len(args) > 1 else ROOT / 'democracy' / 'dist'
    out_dir.mkdir(parents=True, exist_ok=True)
    for student, label in ((True, '학생용'), (False, '교사용')):
        thumb = pathlib.Path(opts['--thumbs']) / f'{label}.png' if '--thumbs' in opts else None
        if thumb is not None and not thumb.exists():
            thumb = None
        p = Hwpx(template, student, thumb).build(out_dir / f'민주주의와 인권의 확산 학습지({label}).hwpx')
        print('ok', p)
    if '--html' in opts:
        css = pathlib.Path(opts['--font-css']).read_text(encoding='utf-8') if '--font-css' in opts else ''
        hdir = pathlib.Path(opts['--html'])
        hdir.mkdir(parents=True, exist_ok=True)
        for student, label in ((True, '학생용'), (False, '교사용')):
            html_preview(template, hdir / f'미리보기({label}).html', css, student)
        print('ok', hdir)
    return 0


if __name__ == '__main__':
    sys.exit(main())
