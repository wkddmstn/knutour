# tools/make_voice.py — 호반우 투어 음성 만들기 (타입캐스트 API) — 개나리: 경상도 사투리 / 몽실이: 표준어
# 사용법 (knutour 폴더에서):
#   1) tools/typecast_key.txt 파일을 만들고 API 키만 한 줄 적기 (깃허브에 안 올라감)
#   2)              python tools/make_voice.py                      ← 개나리 전부 만들기
#                   python tools/make_voice.py --voice mongsil      ← 몽실이(표준어) 전부 만들기
#                   python tools/make_voice.py near far             ← 원하는 것만 다시 만들기 (--voice와 같이 써도 됨)
# 결과: 개나리 → docs/audio/tour/{키}.mp3,  몽실이 → docs/audio/tour-mongsil/{키}.mp3  (API 키를 이 파일에 직접 적지 말 것! 깃허브에 공개됨)
import json, os, sys, time, urllib.request, urllib.error

# 목소리 설정. pitch: 반음 단위(-12~+12, 0=기본), mood: 기본 감정, lines: 쓸 대사 (사투리 LINES / 표준어 LINES_STD)
VOICES = {
    "gaenari": {"id": "tc_606c6b127b9f53b4cd1743f5", "dir": "tour",         "pitch": 0, "mood": "happy", "lines": "LINES"},
    "mongsil": {"id": "tc_699d27e0e061695d6ed39bc6", "dir": "tour-mongsil", "pitch": 0, "mood": "happy", "lines": "LINES_STD"},
}
args = sys.argv[1:]
VOICE = "gaenari"
if "--voice" in args:
    i = args.index("--voice")
    VOICE = args[i + 1] if i + 1 < len(args) else ""
    del args[i:i + 2]
if VOICE not in VOICES:
    sys.exit("--voice 뒤에는 gaenari 또는 mongsil 을 적어 주세요.")
V = VOICES[VOICE]
MODELS = ["ssfm-v31", "ssfm-v30", "ssfm-v21"]   # 앞의 모델이 이 보이스를 지원 안 하면 다음 모델로
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "audio", V["dir"])
CALM = {"wrong", "far"}   # 차분하게 말할 대사 (나머지는 V["mood"])

