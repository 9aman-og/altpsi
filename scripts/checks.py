#!/usr/bin/env python3
"""Fail closed when the AltPsi public/product boundary is broken."""

from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROBLEMS: list[str] = []
SKIP_DIRS = {".git", "__pycache__", ".pytest_cache", "node_modules", ".temp"}
TEXT_EXTENSIONS = {
    "", ".css", ".html", ".ini", ".js", ".json", ".md", ".mjs",
    ".py", ".sql", ".svg", ".toml", ".ts", ".txt", ".webmanifest",
    ".yaml", ".yml",
}


def text_files():
    for path in ROOT.rglob("*"):
        if path.is_dir() or any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.suffix.lower() not in TEXT_EXTENSIONS:
            continue
        try:
            yield path, path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue


def check_product_boundary() -> None:
    forbidden_paths = ("papers", "research.html", "papers.html", "app/sol")
    for relative in forbidden_paths:
        if (ROOT / relative).exists():
            PROBLEMS.append(f"boundary: legacy research path is present: {relative}")

    confidential_terms = re.compile(r"confidential[\s_-]+iisc|iisc[\s_-]+confidential", re.I)
    for path, content in text_files():
        if confidential_terms.search(content):
            PROBLEMS.append(f"boundary: possible confidential-lineage reference in {path.relative_to(ROOT)}")


def check_secrets() -> None:
    patterns = {
        "Groq secret": re.compile(r"\bgsk_[A-Za-z0-9_-]{20,}\b"),
        "OpenAI secret": re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b"),
        "Google API key": re.compile(r"\bAIza[0-9A-Za-z_-]{30,}\b"),
        "private key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
        "JWT-shaped secret": re.compile(r"\beyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b"),
    }
    allow_examples = {"gsk_replace_me"}
    for path, content in text_files():
        scrubbed = content
        for example in allow_examples:
            scrubbed = scrubbed.replace(example, "")
        for label, pattern in patterns.items():
            if pattern.search(scrubbed):
                PROBLEMS.append(f"secret: possible {label} in {path.relative_to(ROOT)}")

    for path in ROOT.rglob("*"):
        if not path.is_file() or any(part in SKIP_DIRS for part in path.parts):
            continue
        lower = path.name.lower()
        if lower == ".env.example":
            continue
        if lower == ".env" or lower.startswith(".env.") or "credentials" in lower:
            PROBLEMS.append(f"secret: credential-like file is present: {path.relative_to(ROOT)}")


LINK_RE = re.compile(r"""(?:href|src)=["']([^"']+)["']""")


def check_links() -> None:
    pages = [
        ROOT / "index.html",
        ROOT / "aero" / "index.html",
        ROOT / "demo" / "index.html",
        ROOT / "app" / "index.html",
        ROOT / "app" / "connect.html",
    ]
    for page in pages:
        if not page.is_file():
            PROBLEMS.append(f"link: required page is missing: {page.relative_to(ROOT)}")
            continue
        html = page.read_text(encoding="utf-8")
        for url in LINK_RE.findall(html):
            if url.startswith(("http://", "https://", "mailto:", "data:", "#", "tel:")):
                continue
            if page == ROOT / "index.html" and url.startswith("../aero/"):
                # Aero is intentionally published as a sibling mount to /altpsi.
                continue
            target = url.split("#", 1)[0].split("?", 1)[0]
            if not target:
                continue
            path = page.parent / target
            if target.endswith("/"):
                path = path / "index.html"
            if not path.resolve().exists():
                PROBLEMS.append(f"link: {page.relative_to(ROOT)} references missing {url}")


def check_brand() -> None:
    for relative in ("assets/altpsi_logo.svg", "assets/aero_logo.svg", "assets/connect_logo.svg"):
        path = ROOT / relative
        if not path.is_file():
            PROBLEMS.append(f"brand: {relative} is missing")
            continue
        svg = path.read_text(encoding="utf-8")
        if 'viewBox="0 0 512 512"' not in svg or "<title" not in svg or "<desc" not in svg:
            PROBLEMS.append(f"brand: {relative} is not an accessible scalable mark")

    expected_pngs = {
        "assets/altpsi_logo.png": (1024, 1024),
        "assets/aero_logo.png": (1024, 1024),
        "assets/connect_logo.png": (1024, 1024),
        "assets/og-altpsi.png": (1200, 630),
        "assets/og-aero.png": (1200, 630),
    }
    for relative, expected_size in expected_pngs.items():
        path = ROOT / relative
        try:
            payload = path.read_bytes()
        except OSError:
            PROBLEMS.append(f"brand: {relative} is missing")
            continue
        if payload[:8] != b"\x89PNG\r\n\x1a\n" or len(payload) < 24:
            PROBLEMS.append(f"brand: {relative} is not a valid PNG")
            continue
        dimensions = (int.from_bytes(payload[16:20], "big"), int.from_bytes(payload[20:24], "big"))
        if dimensions != expected_size:
            PROBLEMS.append(f"brand: {relative} is {dimensions}, expected {expected_size}")

    manifest = ROOT / "site.webmanifest"
    try:
        payload = json.loads(manifest.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        PROBLEMS.append(f"brand: invalid site.webmanifest ({error})")
    else:
        if payload.get("name") != "AltPsi" or payload.get("start_url") != "./":
            PROBLEMS.append("brand: manifest must remain path-independent and AltPsi-owned")


def check_indexing() -> None:
    try:
        tree = ET.parse(ROOT / "sitemap.xml")
    except (OSError, ET.ParseError) as error:
        PROBLEMS.append(f"indexing: invalid sitemap ({error})")
        return
    namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    locations = {node.text or "" for node in tree.findall(".//s:loc", namespace)}
    expected = {
        "https://sonnesystems.com/altpsi/",
        "https://sonnesystems.com/aero/",
        "https://sonnesystems.com/altpsi/demo/",
        "https://sonnesystems.com/altpsi/app/",
    }
    if locations != expected:
        PROBLEMS.append("indexing: temporary sitemap does not match the two isolated product mounts")


def check_aero_product_surface() -> None:
    page = (ROOT / "aero" / "index.html").read_text(encoding="utf-8")
    script = (ROOT / "aero" / "site.js").read_text(encoding="utf-8")
    required_page_markers = {
        "model routing": "data-model-button",
        "change review": "data-review",
        "private composer": "data-preview-form",
        "typed memory": "Typed memory",
        "visible authority": "Visible authority",
        "communication-compression gate": "Say less over time",
    }
    for label, marker in required_page_markers.items():
        if marker not in page:
            PROBLEMS.append(f"product: Aero page is missing {label}")
    for label, marker in {
        "mode switching": "selectMode",
        "review disclosure": "aria-expanded",
        "local preview privacy": "does not send your text anywhere",
        "reduced motion": "prefers-reduced-motion",
    }.items():
        if marker not in script:
            PROBLEMS.append(f"product: Aero preview is missing {label}")


def main() -> int:
    check_product_boundary()
    check_secrets()
    check_links()
    check_brand()
    check_indexing()
    check_aero_product_surface()
    if PROBLEMS:
        print(f"FAIL: {len(PROBLEMS)} problem(s)")
        for problem in PROBLEMS:
            print(f"  - {problem}")
        return 1
    print("OK: AltPsi boundary, secrets, links, brand, and temporary path are valid")
    return 0


if __name__ == "__main__":
    sys.exit(main())
