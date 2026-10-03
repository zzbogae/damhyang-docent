# -*- coding: utf-8 -*-
"""웹 "샘플로 시작" 번들을 만든다: synth/out/<persona>/exports → web/public/sample/.

사진 폴더와 삼성 헬스 폴더는 파일 수를 줄이려고 zip 하나씩으로 묶는다(가져오기는 zip 안 사진도 읽는다).
실행: core/.venv/bin/python synth/build_sample.py [short]
"""
from __future__ import annotations

import json
import shutil
import sys
import urllib.parse
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DEST = ROOT / "web" / "public" / "sample"
LIMIT = 5 * 1024 * 1024

MIME = {".zip": "application/zip", ".txt": "text/plain", ".csv": "text/csv"}


def zip_dir(src: Path, dest: Path, arc_root: str):
    with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(src.rglob("*")):
            if f.is_file():
                z.write(f, f"{arc_root}/{f.relative_to(src).as_posix()}")


def main():
    persona = sys.argv[1] if len(sys.argv) > 1 else "short"
    exp = HERE / "out" / persona / "exports"
    if not exp.exists():
        sys.exit(f"먼저 synth/make_persona.py {persona} 를 실행하세요")
    if DEST.exists():
        shutil.rmtree(DEST)
    DEST.mkdir(parents=True)
    files = []

    def add(p: Path, path: str):
        files.append(dict(url=urllib.parse.quote(p.name), name=p.name, path=path,
                          type=MIME.get(p.suffix.lower(), "application/octet-stream"), size=p.stat().st_size))

    for f in sorted(exp.iterdir()):
        if f.is_file() and f.suffix == ".zip":
            shutil.copy(f, DEST / f.name)
            add(DEST / f.name, f.name)
        elif f.is_dir() and f.name.startswith("samsunghealth_"):
            z = DEST / "samsunghealth.zip"
            zip_dir(f, z, f.name)
            add(z, z.name)
        elif f.is_dir() and f.name == "photos":
            z = DEST / "photos.zip"
            zip_dir(f, z, "photos")
            add(z, z.name)
        elif f.is_dir() and f.name == "kakao":
            for t in sorted(f.iterdir()):
                shutil.copy(t, DEST / t.name)
                add(DEST / t.name, f"kakao/{t.name}")
    manifest = dict(persona=persona,
                    notice="공유용 합성 데이터입니다. 가상 인물의 기록이며 실제 개인 기록이 아닙니다.",
                    files=files)
    (DEST / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    total = sum(f["size"] for f in files)
    print(f"sample: {len(files)} files, {total / 1e6:.2f}MB")
    if total > LIMIT:
        sys.exit("샘플 번들이 5MB 를 넘습니다")


if __name__ == "__main__":
    main()
