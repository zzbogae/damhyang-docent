# 나의 공간 이미지 생성(11/12 멘토진): 관객이 고른 여섯 가지 + 사전 단어로 이미지 프롬프트를 조립한다.
# - 선택 값은 화면(webapp/web/src/ui/IslandMake.tsx STEPS)의 보기와 같은 허용 목록만 받는다.
#   「직접 쓰기」 값은 섬 키워드 사전(space_words.py)에 있을 때만 대표어로 바꿔 넣고, 없으면 버린다.
# - 섬 다섯 곳(SpaceTour.tsx TOUR: 바다·하늘산·정글·음악방·온천)은 예시 영상과 같은 화풍(1인칭 실사, 손이 화면 아래에 보임)으로 맞춘다.
# - 소리(곡)는 그림에 들어가지 않고, 섬을 정하는 데만 쓴다. 관객 원문은 프롬프트에 들어가지 않는다.
from space_words import filter_words, match_word

ISLANDS = {
    "sea": ("바다", "a small rocky island cove with clear turquoise water, a wooden pier and a weathered wooden cabin on the shore"),
    "sky": ("하늘산", "a stone path on a cliff-top mountain island floating above a sea of clouds, a small stone-and-wood hut with a canvas awning"),
    "jungle": ("정글", "a dense tropical jungle island with huge wet leaves and ferns, an open wooden bungalow with a hammock under the eaves"),
    "music": ("음악방", "a cozy music room with record shelves, an upright piano, a guitar, a wall clock, rugs and a leather armchair, a window to the outside"),
    "onsen": ("온천", "a steaming outdoor hot spring among snowy pine trees and mountains, a stone lantern, a small wooden tray with a cup floating on the water"),
}

STYLE = (
    "Photorealistic cinematic still, first-person point of view: the viewer's own hand rests at the lower edge of the frame "
    "(on a railing, rock, leaf or door frame). Natural soft light, gentle depth of field, calm healing mood, "
    "rich but not oversaturated colors, 16:9 landscape composition. Nobody else is in the scene. "
    "No text, letters, signs, logos, watermarks or UI."
)

TIME = {
    "새벽": "at dawn, cool blue light before sunrise",
    "아침": "in the morning, fresh low sunlight",
    "점심": "at midday, bright clear daylight",
    "해질녘": "at sunset, warm golden-orange light",
    "밤": "at night, moonlight and a few warm lamps",
}
WEATHER = {
    "봄": "spring with fresh green leaves and blossoms",
    "여름": "summer",
    "가을": "autumn with amber leaves",
    "겨울": "winter",
    "비": "gentle rain falling, wet glistening surfaces",
    "눈": "snow falling and covering the ground",
    "햇살": "sunbeams streaming through",
    "흐림": "soft overcast sky",
    "안개": "light mist drifting",
}
PLACE = {
    "바다": "by the sea",
    "산": "high in the mountains",
    "호수": "beside a still lake with reflections",
    "들판": "in an open grassy field",
    "숲": "in a forest",
    "사막": "in a desert with sand dunes",
    "도시": "with a city skyline in the distance",
}
ERA = {
    "시대 없음": "",
    "1970년대": "furnishings and objects in a 1970s style",
    "1980년대": "furnishings and objects in a 1980s style",
    "1990년대": "furnishings and objects in a 1990s style",
    "2000년대": "furnishings and objects in a 2000s style",
    "지금": "contemporary furnishings",
    "먼 미래": "subtle far-future architecture and materials",
}
DWELLING = {
    "룸": "a single cozy room",
    "방갈로": "an open-sided wooden bungalow",
    "텐트": "a canvas tent",
    "하우스": "a small house",
    "오두막": "a small wooden cabin",
    "열린 작업실": "an open-air workshop studio",
}
MUSIC_ISLAND = {"sea": "sea", "sky": "sky", "jungle": "jungle", "music": "music"}
PLACE_ISLAND = {"바다": "sea", "호수": "sea", "산": "sky", "사막": "sky", "숲": "jungle", "들판": "jungle", "도시": "music"}
MAX_WEATHER = 2


def _one(v) -> str:
    """선택 값은 문자열 하나(화면은 배열로 보내기도 해서 첫 값만)"""
    if isinstance(v, list):
        v = v[0] if v else ""
    return v.strip() if isinstance(v, str) else ""


def _choice(raw, table: dict):
    """허용 목록 값 → (표시 값, 영어 구절). 직접 쓰기는 사전 대표어로만, 없으면 None"""
    v = _one(raw)
    if not v:
        return None
    if v in table:
        return v, table[v]
    e = match_word(v)
    if e:
        return e["word"], f"{e['word']} ({e['scene']})"
    return None


def pick_island(sel: dict) -> str:
    """정해진 섬 → 곡 → 겨울·눈이면 온천 → 장소 순서. 아무것도 없으면 바다"""
    isl = _one(sel.get("island"))
    if isl in ISLANDS:
        return isl
    m = _one(sel.get("music"))
    if m in MUSIC_ISLAND:
        return MUSIC_ISLAND[m]
    w = sel.get("weather") if isinstance(sel.get("weather"), list) else [sel.get("weather")]
    if any(x in ("겨울", "눈") for x in w):
        return "onsen"
    return PLACE_ISLAND.get(_one(sel.get("place")), "sea")


def build_prompt(sel) -> dict:
    """선택 dict → {"island", "prompt", "used"}. used 는 프롬프트에 실제로 들어간 한국어 값(화면 표시·기록용)"""
    sel = sel if isinstance(sel, dict) else {}
    island = pick_island(sel)
    used: dict = {}
    parts: list[str] = []

    t = _choice(sel.get("time"), TIME)
    if t:
        used["time"] = t[0]
        parts.append(t[1])
    ws = sel.get("weather") if isinstance(sel.get("weather"), list) else [sel.get("weather")]
    wv = [c for c in (_choice(x, WEATHER) for x in ws[:MAX_WEATHER]) if c]
    if wv:
        used["weather"] = [c[0] for c in wv]
        parts.append(", ".join(c[1] for c in wv))
    p = _choice(sel.get("place"), PLACE)
    if p:
        used["place"] = p[0]
        parts.append(p[1])
    e = _choice(sel.get("era"), ERA)
    if e:
        used["era"] = e[0]
        if e[1]:
            parts.append(e[1])
    d = _choice(sel.get("dwelling"), DWELLING)
    if d:
        used["dwelling"] = d[0]
        parts.append(f"the place to stay is {d[1]}")

    words = filter_words(sel.get("words"))
    used["words"] = [w["word"] for w in words]

    label, scene = ISLANDS[island]
    lines = [STYLE, f"Island ({label}): {scene}."]
    if parts:
        lines.append("Setting: " + "; ".join(parts) + ".")
    if words:
        lines.append(
            "Include these small details naturally (Korean keyword, then what it looks like): "
            + "; ".join(f"{w['word']} ({w['scene']})" for w in words) + "."
        )
    return {"island": island, "prompt": "\n".join(lines), "used": used}
