"""계열 검증(2-4): 유효 검정 수 M_eff, 상관 군집, 원형 이동 귀무모형.

모두 numpy 만 쓴다(Pyodide 에서도 돈다). 판정 결과(run 의 반환값)를 입력으로 받는다.
"""
from __future__ import annotations

import numpy as np

from .indicators import BY_ID, FAMILIES, INDICATORS


def pr_matrix(result: dict) -> tuple[list[str], np.ndarray]:
    ids = [i.id for i in INDICATORS]
    M = np.array([[np.nan if (w["ind"][i]["pr"] is None) else w["ind"][i]["pr"] for i in ids] for w in result["weeks"]],
                 dtype=float)
    return ids, M


def _rank(x: np.ndarray) -> np.ndarray:
    order = np.argsort(x, kind="mergesort")
    r = np.empty(len(x))
    r[order] = np.arange(len(x), dtype=float)
    # 같은 값은 평균 순위
    xs = x[order]
    i = 0
    while i < len(xs):
        j = i
        while j + 1 < len(xs) and xs[j + 1] == xs[i]:
            j += 1
        if j > i:
            r[order[i:j + 1]] = (i + j) / 2
        i = j + 1
    return r


def spearman_pairwise(M: np.ndarray, min_n: int = 30) -> np.ndarray:
    k = M.shape[1]
    C = np.full((k, k), np.nan)
    for a in range(k):
        C[a, a] = 1.0
        for b in range(a + 1, k):
            m = ~np.isnan(M[:, a]) & ~np.isnan(M[:, b])
            if m.sum() < min_n:
                continue
            ra, rb = _rank(M[m, a]), _rank(M[m, b])
            if np.std(ra) == 0 or np.std(rb) == 0:
                continue
            C[a, b] = C[b, a] = float(np.corrcoef(ra, rb)[0, 1])
    return C


def meff(C: np.ndarray) -> dict:
    """Nyholt(2004) 와 Li & Ji(2005) 의 유효 검정 수. 상관을 모르는 쌍(nan)은 0으로 둔다."""
    k = C.shape[0]
    if k == 0:
        return {"M": 0, "nyholt": 0.0, "li_ji": 0.0}
    A = np.nan_to_num(C, nan=0.0)
    np.fill_diagonal(A, 1.0)
    lam = np.clip(np.linalg.eigvalsh(A), 0, None)
    nyholt = 1 + (k - 1) * (1 - np.var(lam, ddof=1) / k) if k > 1 else 1.0
    li_ji = float(sum((1 if l >= 1 else 0) + (l - np.floor(l)) for l in np.abs(lam)))
    return {"M": k, "nyholt": round(float(nyholt), 3), "li_ji": round(li_ji, 3)}


def clusters(C: np.ndarray, ids: list[str], cut: float = 0.5) -> list[list[str]]:
    """평균 연결 계층 군집. 거리 1-|ρ|, 거리가 cut 이하일 때까지 묶는다(|ρ| ≥ 0.5 끼리)."""
    groups = [[k] for k in range(len(ids))]
    D = 1 - np.abs(np.nan_to_num(C, nan=0.0))

    def dist(g, h):
        return float(np.mean([D[a, b] for a in g for b in h]))

    while len(groups) > 1:
        best = None
        for x in range(len(groups)):
            for y in range(x + 1, len(groups)):
                d = dist(groups[x], groups[y])
                if best is None or d < best[0]:
                    best = (d, x, y)
        if best[0] > cut:
            break
        _, x, y = best
        groups[x] = groups[x] + groups[y]
        groups.pop(y)
    return [sorted(ids[k] for k in g) for g in groups]


def family_flags(result: dict) -> tuple[np.ndarray, np.ndarray]:
    """주 × 계열: 그 계열에 배지가 있는지, 그 계열이 관측됐는지."""
    W = len(result["weeks"])
    F = np.zeros((W, len(FAMILIES)), dtype=bool)
    O = np.zeros((W, len(FAMILIES)), dtype=bool)
    for w, wk in enumerate(result["weeks"]):
        for b in wk["badges"]:
            F[w, FAMILIES.index(b["family"])] = True
        for k, f in enumerate(FAMILIES):
            O[w, k] = wk["coverage"][f] == "observed"
    return F, O


def circular_null(result: dict, n_iter: int = 1000, seed: int = 0, min_families: int = 2) -> dict:
    """'서로 다른 계열 min_families 개 이상이 같은 주에 배지를 받는 주'가 우연히 몇 번 나오는지.

    계열마다 (배지, 관측) 시계열을 통째로 무작위 칸만큼 돌려 계열 안 자기상관은 두고 계열 사이 정렬만 깬다.
    """
    F, O = family_flags(result)
    W, K = F.shape
    obs = int((F.sum(1) >= min_families).sum())
    rng = np.random.default_rng(seed)
    null = np.empty(n_iter)
    for it in range(n_iter):
        G = np.empty_like(F)
        for k in range(K):
            G[:, k] = np.roll(F[:, k], int(rng.integers(0, W)))
        null[it] = (G.sum(1) >= min_families).sum()
    return {
        "observed": obs,
        "null_mean": round(float(null.mean()), 2),
        "null_p95": float(np.percentile(null, 95)),
        "ratio": round(float(obs / null.mean()), 3) if null.mean() > 0 else None,
        "p_value": round(float((null >= obs).mean()), 4),
        "n_iter": n_iter,
    }


def report(result: dict, n_iter: int = 1000) -> dict:
    ids, M = pr_matrix(result)
    C = spearman_pairwise(M)
    fam = {}
    for f in FAMILIES:
        idx = [k for k, i in enumerate(ids) if BY_ID[i].family == f and np.sum(~np.isnan(M[:, k])) >= 30]
        if len(idx) >= 2:
            fam[f] = {"indicators": [ids[k] for k in idx], **meff(C[np.ix_(idx, idx)])}
        elif len(idx) == 1:
            fam[f] = {"indicators": [ids[idx[0]]], "M": 1, "nyholt": 1.0, "li_ji": 1.0}
    live = [k for k in range(len(ids)) if np.sum(~np.isnan(M[:, k])) >= 30]
    return {
        "meff_all": meff(C[np.ix_(live, live)]),
        "meff_by_family": fam,
        "clusters": clusters(C[np.ix_(live, live)], [ids[k] for k in live]),
        "corr": {ids[a]: {ids[b]: (None if np.isnan(C[a, b]) else round(float(C[a, b]), 3)) for b in live} for a in live},
        "cross_null": circular_null(result, n_iter=n_iter),
    }