# 개나리 — 경상도 사투리 대사 (docs/js/tour.js 의 SCRIPT_DIALECT 와 똑같이)
LINES = [
    ('start-godsaeng', '안녕! 내는 경북대 마스코트 호반우다. 오늘은 정문에서 출발해가 갓생 코스 같이 돌 끼다. 공부하고 생활하는 데 꼭 필요한 데만 쏙쏙 골라 놨데이! 첫 번째는 정문 바로 옆 센트럴파크다. 화살표 따라 퍼뜩 출발하자!'),
    ('start-healing', '안녕! 내는 경북대 마스코트 호반우다. 오늘은 정문에서 출발해가 힐링 코스 같이 돌 끼다. 맛있는 학식 묵고, 벚꽃길 산책하믄서 쉬엄쉬엄 가는 코스데이! 첫 번째는 러브로드다. 화살표 따라 출발하자!'),
    ('start-full', '안녕! 내는 경북대 마스코트 호반우다. 오늘은 정문에서 출발해가 전체 코스 같이 돌 끼다. 캠퍼스 여덟 군데를 한 바퀴 다 도는 기라 쫌 길데이. 물 한 병 챙깄나? 첫 번째는 정문 바로 옆 센트럴파크다. 출발하자!'),
    ('next-ilcheongdam', '다음은 일청담이다! 밤 되믄 호롱불 켜지는 억수로 예쁜 연못이데이. 경북대 오믄 다들 한 번씩 사진 찍고 가는 데 아이가. 지도 따라 같이 가 보자!'),
    ('next-library', '다음은 중앙도서관이다! 전국 대학 도서관 중에 두 번째로 책이 많은 데다. 시험 기간 되믄 여기가 니 두 번째 집 될 끼다. 같이 가 보자!'),
    ('next-bokji', '다음은 복지관이다! 서점, 은행, 우체국까지 학교생활에 필요한 기 다 모여 있데이. 교재 사고 택배 부칠 때 여기만 오믄 된다. 같이 가 보자!'),
    ('next-centralpark', '다음은 센트럴파크다! 다들 줄여가 센팍이라 칸다. 무빔 영화 하는 넓은 잔디밭이라 쉬다 가기 딱 좋데이. 같이 가 보자!'),
    ('next-gongstaurant', '다음은 공식당이다! 공대생들이 억수로 좋아하는 학식 맛집이데이. 배고프믄 힘이 안 나니까, 오늘 메뉴 뭐 있는지 같이 보러 가자!'),
    ('next-cherryroad', '다음은 벚꽃길이다! 봄 되믄 벚꽃잎이 눈처럼 흩날리는 산책로데이. 공식당에서 억수로 가까버가 금방 도착할 끼다. 같이 가 보자!'),
    ('next-stadium', '다음은 대운동장이다! 축제 무대 열리는 데 아이가. 바로 옆 백호관에 중앙동아리방이 모여 있어가 동아리 구경도 할 수 있데이. 마지막까지 힘내가 가 보자!'),
    ('next-loveroad', '다음은 러브로드다! 손잡고 걸으믄 사랑이 이뤄진다 카는 전설이 있는 길이데이. 옆에 친구 손 한번 잡아 볼래? 같이 가 보자!'),
    ('way-gate-loveroad', '드디어 캠퍼스 안에 들어왔데이! 처음엔 길이 다 비슷비슷해 보이제? 내만 따라오믄 금방 익숙해질 끼다. 천천히 같이 걸어 보자!'),
    ('way-loveroad-ilcheongdam', '저기 보이는 웅장한 돌 건물이 본관이다. 1960년에 지었는데, 불국사 계단하고 석굴암 돔을 본떠가 만들었다 카더라. 총장실도 저 안에 있데이!'),
    ('way-ilcheongdam-library', '가는 길에 빨간 벽돌 건물 보이제? 입학식하고 졸업식 하는 대강당이다. 천팔백 명 넘게 들어가는 큰 공연장이라 공연도 자주 한데이.'),
    ('way-library-ilcheongdam', '이 길로 쭉 가믄 일청담 나온데이. 도서관에서 공부하다가 머리 식히러 산책 가기 딱 좋은 거리다. 가는 길에 대강당도 있으니까 단디 봐라!'),
    ('way-library-bokji', '저짝에 높이 솟은 건물 보이제? 17층짜리 글로벌플라자다. 국제회의장도 있고, 경북대 역사 전시관도 있데이.'),
    ('way-bokji-library', '도서관 가는 길이다. 열람실 자리는 도서관 앱으로 미리 잡을 수 있으니까, 걸으믄서 앱 하나 깔아 두는 기 어떻노?'),
    ('way-bokji-centralpark', '복지관에서 센팍까지는 금방이데이. 복지관에서 간식 사 들고 센팍 잔디밭에 앉아가 쉬는 것도 꿀팁이다!'),
    ('way-centralpark-bokji', '인자 복지관 가자. 학기 초에는 교재 사러 서점에 사람이 억수로 몰리니까, 미리 위치 알아 두믄 편하데이!'),
    ('way-loveroad-centralpark', '센팍 가는 길이다. 날 좋은 날엔 잔디밭에 돗자리 펴고 쉬는 학생들이 억수로 많데이. 우리도 담에 피크닉 하러 오자!'),
    ('way-ilcheongdam-gongstaurant', '이짝으로 가믄 공대 건물들이 모여 있데이. 그래서 이 근처 학식당 이름이 공식당이다. 공대 식당, 줄여가 공식당 아이가!'),
    ('way-gongstaurant-cherryroad', '배 든든하게 채웠나? 인자 소화도 시킬 겸 천천히 걸어 보자. 벚꽃길은 바로 코앞이데이!'),
    ('way-cherryroad-stadium', '대운동장 가는 길은 쫌 걸어야 된데이. 축제 때는 이 길이 사람으로 꽉 차가 걷기도 힘들 정도라 카더라. 지금은 여유롭게 걸어 보자!'),
    ('half-loveroad', '지금 걷는 이 길이 백양로다. 정문에서 본관 쪽으로 쭉 이어지는 경북대 메인 길이데이. 봄 되믄 길가에 꽃이 펴가 더 예쁘다!'),
    ('half-ilcheongdam', '일청담은 경북대 상징인 감꽃 모양을 본떠가 만든 연못이다. 물가에 수달 있나 단디 봐라! 운 좋으믄 만날 수도 있데이.'),
    ('half-library', '도서관 자리는 앱으로 미리 예약할 수 있데이. 시험 기간엔 자리가 퍼뜩 차니까 꼭 깔아 둬라! 열람실은 신관, 책은 구관이다.'),
    ('half-bokji', '복지관엔 서점하고 은행, 우체국도 있데이. 교재 살 때나 택배 부칠 때 들르믄 된다. 거의 다 왔다!'),
    ('half-centralpark', '센팍에서는 무빔이라고, 밖에서 영화 틀어 주는 행사도 한데이. 날 좋은 날 친구랑 돗자리 들고 꼭 와 봐라!'),
    ('half-gongstaurant', '공식당 메뉴는 매일 바뀐데이. 인스타나 크누피아에서 미리 볼 수 있다! 오늘 메뉴는 뭐겠노? 벌써 배고프다.'),
    ('half-cherryroad', '벚꽃길은 공식당이랑 억수로 가깝데이. 봄에 오믄 꽃잎이 바람에 흩날리가 진짜 예쁘다. 금방 도착한데이!'),
    ('half-stadium', '작년 축제엔 지코랑 선미도 왔다 카더라. 올해는 누가 올지 벌써 궁금하네! 쫌만 더 가자!'),
    ('intro-loveroad', '도착! 여기가 러브로드다. 연인이 손잡고 정문에서 본관 쪽으로 걸으믄 영원한 사랑이 이뤄진다 카는 전설이 있데이. 친구랑 같이 걸어도 좋다! 여기서 사진 한 장 남기고 갈래?'),
    ('intro-ilcheongdam', '도착! 여기가 일청담이다. 경북대 상징인 감꽃 모양을 본떠가 만든 연못이데이. 밤 되믄 호롱불 켜지고, 가끔 신천에 사는 수달도 놀러 온다 카더라! 물가 벤치에 앉아가 잠깐 쉬다 가도 된다.'),
    ('intro-library', '도착! 여기가 중앙도서관이다. 전국 대학 도서관 중에 두 번째로 책이 많은 데다. 열람실은 신관, 책은 구관에 있고, 자리는 도서관 앱으로 예약할 수 있데이. 안에서는 조용히 해야 되니까 우리 목소리 쫌 낮추자, 쉿!'),
    ('intro-bokji', '도착! 여기가 복지관이다. 서점, 은행, 우체국, 학식당까지 학교생활에 필요한 기 다 모여 있데이. 개강 준비물은 여기서 챙기믄 된다! 공강 시간에 들르기 딱 좋은 데다.'),
    ('intro-centralpark', '도착! 여기가 센트럴파크, 줄여가 센팍이다. 영화 틀어 주는 무빔이 열리는 잔디밭이데이. 돗자리 펴고 피크닉 하기 딱 좋다! 잔디에 잠깐 앉아가 다리 쫌 쉬다 가자.'),
    ('intro-gongstaurant', '도착! 여기가 공식당이다. 공대생들한테 인기 많은 학식당인데, 치즈알밥하고 육회비빔밥이 억수로 맛있데이. 개강 시즌엔 사람 많으니까 일찍 와야 된다! 배고프믄 여기서 밥 묵고 가자.'),
    ('intro-cherryroad', '도착! 여기가 벚꽃길이다. 봄 되믄 벚꽃잎이 눈처럼 흩날리는 산책로데이. 여기서 찍으믄 인생샷 보장이다! 꽃잎 떨어질 때 맞춰가 찍으믄 더 예쁘데이.'),
    ('intro-stadium', '도착! 여기가 대운동장이다. 축제 무대 열리는 데고, 바로 옆 백호관에는 중앙동아리방이 모여 있데이. 올해 축제엔 누가 오겠노? 축제 때 여기 꽉 찬 거 꼭 보러 온나!'),
    ('near', '거의 다 왔데이! 저 앞이다! 쫌만 더 힘내라!'),
    ('wrong', '어, 반대쪽 같은데? 화살표 가리키는 쪽으로 다시 가 봐라. 길 잃어도 내 있으니까 걱정 마래이!'),
    ('far', '아직 쫌 멀다! 화살표 따라 쫌만 더 가 봐라. 빨간 데 안에 들어오믄 도착이데이!'),
    ('halfway', '벌써 반이나 왔데이! 이 속도믄 금방 도착하겠다.'),
    ('finish-godsaeng', '갓생 코스 완주다! 갓생 새내기 뱃지 받았데이. 오늘 다닌 데, 인자 혼자서도 찾아갈 수 있겠제? 같이 돌아가 억수로 재밌었다. 담에 또 같이 걷자!'),
    ('finish-healing', '힐링 코스 완주다! 힐링 마스터 뱃지 받았데이. 오늘 다닌 데, 인자 혼자서도 찾아갈 수 있겠제? 같이 돌아가 억수로 재밌었다. 담에 또 같이 걷자!'),
    ('finish-full', '전체 코스 완주다! 캠퍼스 정복자 뱃지 받았데이. 오늘 다닌 데, 인자 혼자서도 찾아갈 수 있겠제? 같이 돌아가 억수로 재밌었다. 담에 또 같이 걷자!'),
]

