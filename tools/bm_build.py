"""Shared, standard-library-only helpers for the static site builders."""

import html
import json
import os
import re
import stat
import tempfile
import urllib.request
import xml.etree.ElementTree as ET
from contextlib import contextmanager
from contextvars import ContextVar
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
API_BASE = "https://cms.contentsx.jp/wp-json/contentsx/v1"
SITE_URL = "https://bizmanga.contentsx.jp"
_pending = ContextVar("build_outputs", default=None)


def escape_html(value):
    """Escape text/attributes, treating None as an empty string."""
    return html.escape(str(value if value is not None else ""), quote=True)


def fetch_json(url, timeout=30, user_agent="BizManga-Builder/1.0"):
    request = urllib.request.Request(url, headers={"User-Agent": user_agent})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def require_records(value, *, label="API response", key="id", allow_empty=False):
    """Reject partial/invalid identities before any output or stale-file removal."""
    if not isinstance(value, list) or (not value and not allow_empty):
        raise ValueError(f"{label}: expected a {'non-empty ' if not allow_empty else ''}list")
    seen = set()
    for item in value:
        if not isinstance(item, dict) or item.get(key) in (None, ""):
            raise ValueError(f"{label}: missing {key}")
        identity = str(item[key])
        if identity in seen:
            raise ValueError(f"{label}: duplicate {key}: {identity}")
        seen.add(identity)
    return value


def safe_slug(value):
    """A single URL/file component, never a path or a Windows device name."""
    value = str(value)
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", value):
        raise ValueError(f"Invalid slug: {value!r}")
    if re.fullmatch(r"(?:con|prn|aux|nul|com[1-9]|lpt[1-9])", value, re.I):
        raise ValueError(f"Reserved slug: {value!r}")
    return value


def script_json(value, **kwargs):
    """JSON for an HTML script element (including JSON-LD)."""
    return json.dumps(value, ensure_ascii=False, **kwargs).replace("<", "\\u003c")


def replace_block(source, start, end, block, *, required=False):
    """Replace one literal marker pair without interpreting backslashes in data."""
    pattern = re.compile(re.escape(start) + r"[\s\S]*?" + re.escape(end))
    matches = list(pattern.finditer(source))
    if len(matches) > 1 or source.count(start) > 1:
        raise ValueError(f"Duplicate build marker: {start}")
    if not matches:
        if required or start in source:
            raise ValueError(f"Missing or incomplete build marker: {start}")
        return source, False
    return pattern.sub(lambda _match: block, source, count=1), True


def render_template(template, *, text=None, html=None):
    """Render {{name}} placeholders.

    text: plain values. Escaped here for HTML, and with JSON's string rules inside
          JSON / JSON-LD script elements.
    html: trusted, already escaped HTML fragments, or a whole JSON document when the
          placeholder is the entire content of a JSON script element.
    Every placeholder must be supplied and every supplied value must be used.
    Substitutions are simultaneous, so user content containing {{...}} stays data.
    """
    token = re.compile(r"\{\{[a-zA-Z0-9_]+\}\}")
    text = {"{{" + key + "}}": value for key, value in (text or {}).items()}
    html = {"{{" + key + "}}": value for key, value in (html or {}).items()}
    if text.keys() & html.keys():
        raise ValueError(
            f"Placeholder given as both text and html: {sorted(text.keys() & html.keys())}"
        )
    unused = (text.keys() | html.keys()) - set(token.findall(template))
    if unused:
        raise ValueError(f"Unused template values: {sorted(unused)}")
    markup = {key: escape_html(value) for key, value in text.items()} | html

    def substitute(source, values):
        def value(match):
            if match[0] not in values:
                raise ValueError(f"Unknown template placeholder: {match[0]}")
            return values[match[0]]

        return token.sub(value, source)

    def json_string(match):
        if match[0] in html:
            raise ValueError(f"HTML value used inside a JSON string: {match[0]}")
        if match[0] not in text:
            raise ValueError(f"Unknown template placeholder: {match[0]}")
        value = text[match[0]]
        return script_json(str(value if value is not None else ""))[1:-1]

    def json_block(match):
        raw = match[2]
        # Whole JSON documents, e.g. {{faq_jsonld}}, are already serialized.
        if raw.strip() in html:
            rendered = html[raw.strip()]
        else:
            rendered = token.sub(json_string, raw)
        json.loads(rendered)
        return match[1] + rendered + match[3]

    pattern = re.compile(
        r'(<script\b[^>]*\btype="application/(?:ld\+)?json"[^>]*>)(.*?)(</script>)',
        re.S | re.I,
    )
    # Render the non-JSON segments separately so substituted content is never
    # parsed again as a template (or as a script element).
    parts, offset = [], 0
    for match in pattern.finditer(template):
        parts.append(substitute(template[offset : match.start()], markup))
        parts.append(json_block(match))
        offset = match.end()
    parts.append(substitute(template[offset:], markup))
    return "".join(parts)


