# backend/services/whisper_loader.py
"""
One shared Faster-Whisper model for the whole process.

Before: 4 files each built their own WhisperModel (different sizes / precisions,
up to 4 copies in RAM, settings ignored WHISPER_MODEL in asr_service.py).
Now: every caller uses transcribe_audio(...). Change behaviour in ONE place.

Env (all optional):
  WHISPER_MODEL     default "small"
  WHISPER_COMPUTE   default "int8"   (int8 ~ half the RAM of float32, same accuracy in practice)
  WHISPER_LANGUAGE  default "en"     ("" = auto-detect; auto-detect often mislabels Indian-accented English)
  WHISPER_THREADS   default 0        (0 = let CTranslate2 decide)
  WHISPER_PROMPT    overrides the technical-terms prompt below
"""
from __future__ import annotations

import logging
import os
import threading

from faster_whisper import WhisperModel

log = logging.getLogger(__name__)

_MODEL: WhisperModel | None = None
_LOCK = threading.Lock()

# Biases the decoder toward interview vocabulary ("triple equals", not "criple equal").
# Keep it short and natural. A long prompt can get echoed back on silence.
DEFAULT_PROMPT = (
    "Technical interview. Terms: triple equals, double equals, null, undefined, "
    "HashMap, array, linked list, binary search tree, stack, queue, recursion, "
    "time complexity, Big O of n, API, REST, SQL, JOIN, index, React, Node.js, "
    "Python, Java, C++, Docker, Kubernetes, microservices, async await, "
    "polymorphism, inheritance, encapsulation, OOP, DBMS, normalization."
)


def get_model() -> WhisperModel:
    global _MODEL
    if _MODEL is None:
        with _LOCK:
            if _MODEL is None:
                name = os.getenv("WHISPER_MODEL", "small")
                compute = os.getenv("WHISPER_COMPUTE", "int8")
                threads = int(os.getenv("WHISPER_THREADS", "0") or 0)
                log.info("Loading Whisper model=%s compute=%s", name, compute)
                _MODEL = WhisperModel(
                    name, device="cpu", compute_type=compute, cpu_threads=threads
                )
    return _MODEL


def preload() -> None:
    """Call at app / worker startup so the first student doesn't pay the load time."""
    get_model()


def transcribe_audio(audio, **overrides):
    """
    audio: file path or float32 numpy array (16 kHz mono).
    Returns (segments_generator, info) exactly like WhisperModel.transcribe.
    Pass keyword overrides (e.g. vad_filter=False) only where a call site needs it.
    """
    lang = os.getenv("WHISPER_LANGUAGE", "en").strip() or None
    opts = dict(
        language=lang,
        beam_size=5,
        vad_filter=True,
        condition_on_previous_text=False,
        temperature=0.0,
        initial_prompt=os.getenv("WHISPER_PROMPT", DEFAULT_PROMPT),
    )
    opts.update(overrides)
    return get_model().transcribe(audio, **opts)