# 몽실이 — 표준어 대사 (docs/js/tour.js 의 SCRIPT_STD 와 똑같이)
LINES_STD = [
    ('start-godsaeng', '안녕! 나는 경북대 마스코트 호반우야. 오늘은 정문에서 출발해서 갓생 코스를 같이 돌 거야. 공부하고 생활하는 데 꼭 필요한 곳만 쏙쏙 골랐어! 첫 번째 장소는 정문 바로 옆 센트럴파크야. 화살표 따라 출발하자!'),
    ('start-healing', '안녕! 나는 경북대 마스코트 호반우야. 오늘은 정문에서 출발해서 힐링 코스를 같이 돌 거야. 맛있는 학식 먹고, 벚꽃길 산책하면서 쉬어 가는 코스야! 첫 번째 장소는 러브로드야. 화살표 따라 출발하자!'),
    ('start-full', '안녕! 나는 경북대 마스코트 호반우야. 오늘은 정문에서 출발해서 전체 코스를 같이 돌 거야. 캠퍼스 여덟 곳을 한 바퀴 다 도는 코스라 조금 길어. 물 한 병 챙겼지? 첫 번째 장소는 정문 바로 옆 센트럴파크야. 출발하자!'),
    ('next-ilcheongdam', '다음은 일청담! 밤에 호롱불이 켜지는 예쁜 연못이야. 경북대에 오면 다들 한 번씩 사진 찍고 가는 곳이지. 지도 따라 같이 가 보자!'),
    ('next-library', '다음은 중앙도서관! 전국 대학 도서관 중에서 두 번째로 책이 많은 곳이야. 시험 기간엔 여기가 제2의 집이 될걸? 같이 가 보자!'),
    ('next-bokji', '다음은 복지관! 서점, 은행, 우체국까지 학교생활에 필요한 곳이 다 모여 있어. 교재 사고 택배 보낼 때 여기만 오면 돼. 같이 가 보자!'),
    ('next-centralpark', '다음은 센트럴파크! 다들 줄여서 센팍이라고 불러. 무빔 영화가 열리는 넓은 잔디밭이라 쉬어 가기 딱 좋아. 같이 가 보자!'),
    ('next-gongstaurant', '다음은 공식당! 공대생들이 사랑하는 학식 맛집이야. 배고프면 힘이 안 나니까, 오늘 메뉴 뭐 있는지 같이 보러 가자!'),
    ('next-cherryroad', '다음은 벚꽃길! 봄이면 벚꽃잎이 눈처럼 흩날리는 산책로야. 공식당에서 아주 가까우니까 금방 도착할 거야. 같이 가 보자!'),
    ('next-stadium', '다음은 대운동장! 축제 무대가 열리는 곳이야. 바로 옆 백호관에는 중앙동아리방이 모여 있어서 동아리 구경도 할 수 있어. 마지막까지 힘내서 가 보자!'),
    ('next-loveroad', '다음은 러브로드! 손잡고 걸으면 사랑이 이루어진다는 전설이 있는 길이야. 옆에 있는 친구 손 한번 잡아 볼래? 같이 가 보자!'),
    ('way-gate-loveroad', '드디어 캠퍼스 안으로 들어왔어! 처음엔 길이 다 비슷해 보이지만, 나만 따라오면 금방 익숙해질 거야. 천천히 같이 걸어 보자!'),
    ('way-loveroad-ilcheongdam', '저기 보이는 웅장한 돌 건물이 본관이야. 1960년에 지어졌는데, 불국사 계단이랑 석굴암 돔을 본떠서 만들었대. 총장실도 저 안에 있어!'),
    ('way-ilcheongdam-library', '가는 길에 빨간 벽돌 건물 보여? 입학식이랑 졸업식이 열리는 대강당이야. 천팔백 명 넘게 들어가는 큰 공연장이라 공연도 자주 열려.'),
    ('way-library-ilcheongdam', '이 길로 쭉 가면 일청담이 나와. 도서관에서 공부하다 머리 식히러 산책 오기 딱 좋은 거리야. 가는 길에 대강당도 있으니까 잘 봐 봐!'),
    ('way-library-bokji', '저쪽에 높게 솟은 건물 보여? 17층짜리 글로벌플라자야. 국제회의장도 있고, 경북대 역사 전시관도 있어.'),
    ('way-bokji-library', '도서관 가는 길이야. 열람실 자리는 도서관 앱으로 미리 잡을 수 있으니까, 걸으면서 앱 하나 깔아 두는 거 어때?'),
    ('way-bokji-centralpark', '복지관에서 센팍까지는 금방이야. 복지관에서 간식 사 들고 센팍 잔디밭에 앉아 쉬는 것도 꿀팁이야!'),
    ('way-centralpark-bokji', '이제 복지관으로 가자. 학기 초에는 교재 사러 서점에 사람이 엄청 몰리니까, 미리 위치를 알아 두면 편해!'),
    ('way-loveroad-centralpark', '센팍 가는 길이야. 날 좋은 날엔 잔디밭에 돗자리 펴고 쉬는 학생들이 정말 많아. 우리도 나중에 피크닉 하러 오자!'),
    ('way-ilcheongdam-gongstaurant', '이쪽으로 가면 공대 건물들이 모여 있어. 그래서 이 근처 학식당 이름이 공식당이야. 공대 식당, 줄여서 공식당!'),
    ('way-gongstaurant-cherryroad', '배 든든하게 채웠지? 이제 소화도 시킬 겸 천천히 걸어 보자. 벚꽃길은 바로 코앞이야!'),
    ('way-cherryroad-stadium', '대운동장 가는 길은 조금 걸어야 해. 축제 땐 이 길이 사람으로 꽉 차서 걷기도 힘들 정도래. 지금은 여유롭게 걸어 보자!'),
    ('half-loveroad', '지금 걷는 이 길이 백양로야. 정문에서 본관 쪽으로 쭉 이어지는 경북대의 메인 길이지. 봄에는 길가에 꽃이 펴서 더 예뻐!'),
    ('half-ilcheongdam', '일청담은 경북대의 상징인 감꽃 모양을 본떠 만든 연못이야. 물가에 수달이 있나 잘 봐 봐! 운 좋으면 만날 수도 있어.'),
    ('half-library', '도서관 자리는 앱으로 미리 예약할 수 있어. 시험 기간엔 자리가 금방 차니까 꼭 깔아 둬! 열람실은 신관, 책은 구관이야.'),
    ('half-bokji', '복지관엔 서점이랑 은행, 우체국도 있어. 교재 살 때나 택배 보낼 때 들르면 돼. 거의 다 왔어!'),
    ('half-centralpark', '센팍에선 무빔이라고, 야외에서 영화를 틀어 주는 행사도 열려. 날 좋은 날 친구랑 돗자리 들고 꼭 와 봐!'),
    ('half-gongstaurant', '공식당 메뉴는 매일 바뀌어. 인스타나 크누피아에서 미리 볼 수 있어! 오늘 메뉴는 뭘까? 벌써 배고프다.'),
    ('half-cherryroad', '벚꽃길은 공식당이랑 아주 가까워. 봄에 오면 꽃잎이 바람에 흩날려서 진짜 예뻐. 금방 도착해!'),
    ('half-stadium', '작년 축제엔 지코랑 선미도 왔대. 올해는 누가 올지 벌써 궁금하다! 조금만 더 가자!'),
    ('intro-loveroad', '도착! 여기는 러브로드야. 연인이 손을 잡고 정문에서 본관 방향으로 걸으면 영원한 사랑이 이루어진다는 전설이 있어. 친구랑 같이 걸어도 좋아! 여기서 사진 한 장 남겨 볼래?'),
    ('intro-ilcheongdam', '도착! 여기는 일청담이야. 경북대의 상징인 감꽃 모양을 본떠 만든 연못이야. 밤이 되면 호롱불이 켜지고, 가끔 신천에 사는 수달도 놀러 온대! 물가 벤치에 앉아서 잠깐 쉬어 가도 좋아.'),
    ('intro-library', '도착! 여기는 중앙도서관이야. 전국 대학 도서관 중에서 두 번째로 책이 많은 곳이야. 열람실은 신관, 책은 구관에 있고, 자리는 도서관 앱으로 예약할 수 있어. 안에서는 조용히 해야 하니까 우리 목소리 낮추자, 쉿!'),
    ('intro-bokji', '도착! 여기는 복지관이야. 서점, 은행, 우체국, 학식당까지 학교생활에 필요한 곳이 모여 있어. 개강 준비물은 여기서 챙기면 돼! 공강 시간에 들르기 딱 좋은 곳이야.'),
    ('intro-centralpark', '도착! 여기는 센트럴파크, 줄여서 센팍이야. 영화를 상영하는 무빔이 열리는 잔디밭이야. 돗자리 펴고 피크닉 하기 딱 좋아! 잔디에 잠깐 앉아서 다리 좀 쉬어 가자.'),
    ('intro-gongstaurant', '도착! 여기는 공식당이야. 공대생들에게 인기 있는 학식당인데, 치즈알밥이랑 육회비빔밥이 특히 맛있어. 개강 시즌엔 사람이 많으니까 일찍 와야 해! 배고프면 여기서 밥 먹고 가자.'),
    ('intro-cherryroad', '도착! 여기는 벚꽃길이야. 봄이 되면 벚꽃 잎이 눈처럼 흩날리는 산책로야. 여기서 찍으면 인생샷 보장! 꽃잎이 떨어질 때 맞춰서 찍으면 더 예뻐.'),
    ('intro-stadium', '도착! 여기는 대운동장이야. 축제 무대가 열리는 곳이고, 바로 옆 백호관에는 중앙동아리방이 모여 있어. 올해 축제엔 누가 올까? 축제 때 여기 꽉 찬 모습 꼭 보러 와!'),
    ('near', '거의 다 왔어! 저 앞이야! 조금만 더 힘내!'),
    ('wrong', '어, 반대쪽 같아! 화살표가 가리키는 방향으로 다시 가 줘. 길 잃어도 내가 있으니까 걱정 마!'),
    ('far', '아직 좀 멀어! 화살표를 따라 조금만 더 가 줘. 빨간 영역 안에 들어오면 도착이야!'),
    ('halfway', '벌써 반이나 왔어! 이 속도면 금방 도착하겠다.'),
    ('finish-godsaeng', '갓생 코스 완주! 갓생 새내기 뱃지를 받았어. 오늘 다닌 곳들, 이제 혼자서도 찾아갈 수 있지? 같이 돌아서 정말 즐거웠어. 다음에 또 같이 걷자!'),
    ('finish-healing', '힐링 코스 완주! 힐링 마스터 뱃지를 받았어. 오늘 다닌 곳들, 이제 혼자서도 찾아갈 수 있지? 같이 돌아서 정말 즐거웠어. 다음에 또 같이 걷자!'),
    ('finish-full', '전체 코스 완주! 캠퍼스 정복자 뱃지를 받았어. 오늘 다닌 곳들, 이제 혼자서도 찾아갈 수 있지? 같이 돌아서 정말 즐거웠어. 다음에 또 같이 걷자!'),
]