def replace_grid(source, name, cards):
    """Fill the required <!-- BUILD:{name} --> ... <!-- /BUILD:{name} --> block."""
    start, end = f"<!-- BUILD:{name} -->", f"<!-- /BUILD:{name} -->"
    return replace_block(source, start, end, f"{start}\n{cards}      {end}", required=True)[0]


def replace_json_script(source, open_tag, value):
    """Replace a required JSON / JSON-LD script element, identified by its full open tag."""
    block = f"{open_tag}\n{script_json(value, indent=2)}\n</script>"
    return replace_block(source, open_tag, "</script>", block, required=True)[0]


def prune_stale(directory, keep):
    """Remove *.html in directory whose stem is not in keep (inside output_batch)."""
    removed = 0
    for existing in Path(directory).glob("*.html"):
        if existing.stem not in keep:
            remove_file(existing)
            removed += 1
    return removed


def _atomic_bytes(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".bm-build-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as output:
            output.write(data)
        os.chmod(temporary, stat.S_IMODE(path.stat().st_mode) if path.exists() else 0o644)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def write_text(path, content):
    if Path(path).suffix == ".xml":
        ET.fromstring(content)
    write_bytes(path, content.encode("utf-8"))


def write_bytes(path, data):
    path = Path(path).resolve()
    pending = _pending.get()
    if pending is not None:
        root, changes = pending
        if not path.is_relative_to(root):
            raise ValueError(f"Output escapes build root: {path}")
        changes[path] = data
    elif not path.exists() or path.read_bytes() != data:
        _atomic_bytes(path, data)


def remove_file(path):
    path = Path(path).resolve()
    pending = _pending.get()
    if pending is None:
        raise RuntimeError("Stale files must be removed inside output_batch")
    root, changes = pending
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError(f"Invalid stale output: {path}")
    changes[path] = None


@contextmanager
def output_batch(root=ROOT):
    """Publish completed renders; attempt every rollback and report all failures."""
    if _pending.get() is not None:
        raise RuntimeError("Nested build batches are not supported")
    changes = {}
    token = _pending.set((Path(root).resolve(), changes))
    try:
        yield
        originals = {path: path.read_bytes() if path.exists() else None for path in changes}
        applied = []
        try:
            # Publish generated files before removing obsolete ones.
            for path, data in sorted(changes.items(), key=lambda item: item[1] is None):
                if originals[path] == data:
                    continue
                if data is None:
                    path.unlink()
                else:
                    _atomic_bytes(path, data)
                applied.append(path)
        except BaseException as commit_error:
            rollback_errors = []
            for path in reversed(applied):
                try:
                    if originals[path] is None:
                        path.unlink(missing_ok=True)
                    else:
                        _atomic_bytes(path, originals[path])
                except BaseException as rollback_error:
                    rollback_error.add_note(f"Could not restore output: {path}")
                    rollback_errors.append(rollback_error)
            if rollback_errors:
                raise BaseExceptionGroup(
                    "Build commit failed and rollback was incomplete",
                    [commit_error, *rollback_errors],
                ) from None
            raise
    finally:
        _pending.reset(token)
