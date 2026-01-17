from collections import defaultdict
from typing import Dict

# interview_id:question_id → raw PCM bytes
PCM_BUFFERS: Dict[str, bytearray] = defaultdict(bytearray)


def _key(interview_id: str, question_id: int) -> str:
    return f"{interview_id}:{question_id}"


def append_pcm(interview_id: str, question_id: int, pcm_bytes: bytes):
    key = _key(interview_id, question_id)
    PCM_BUFFERS[key].extend(pcm_bytes)


def pop_pcm(interview_id: str, question_id: int) -> bytes:
    key = _key(interview_id, question_id)
    return PCM_BUFFERS.pop(key, b"")