def tts(text, key, model):
    mood = "normal" if key in CALM else V["mood"]
    if model == "ssfm-v21" and mood not in ("normal", "sad", "happy", "angry"):
        mood = "normal"   # 옛 모델은 tonedown이 없음
    body = {
        "voice_id": V["id"], "text": text, "model": model, "language": "kor",
        "prompt": {"emotion_type": "preset", "emotion_preset": mood, "emotion_intensity": 1.0},
        "output": {"audio_format": "mp3", "volume": 100, "audio_pitch": V["pitch"], "audio_tempo": 1.0},
    }
    req = urllib.request.Request("https://api.typecast.ai/v1/text-to-speech", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", "X-API-KEY": API_KEY}, method="POST")
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()

# API 키 읽는 순서: ① 터미널 환경변수 TYPECAST_API_KEY  ② tools/typecast_key.txt 파일 (이 파일은 .gitignore로 깃허브에 안 올라감)
KEY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "typecast_key.txt")
API_KEY = os.environ.get("TYPECAST_API_KEY", "").strip()
if not API_KEY and os.path.exists(KEY_FILE):
    API_KEY = open(KEY_FILE, encoding="utf-8").read().strip()
if not API_KEY:
    sys.exit("API 키가 없어요. tools/typecast_key.txt 파일에 키만 한 줄 적어 두거나, $env:TYPECAST_API_KEY=\"키\" 를 먼저 실행해 주세요.")
