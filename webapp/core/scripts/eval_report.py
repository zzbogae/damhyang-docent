"""out/eval/eval_all.json → docs/eval.md (합성 인물 평가 표)."""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
r = json.loads((ROOT / "out/eval/eval_all.json").read_text(encoding="utf-8"))
NAME = {"long": "long(15년·6채널)", "elder": "elder(고연령 가정)", "short": "short(2년)"}
L = []
w = L.append
w("# 판정 코어 평가 (합성 인물)\n")
w("합성 인물 세 명의 정답 사건(`synth/out/<인물>/events.json`)으로 잰 값이다. 실제 기록이 아니므로 절대 수치보다 기준값끼리의 비교로 읽는다. "
  "다시 만들기: `core/.venv/bin/python core/scripts/eval_all.py && core/.venv/bin/python core/scripts/eval_report.py`\n")
w("## 1. 기준값 비교\n")
w("우연 판정률은 정답 사건 앞뒤 3주(영구 변화는 뒤 8주)를 뺀 주에서 판정된 비율, 재현율은 일시적 사건 주 ±1주 안에 판정이 있는 비율, 집중도는 사건 앞뒤 2주의 판정 비율 ÷ 원형 이동 기대치다.\n")
w("| 인물 | 기준값 | 판정 주 | 교차검증 주 | 우연 판정률 | 사건 재현율 | 집중도 |")
w("|---|---|---|---|---|---|---|")
for p, v in r.items():
    for c, x in v["configs"].items():
        w(f"| {NAME[p]} | {c} | {x['n_candidates']} / {x['n_weeks']} | {x['n_cross']} | {x['chance_rate_far']:.1%} | {x['event_recall']:.0%} | {x['enrichment']:.2f}배 |")
w("")
w("## 2. 교차검증 주와 우연 기대치(원형 이동 1,000회, 기본값)\n")
w("| 인물 | 계열 2개 이상이 같은 주에 배지 | 우연 기대치 | 비율 | p |")
w("|---|---|---|---|---|")
for p, v in r.items():
    c = v["validate"]["cross_null"]
    w(f"| {NAME[p]} | {c['observed']} | {c['null_mean']} | {c['ratio']} | {c['p_value']} |")
w("")
w("## 3. 한 채널을 빼고 판정(홀드아웃, 기본값)\n")
w("뺀 채널도 그 주에 평소 범위(10%·90%)를 벗어난 비율 ÷ 전체 주에서의 비율. 괄호는 부트스트랩 95% 구간.\n")
w("| 인물 | 채널 | 향상도 | 95% 구간 | 채점한 주 |")
w("|---|---|---|---|---|")
for p, v in r.items():
    for ch, h in v["holdout"].items():
        if "lift" in h:
            w(f"| {NAME[p]} | {ch} | {h['lift']} | {h['lift_ci95'][0]}~{h['lift_ci95'][1]} | {h['n_scored']} |")
        else:
            w(f"| {NAME[p]} | {ch} | - | - | {h.get('n_scored', 0)} (너무 적음) |")
w("")
w("## 4. 합성 이상 주입(기본값)\n")
w("'힘든 주' 형태(걸음·수면 감소, 새벽 시청·새벽 메모 증가)를 크기 m 으로 넣었을 때 판정(candidate)과 배지를 찾은 비율. '걸음만'은 한 채널만 바꾼 경우다(판정은 배지 2개가 필요해서 거의 안 됨).\n")
w("| 인물 | 형태 | m=0.1 | m=0.2 | m=0.3 | m=0.5 |")
w("|---|---|---|---|---|---|")
for p, v in r.items():
    for key, lab in [("injection_hard", "힘든 주"), ("injection_steps", "걸음만")]:
        cells = []
        for m in ["0.1", "0.2", "0.3", "0.5"]:
            x = v[key][m]
            cells.append("-" if x["candidate_recall"] is None else f"{x['candidate_recall']:.0%} / 배지 {x['badge_recall']:.0%}")
        w(f"| {NAME[p]} | {lab} | " + " | ".join(cells) + " |")
w("")
w("## 5. 창 길이·결측·공백 찾기·영구 변화\n")
w("| 인물 | 26주 vs 52주 자카드 | 104주 vs 52주 자카드 | 결측 채우면 새로 생기는 판정(0으로/평소로) | 공백 주 찾은 비율 | 영구 변화 근처 시기 경계 |")
w("|---|---|---|---|---|---|")
for p, v in r.items():
    gaps = ", ".join(f"{ch} {g['detected_in_truth']}/{g['truth_weeks']}" for ch, g in v["gap_detection"].items())
    pb = v["persistent_boundaries"]
    m = v["missing"]
    w(f"| {NAME[p]} | {v['window']['26']['jaccard_vs_52']} | {v['window']['104']['jaccard_vs_52']} | {m['added_if_missing_is_low']}/{m['added_if_missing_is_usual']} | {gaps} | {int(round((pb['recall'] or 0) * pb['n']))}/{pb['n']} |")
w("")
w("## 6. 유효 검정 수(M_eff)\n")
w("| 인물 | 지표 수 | Nyholt | Li & Ji | 상관 0.5 이상으로 묶인 지표 |")
w("|---|---|---|---|---|")
for p, v in r.items():
    m = v["validate"]["meff_all"]
    cl = [c for c in v["validate"]["clusters"] if len(c) > 1]
    w(f"| {NAME[p]} | {m['M']} | {m['nyholt']} | {m['li_ji']} | {', '.join('·'.join(c) for c in cl) or '없음'} |")
w("\n합성 생성기는 같은 계열 안의 지표를 서로 독립적으로 흔들기 때문에 M_eff 가 지표 수와 같게 나온다. 계열 규칙의 근거는 팀원 실제 기록으로 다시 재야 한다.\n")
(ROOT / "docs/eval.md").write_text("\n".join(L), encoding="utf-8-sig")
print("\n".join(L)[:4000])
