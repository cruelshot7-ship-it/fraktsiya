#!/bin/bash
set -euo pipefail
python3 - <<'PY'
from pathlib import Path
import base64
sync = base64.b64decode(Path("scripts/ci/sync.b64").read_text())
Path("src/lib/studio-sync.ts").write_bytes(sync)
store = base64.b64decode(Path("scripts/ci/store.b64.part0").read_text() + Path("scripts/ci/store.b64.part1").read_text())
Path("src/lib/studio-store.ts").write_bytes(store)
print("wrote", len(sync), len(store))
PY
python3 - <<'PY'
from pathlib import Path
p = Path("package.json")
t = p.read_text()
if "studio-merge.test.ts" not in t:
    t = t.replace("src/lib/studio-scope.test.ts", "src/lib/studio-merge.test.ts src/lib/studio-scope.test.ts", 1)
    p.write_text(t)
print("package ok")
PY