os.makedirs(OUT, exist_ok=True)
only = set(args)
todo = [(k, t) for k, t in globals()[V["lines"]] if not only or k in only]
print(f"[{VOICE}] {len(todo)}개 만들기 (약 {sum(len(t) for _, t in todo)}크레딧)")
model_i = 0
for i, (key, text) in enumerate(todo, 1):
    for attempt in range(4):
        try:
            data = tts(text, key, MODELS[model_i])
            with open(os.path.join(OUT, key + ".mp3"), "wb") as f:
                f.write(data)
            print(f"[{i}/{len(todo)}] {key}.mp3  ({len(data)//1024}KB, {MODELS[model_i]})")
            break
        except urllib.error.HTTPError as e:
            msg = e.read().decode("utf-8", "ignore")[:200]
            if e.code in (400, 422) and model_i < len(MODELS) - 1 and "model" in msg.lower():
                model_i += 1; print("  → 모델 변경:", MODELS[model_i]); continue
            if e.code == 429 or e.code >= 500:
                time.sleep(3 * (attempt + 1)); continue
            sys.exit(f"오류 {e.code} ({key}): {msg}\n401=키 확인, 402=크레딧 부족")
        except Exception as e:
            print("  다시 시도:", e); time.sleep(3)
    else:
        sys.exit(f"{key} 실패")
    time.sleep(0.4)
print(f"완료! docs/audio/{V['dir']} 폴더를 확인하세요.")
