"""Record assistant: a thin, provider-agnostic text layer over facts the app already computed.

Isolated on purpose (role A's addition). It imports nothing from services/ or domain/, holds no
state about the crew and never writes to the record. The web app sends compact structured facts
that our own logic produced; this route turns them into plain words. Rules:

- The API key stays on the station server. The browser never sees it.
- Decision support, not diagnosis: the model may only restate facts. It gets no say over a status.
- Red-flag symptoms and questions about medicines never reach the model. They get the rule-based
  "contact the flight surgeon" text below.
- Any provider error, timeout or guard hit returns source="unavailable". The web app then shows a
  canned answer built from the same facts, so the screen never depends on the network.
- Only the standard library is used for the HTTP call (no new dependency).

Config, from the environment or a git-ignored .env in the repo root (see .env.example):
AI_PROVIDER (gemini | deepseek | openai), AI_API_KEY, AI_MODEL, and optionally AI_BASE_URL,
AI_TIMEOUT_S, AI_REASONING_EFFORT, AI_CACHE_PATH.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field

router = APIRouter(prefix="/ai", tags=["ai"])

API_DIR = Path(__file__).resolve().parent.parent
# Repo root only. Never api/.env: the image copies api/ and would bake the key in.
ENV_FILES = (API_DIR.parent / ".env",)
PROMPT_VERSION = "v4"
DEFAULT_TIMEOUT_S = 4.0  # Demo parameter: the UI falls back to a canned answer after this.
MAX_CACHE_ENTRIES = 400

# OpenAI-compatible chat completions endpoints. "extra" is merged into the request body.
PROVIDERS: dict[str, dict[str, Any]] = {
    # https://ai.google.dev/gemini-api/docs/openai (checked 2026-11-15)
    "gemini": {
        "base": "https://generativelanguage.googleapis.com/v1beta/openai",
        "model": "gemini-3.5-flash-lite",
        "extra": {"reasoning_effort": "minimal"},
    },
    # https://api-docs.deepseek.com/guides/thinking_mode (checked 2026-11-15): thinking is on by
    # default and would not fit the timeout, so it is switched off.
    "deepseek": {
        "base": "https://api.deepseek.com",
        "model": "deepseek-flash",
        "extra": {"thinking": {"type": "disabled"}},
    },
    # Any other OpenAI-compatible server: set AI_BASE_URL and AI_MODEL.
    "openai": {"base": "https://api.openai.com/v1", "model": "", "extra": {}},
}

# Astronaut side only. Ground gets no assistant text, so nothing ground reads is hidden from the crew.
Feature = Literal["ask", "explain_alert", "draft_brief"]
Source = Literal["model", "cache", "rule", "unavailable"]


# ---------- Request and response shapes (bounded, so this is not an open proxy) ----------


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class MetricFacts(_Strict):
    key: str = Field(max_length=24)
    label: str = Field(max_length=40)
    unit: str = Field(max_length=16)
    status: str = Field(max_length=16)  # as the app computed it; the model cannot change it
    status_text: str = Field(max_length=120)
    usual: str | None = Field(default=None, max_length=40)
    values: dict[str, str] = Field(default_factory=dict, max_length=16)  # mission day -> value


class CheckinFacts(_Strict):
    day: int
    rested: str | None = Field(default=None, max_length=24)
    headache: str | None = Field(default=None, max_length=16)
    mood: str | None = Field(default=None, max_length=24)
    vision_change: str | None = Field(default=None, max_length=8)


class CabinFacts(_Strict):
    module: str = Field(max_length=40)
    unit: str = Field(max_length=8)
    usual: str = Field(max_length=40)
    daily_mean: dict[str, str] = Field(default_factory=dict, max_length=16)


class AlertFacts(_Strict):
    day: int
    severity: str = Field(max_length=8)
    state: str = Field(max_length=12)
    title: str = Field(max_length=200)
    what_changed: str = Field(max_length=400)
    next_step: str = Field(max_length=300)
    contact_if: str = Field(max_length=300)


class GroundFacts(_Strict):
    kind: str = Field(max_length=16)
    day: int
    author: str = Field(max_length=60)
    on: str | None = Field(default=None, max_length=40)
    text: str = Field(max_length=600)


class PinFacts(_Strict):
    label: str = Field(max_length=40)
    summary: str = Field(max_length=200)


class Facts(_Strict):
    mission_day: int
    perspective: Literal["astronaut"] = "astronaut"
    crew: str = Field(max_length=60)
    calibration_days: int | None = None
    readout: str | None = Field(default=None, max_length=300)
    tip: str | None = Field(default=None, max_length=300)
    metrics: list[MetricFacts] = Field(default_factory=list, max_length=8)
    checkins: list[CheckinFacts] = Field(default_factory=list, max_length=16)
    cabin: CabinFacts | None = None
    alert: AlertFacts | None = None
    ground: list[GroundFacts] = Field(default_factory=list, max_length=12)
    pinned: list[PinFacts] = Field(default_factory=list, max_length=6)


class AiRequest(_Strict):
    feature: Feature
    question: str | None = Field(default=None, max_length=400)
    facts: Facts


class Cite(BaseModel):
    metric: str
    day: int


class AiResponse(BaseModel):
    source: Source
    text: str = ""
    cites: list[Cite] = []
    reason: str | None = None  # why "unavailable" or which rule fired
    provider: str | None = None
    model: str | None = None


class AiStatus(BaseModel):
    configured: bool
    provider: str
    model: str
    timeout_s: float
    cached_answers: int


# ---------- Rules that run before and after the model ----------

# Demo parameter. The symptom list repeats our own "contact the flight surgeon if" copy
# (web/src/content/indicators.ts, regions.ts); it is not a clinical triage list.
RED_FLAG = re.compile(
    r"chest|breath|faint|passed out|black(ed)? out|dizz|light.?headed|heart attack|stroke|vomit"
    r"|vision (loss|change|blur)|blurr?(y|ed) vision|double vision|can['’]?t see|lost (my )?vision"
    r"|(severe|strong|worst|terrible|unbearable) head ?ache|racing heart|palpitation|\bpain\b"
    r"|confus(ed|ion)|\bnumb(ness)?\b|slurred|seizure|bleeding"
    r"|suicid|self.harm|hurt myself|kill myself|want to die|overdose",
    re.IGNORECASE,
)
MEDICINE = re.compile(
    r"\b(dose|dosage|mg(?!\s*/\s*dl)|pills?|medicine|medication|meds|drugs?|painkillers?|ibuprofen"
    r"|paracetamol|acetaminophen|aspirin|antibiotics?|sleeping pills?|melatonin|prescri\w*"
    r"|what (should|can|do) i take|treat(ment)? (it|this))\b",
    re.IGNORECASE,
)
# "Am I ill?" asks for an assessment. Only the flight surgeon gives one.
ASSESS = re.compile(
    r"\b(am i|is (it|this|that)|could (i|it) be|do i have|have i got|will i)\b[^?.!]*\b(sick|ill"
    r"|unwell|illness|disease|infect\w*|cancer|serious|dangerous|dying|die|ok|okay|healthy|fever"
    r"|flu|virus|covid)\b",
    re.IGNORECASE,
)
ASSESS_TEXT = (
    "The record cannot tell you whether you are ill, and neither can this assistant. It can show "
    "what changed in your record. For an assessment, send a consult brief: your flight surgeon "
    "sees your full record."
)
RED_FLAG_TEXT = (
    "This is on the list to raise with your flight surgeon now. Send a consult brief: the flight "
    "surgeon sees your full record. The record assistant does not assess symptoms like this."
)
MEDICINE_TEXT = (
    "The record assistant does not advise on medicines, doses or treatment. Ask your flight "
    "surgeon through a consult brief. They see your full record."
)
ACT_ALERT_TEXT = (
    "The app marked this as one to raise with your flight surgeon now. Follow the next step on "
    "the alert and send a consult brief. The record assistant does not explain alerts at this "
    "level."
)

# The model's text is dropped if it reads like a dose, a medicine or a diagnosis. Blood sugar
# in mg/dL and the phrase "not a diagnosis" are fine: both appear in the app's own copy.
OUTPUT_GUARD = re.compile(
    r"\b\d+(\.\d+)?\s?(mg|mcg|µg|ml|iu)\b(?!\s*/\s*dl)|\b(tablets?|pills?|capsules?|ibuprofen"
    r"|paracetamol|acetaminophen|aspirin|antibiotics?|melatonin|prescri\w*)\b"
    r"|\bdiagnosed\b|\b(my|the|a likely|a possible|probable) diagnosis\b|\bdiagnosis (is|of)\b"
    r"|\byou (may |might |probably |likely |could )?(have|are suffering from) (a |an |the )?"
    r"(migraine|infection|fever|hypertension|hypotension|diabet\w*|an[a]?emia|depression|insomnia"
    r"|sans|hypercapnia|arrhythmia|dehydration|concussion|virus|flu|covid)\b"
    # A cause or a reassurance is an assessment, which the assistant must not make.
    r"|\bcaused by\b|\bdue to\b|nothing to worry about|no need to worry"
    r"|\byou (do not|don['’]?t) have\b|\byou are (fine|healthy|ok|okay)\b",
    re.IGNORECASE,
)


def rule_answer(req: AiRequest) -> AiResponse | None:
    """Rule-based text for anything the model must not handle. None means the model may answer."""
    asked = req.question or ""
    if RED_FLAG.search(asked):
        return AiResponse(source="rule", text=RED_FLAG_TEXT, reason="red_flag")
    if req.feature == "ask" and MEDICINE.search(asked):
        return AiResponse(source="rule", text=MEDICINE_TEXT, reason="medicine")
    if req.feature == "ask" and ASSESS.search(asked):
        return AiResponse(source="rule", text=ASSESS_TEXT, reason="assessment")
    # While an "act now" alert is open the assistant steps back on everything about the record.
    alert = req.facts.alert
    if alert and alert.severity == "act" and alert.state != "closed":
        return AiResponse(source="rule", text=ACT_ALERT_TEXT, reason="act_alert")
    return None


# ---------- Prompts ----------

SYSTEM = """You are the record assistant inside a crew health app on a simulated space mission.
You put the crew member's own record into plain words, the way a careful colleague would.
Mandatory rules:
1. Use ONLY the FACTS JSON. If something is not in the facts, say "That is not in your record."
   Never add causes, conditions, numbers or advice from outside the facts.
