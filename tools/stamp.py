#!/usr/bin/env python3
"""Write version.json: content-hashed URLs for every script, so browsers never run stale code.

GitHub Pages caches files for 10 minutes. index.html fetches version.json uncached on every load
and builds the import map from it, so a changed file always gets a new URL. Run before committing:
    python3 tools/stamp.py
"""
import hashlib, json, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
def v(rel):
    return f"./{rel}?v={hashlib.sha1((root / rel).read_bytes()).hexdigest()[:10]}"

imports = {"three": v("vendor/three.module.min.js")}
for f in sorted((root / "src").glob("*.js")):
    rel = f"src/{f.name}"
    imports[f"./{rel}"] = v(rel)
out = {"main": imports["./src/main.js"], "imports": imports}
(root / "version.json").write_text(json.dumps(out, indent=2) + "\n")
print(f"stamped {len(imports)} files -> version.json")
