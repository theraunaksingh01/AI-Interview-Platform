# backend/core/code_safety.py
"""
Basic keyword blacklist for student code submissions.
NOT a full sandbox — just blocks the most obvious attacks.
On Linux production, add restricted user + ulimit wrapper.
"""

from fastapi import HTTPException

# Patterns that indicate attempt to escape the sandbox
# Checked against Python code only — Java/C++ have different risks
PYTHON_BLOCKED = [
    "import os",
    "import sys",
    "import subprocess",
    "import socket",
    "import shutil",
    "import pathlib",
    "__import__",
    "os.system",
    "os.popen",
    "os.remove",
    "os.unlink",
    "os.rmdir",
    "os.listdir",
    "os.walk",
    "open(",
    "exec(",
    "eval(",
    "compile(",
    "globals(",
    "locals(",
    "__builtins__",
    "getattr(",
    "setattr(",
    "delattr(",
    "importlib",
    "ctypes",
    "pickle",
    "marshal",
    "multiprocessing",
    "threading",
    "asyncio",
    "urllib",
    "requests",
    "http.client",
    "ftplib",
    "smtplib",
]

# For Java — block runtime exec and file access
JAVA_BLOCKED = [
    "Runtime.getRuntime",
    "ProcessBuilder",
    "System.exit",
    "new File(",
    "FileWriter",
    "FileReader",
    "FileInputStream",
    "FileOutputStream",
    "java.net",
    "java.nio",
    "reflect",
    "ClassLoader",
]

# For C++ — block system calls
CPP_BLOCKED = [
    "system(",
    "popen(",
    "exec(",
    "fork(",
    "fopen(",
    "fwrite(",
    "remove(",
    "unlink(",
    "#include <cstdlib>",
    "WinExec",
    "ShellExecute",
]


def validate_code(code: str, language: str) -> None:
    """
    Raise HTTPException 400 if code contains blocked patterns.
    Call this before execute_code().
    """
    if not code or len(code.strip()) == 0:
        raise HTTPException(status_code=400, detail="empty_code")

    if len(code) > 50_000:
        raise HTTPException(status_code=400, detail="code_too_long")

    if language == "python":
        blocked = PYTHON_BLOCKED
    elif language == "java":
        blocked = JAVA_BLOCKED
    elif language == "cpp":
        blocked = CPP_BLOCKED
    else:
        raise HTTPException(status_code=400, detail="unsupported_language")

    code_lower = code.lower()
    for pattern in blocked:
        if pattern.lower() in code_lower:
            raise HTTPException(
                status_code=400,
                detail=f"code_blocked: '{pattern}' is not allowed in submissions",
            )