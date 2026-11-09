#!/bin/bash
# 사용: render.sh 원본.pptx 이미지폴더 출력폴더  → 출력폴더/slide-NN.png (3840x2160)
set -e
L=$(cd "$(dirname "$0")" && pwd); SRC="$1"; IMG="$2"; OUT="$3"; T=$(mktemp -d)
python3 "$L/fill.py" "$SRC" "$IMG" "$T/filled.pptx"
soffice --headless --convert-to odp --outdir "$T" "$T/filled.pptx" >/dev/null 2>&1
mkdir "$T/x"; (cd "$T/x" && unzip -q ../filled.odp && python3 - <<'PY'
import re
for f in ('content.xml','styles.xml'):
    s=open(f).read(); s=re.sub(r'style:text-autospace="[^"]*"','',s)
    s=re.sub(r'<style:paragraph-properties(?=[\s/>])','<style:paragraph-properties style:text-autospace="none"',s); open(f,'w').write(s)
PY
zip -q -X -0 ../fixed.odp mimetype && zip -q -X -r ../fixed.odp . -x mimetype)
soffice --headless --convert-to pdf --outdir "$T" "$T/fixed.odp" >/dev/null 2>&1
mkdir -p "$OUT"; pdftoppm -scale-to-x 3840 -scale-to-y 2160 -png "$T/fixed.pdf" "$OUT/slide"
cp "$T/filled.pptx" "$OUT/"; ls "$OUT" | head -30
