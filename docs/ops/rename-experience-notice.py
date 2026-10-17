"""Only rename the deployed login notice; run with sudo Python on the VPS."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import shutil
import json

base = Path('/opt/human-archive/life-archive/deploy/portable')
p = base / 'acme/review-access.js'
raw = p.read_bytes()
if hashlib.sha256(raw).hexdigest() != '56962ae351e3f2c9c3978dcb60a1c20bd34f6a3c98166160050ad7a67d2b95c6':
    raise SystemExit('Source changed; no changes made. Inspect the current script first.')
text = raw.decode('utf-8')
assert text.count('评委体验账号') == 3, 'Unexpected source; no changes made'
backup = base / 'state' / ('experience-label-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
backup.mkdir(parents=True, mode=0o700)
shutil.copy2(p, backup / p.name)
# Preserve the bind-mounted inode. No nginx reload, container restart or database write.
try:
    p.write_text(text.replace('评委体验账号', '体验账号'), encoding='utf-8')
    assert '评委体验账号' not in p.read_text()
except BaseException:
    p.write_bytes(raw)
    raise
print(json.dumps({'result':'notice_title_updated','backup':str(backup/p.name)},ensure_ascii=False))