2. Never diagnose. Never name a disease or condition as the cause. Never mention medicines,
   doses or treatment. Never say that something is fine, safe or dangerous. Use wording like
   "worth checking", "compared with your usual", "a pattern to check, not a cause".
3. Each metric has a "status" label and a "status_text" that the app computed. Use the
   status_text as an ordinary phrase ("Your sleep is below your usual for 4 nights"). Do not
   write the word "status". Never state a different status.
4. Quote days and values exactly as written in the facts, for example "day 12" and "5.5 h".
   Do not calculate new numbers: no averages, no differences, no percentages.
5. Shape of the answer: first one sentence that answers the question. Then the evidence, with
   the days AND their values written out: only the ones that matter, at most four, set against
   the usual range. Do not list every day. If the facts hold a related pattern (an alert, cabin CO2, a note from ground),
   add it in one sentence. Never state the same fact twice. For headaches, name only the days
   that have one. Say "compared with your usual" only for a value that has a usual range.
6. Plain words and short sentences, written to "you". No lists, no markdown, no greeting.
7. Answer in English.
Reply with one JSON object and nothing else:
{"answer": "<text>", "cites": [{"metric": "<a metric key from the facts, or co2, or headache>",
"day": <mission day number>}]}
Cite only day values that you named in the answer, at most 6."""

TASKS: dict[str, str] = {
    "ask": "Task: answer the crew member's QUESTION about their own record in at most 90 words.",
    "explain_alert": (
        "Task: explain in at most 70 words which readings the alert in facts.alert rests on. "
        'Start with "The app raised this from your record:". Give the headache days with their '
        "strength, then the cabin CO2 values on those days against the module's usual range. "
        "Add at most one more value, and only if the alert text itself mentions that metric. "
        "No notes from ground. Do not explain it with a cause. Finish with "
        '"Next step from the app:" and the app\'s next step, word for word.'
    ),
    "draft_brief": (
        "Task: write the text of a question from the crew member to the flight surgeon. Output "
        "only the question text: no preamble, no greeting, no sign-off. First person (I, my "
        "module, my usual). At most 60 words. State the days and values of the pinned items, "
        "then ask one clear question about what to watch or change. The crew member will edit "
        "it before sending."
    ),
}


def build_messages(req: AiRequest) -> list[dict[str, str]]:
    parts = [TASKS[req.feature]]
    if req.question:
        parts.append(f"QUESTION: {req.question.strip()}")
    facts = req.facts.model_dump(exclude_none=True)
    parts.append(f"FACTS: {json.dumps(facts, ensure_ascii=False, separators=(',', ':'))}")
    return [{"role": "system", "content": SYSTEM}, {"role": "user", "content": "\n".join(parts)}]


# ---------- Config ----------


def _dotenv() -> dict[str, str]:
    out: dict[str, str] = {}
    for path in ENV_FILES:
        try:
            lines = path.read_text().splitlines()
        except OSError:
            continue
        for line in lines:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.removeprefix("export ").strip()
            if key.startswith("AI_") and key not in out:
                out[key] = value.strip().strip("\"'")
    return out


def config() -> dict[str, Any]:
    """Read on every call, so a key added to .env works without a restart."""
    env = {**_dotenv(), **{k: v for k, v in os.environ.items() if k.startswith("AI_")}}
    provider = env.get("AI_PROVIDER", "gemini").strip().lower() or "gemini"
    preset = PROVIDERS.get(provider, PROVIDERS["openai"])
    extra = dict(preset["extra"])
    if "AI_REASONING_EFFORT" in env:
        extra.pop("reasoning_effort", None)
        if env["AI_REASONING_EFFORT"].strip():
            extra["reasoning_effort"] = env["AI_REASONING_EFFORT"].strip()
    try:
        timeout = float(env.get("AI_TIMEOUT_S", "") or DEFAULT_TIMEOUT_S)
    except ValueError:
        timeout = DEFAULT_TIMEOUT_S
    return {
        "provider": provider,
        "key": env.get("AI_API_KEY", "").strip(),
        "model": env.get("AI_MODEL", "").strip() or preset["model"],
        "base": (env.get("AI_BASE_URL", "").strip() or preset["base"]).rstrip("/"),
        "extra": extra,
        "timeout": max(1.0, min(timeout, 20.0)),
        "cache_path": Path(env.get("AI_CACHE_PATH", "").strip() or API_DIR / ".ai_cache.json"),
    }


# ---------- Cache (memory plus a small JSON file, so a rehearsed demo replays offline) ----------

_lock = threading.Lock()
_cache: dict[str, dict[str, Any]] = {}
_cache_loaded_from: Path | None = None


def cache_key(req: AiRequest) -> str:
    body = {
        "v": PROMPT_VERSION,
        "feature": req.feature,
        "question": " ".join((req.question or "").lower().split()),
        "facts": req.facts.model_dump(exclude_none=True),
    }
    return hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()


def _load_cache(path: Path) -> None:
    global _cache_loaded_from
    if _cache_loaded_from == path:
        return
    _cache_loaded_from = path
    try:
        doc = json.loads(path.read_text())
        if isinstance(doc, dict):
            _cache.update({k: v for k, v in doc.items() if isinstance(v, dict)})
    except (OSError, ValueError):
        pass


def cache_get(path: Path, key: str) -> dict[str, Any] | None:
    with _lock:
        _load_cache(path)
        return _cache.get(key)


def cache_put(path: Path, key: str, value: dict[str, Any]) -> None:
    with _lock:
        _load_cache(path)
        _cache[key] = value
        while len(_cache) > MAX_CACHE_ENTRIES:
            _cache.pop(next(iter(_cache)))
        try:
            tmp = path.with_suffix(".tmp")
            tmp.write_text(json.dumps(_cache, indent=1, sort_keys=True))
            tmp.replace(path)
        except OSError:
            pass  # read-only disk: the memory cache still works


# ---------- Provider call ----------

_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="ai")


class ProviderError(Exception):
    pass


def _post_once(url: str, key: str, payload: dict[str, Any], deadline: float) -> dict[str, Any]:
    data = json.dumps(payload).encode()
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {key}"}
    request = urllib.request.Request(url, data=data, headers=headers, method="POST")
    left = deadline - time.monotonic()
    if left <= 0:
        raise ProviderError("timeout")
    try:
        with urllib.request.urlopen(request, timeout=left) as resp:
            chunks: list[bytes] = []
            # Some providers send keep-alive blank lines while they work, so the socket timeout
            # alone would never fire. Check the deadline between chunks.
            while True:
                if time.monotonic() > deadline:
                    raise ProviderError("timeout")
                chunk = resp.read1(65536)
                if not chunk:
                    break
                chunks.append(chunk)
    except urllib.error.HTTPError as err:
        raise ProviderError(f"http_{err.code}") from err
    except TimeoutError as err:
        raise ProviderError("timeout") from err
    except (urllib.error.URLError, OSError) as err:
        timed_out = isinstance(getattr(err, "reason", None), TimeoutError)
        raise ProviderError("timeout" if timed_out else "network") from err
    try:
        return json.loads(b"".join(chunks).decode("utf-8", "replace").strip())
    except ValueError as err:
        raise ProviderError("bad_json") from err


def call_provider(cfg: dict[str, Any], messages: list[dict[str, str]], deadline: float) -> str:
    """One chat completion. Returns the assistant text or raises ProviderError."""
    url = f"{cfg['base']}/chat/completions"
    payload: dict[str, Any] = {
        "model": cfg["model"],
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 700,
        **cfg["extra"],
    }
    try:
        doc = _post_once(url, cfg["key"], payload, deadline)
    except ProviderError as err:
        # A provider that rejects the optional extras still gets one plain attempt.
        if str(err) != "http_400" or not cfg["extra"]:
            raise
        plain = {k: v for k, v in payload.items() if k not in cfg["extra"]}
        doc = _post_once(url, cfg["key"], plain, deadline)
    try:
        text = doc["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as err:
        raise ProviderError("bad_shape") from err
    if not isinstance(text, str) or not text.strip():
        raise ProviderError("empty")
    return text


def parse_answer(raw: str, facts: Facts) -> tuple[str, list[Cite]]:
    """The model is asked for JSON. Accept fenced or bare JSON, or fall back to plain text."""
    text = raw.strip()
    start, end = text.find("{"), text.rfind("}")
    answer, cites = text, []
    if start != -1 and end > start:
        try:
            doc = json.loads(text[start : end + 1])
            if isinstance(doc, dict) and isinstance(doc.get("answer"), str):
                answer = doc["answer"]
                cites = doc.get("cites") if isinstance(doc.get("cites"), list) else []
        except ValueError:
            pass
    # Keep only cites that point at a value the facts really hold.
    known: dict[str, set[str]] = {m.key: set(m.values) for m in facts.metrics}
    if facts.cabin:
        known["co2"] = set(facts.cabin.daily_mean)
    known["headache"] = {str(c.day) for c in facts.checkins if c.headache}
    out: list[Cite] = []
    for c in cites[:8]:
        if not isinstance(c, dict):
            continue
        metric, day = str(c.get("metric", "")), c.get("day")
        if isinstance(day, int | float) and str(int(day)) in known.get(metric, set()):
            cite = Cite(metric=metric, day=int(day))
            if cite not in out:
                out.append(cite)
    return " ".join(answer.split()), out[:6]


# ---------- Routes ----------


@router.get("/status", response_model=AiStatus)
def ai_status() -> AiStatus:
    """Whether a provider key is set. Never returns the key."""
    cfg = config()
    with _lock:
        _load_cache(cfg["cache_path"])
        cached = len(_cache)
    return AiStatus(
        configured=bool(cfg["key"] and cfg["model"]),
        provider=cfg["provider"],
        model=cfg["model"],
        timeout_s=cfg["timeout"],
        cached_answers=cached,
    )


@router.post("/complete", response_model=AiResponse)
def ai_complete(req: AiRequest) -> AiResponse:
    """Plain-words text from facts. Always 200: the web app handles source="unavailable"."""
    ruled = rule_answer(req)
    if ruled:
        return ruled

    cfg = config()
    key = cache_key(req)
    hit = cache_get(cfg["cache_path"], key)
    if hit:
        return AiResponse(
            source="cache",
            text=hit.get("text", ""),
            cites=[Cite(**c) for c in hit.get("cites", [])],
            provider=hit.get("provider"),
            model=hit.get("model"),
        )
    if not cfg["key"] or not cfg["model"]:
        return AiResponse(source="unavailable", reason="no_key")

    deadline = time.monotonic() + cfg["timeout"]
    future = _pool.submit(call_provider, cfg, build_messages(req), deadline)
    try:
        raw = future.result(timeout=cfg["timeout"] + 0.25)
    except FutureTimeout:
        return AiResponse(source="unavailable", reason="timeout")
    except ProviderError as err:
        return AiResponse(source="unavailable", reason=str(err))

    text, cites = parse_answer(raw, req.facts)
    if not text or OUTPUT_GUARD.search(text):
        return AiResponse(source="unavailable", reason="guard")
    text = text[:900]
    cache_put(
        cfg["cache_path"],
        key,
        {
            "text": text,
            "cites": [c.model_dump() for c in cites],
            "provider": cfg["provider"],
            "model": cfg["model"],
        },
    )
    return AiResponse(
        source="model", text=text, cites=cites, provider=cfg["provider"], model=cfg["model"]
    )
