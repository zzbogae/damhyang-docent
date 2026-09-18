"""이어진 섬 설계 시연용 가상 이웃 데이터(web/public/islands/demo.json)를 만든다.

합성 인물(long·elder·short)의 판정 결과에서 광물 분포를 가져오고, 방 이름·별명·방명록은 지어낸다.
실제 사람이 아니다. 실행: core/.venv/bin/python synth/islands_demo.py
"""
from __future__ import annotations

import json
import pathlib
import random
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "core"))
from mined_core import run  # noqa: E402

MINERALS = ["호박", "청금석", "자수정", "흑요석"]

NEIGHBORS = [
    {"persona": "long", "nickname": "느린 등대", "invite_code": "MINE-3F7K",
     "rooms": ["긴 겨울", "바다 가던 달", "이사한 해"],
     "guestbook": [{"from": "구름 정원", "text": "방 이름이 좋아서 들렀다 갑니다."}]},
    {"persona": "elder", "nickname": "구름 정원", "invite_code": "MINE-8Q2D",
     "rooms": ["여름 산책", "손주 온 주"],
     "guestbook": [{"from": "느린 등대", "text": "여름 산책 방 이름을 보고 저도 같은 이름을 붙여 봤습니다."}]},
    {"persona": "short", "nickname": "새벽 책상", "invite_code": "MINE-5M9T",
     "rooms": ["첫 출근", "긴 겨울"],
     "guestbook": []},
]


def load(p: pathlib.Path):
    return json.loads(p.read_text(encoding="utf-8"))


def main():
    rng = random.Random(20260911)
    out = []
    for n in NEIGHBORS:
        d = ROOT / "synth" / "out" / n["persona"]
        res = run(load(d / "truth_daily.json"), load(d / "truth_meta.json"))
        cands = [w for w in res["weeks"] if w["candidate"] and w["mineral"]]
        minerals = {m: sum(1 for w in cands if w["mineral"] == m) for m in MINERALS}
        # 판정된 주 일부를 방마다 나눠 담는다(한 방에 5~9주, 방이 열리려면 5주 이상)
        pool = cands[:]
        rng.shuffle(pool)
        rooms = []
        for name in n["rooms"]:
            k = min(len(pool), rng.randint(5, 9))
            picked, pool = pool[:k], pool[k:]
            rooms.append({"name": name, "specimens": len(picked),
                          "minerals": {m: sum(1 for w in picked if w["mineral"] == m) for m in MINERALS}})
        out.append({
            "id": n["persona"],
            "nickname": n["nickname"],
            "invite_code": n["invite_code"],
            "rooms": rooms,
            "minerals": minerals,
            "guestbook": n["guestbook"],
        })
    doc = {
        "notice": "이어진 섬 설계 시연용 가상 이웃입니다. 실제 사람이 아니며, 광물 수는 합성 인물의 판정 결과에서 가져왔습니다.",
        "fake": True,
        "neighbors": out,
    }
    dest = ROOT / "web" / "public" / "islands" / "demo.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    print(dest, [(x["nickname"], x["minerals"], [r["name"] for r in x["rooms"]]) for x in out])


if __name__ == "__main__":
    main()
