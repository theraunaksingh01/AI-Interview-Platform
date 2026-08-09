# backend/api/runner.py
# Secure code execution sandbox for DSA practice
# Supports Python, Java, C++

import os
import re
import subprocess
import tempfile
import sys
from pathlib import Path

TIMEOUT_SECONDS = 10
MAX_OUTPUT_CHARS = 10_000
MAX_CODE_LENGTH = 50_000  # 50KB max code size

# ── Python dangerous imports/calls blocklist ───────────────────────────────────

PYTHON_BLOCKED_IMPORTS = [
    "os", "sys", "subprocess", "socket", "requests", "urllib",
    "http", "ftplib", "smtplib", "telnetlib", "xmlrpc",
    "pickle", "shelve", "marshal", "importlib", "builtins",
    "ctypes", "cffi", "mmap", "signal", "resource",
    "multiprocessing", "threading", "concurrent",
    "asyncio", "aiohttp", "tornado", "twisted",
    "shutil", "pathlib", "glob", "fnmatch",
    "tempfile", "io", "open", "file",
    "eval", "exec", "compile", "__import__",
]

PYTHON_BLOCKED_PATTERNS = [
    r"__import__\s*\(",
    r"importlib",
    r"open\s*\(",
    r"exec\s*\(",
    r"eval\s*\(",
    r"compile\s*\(",
    r"getattr\s*\(",
    r"setattr\s*\(",
    r"delattr\s*\(",
    r"globals\s*\(",
    r"locals\s*\(",
    r"vars\s*\(",
    r"dir\s*\(",
    r"__builtins__",
    r"__class__",
    r"__subclasses__",
    r"__bases__",
    r"__mro__",
    r"chr\s*\(\s*\d+\s*\)",  # chr() used to bypass string detection
    r"\\x[0-9a-fA-F]{2}",    # hex escape sequences
]

# Java dangerous patterns
JAVA_BLOCKED_PATTERNS = [
    r"Runtime\.getRuntime",
    r"ProcessBuilder",
    r"System\.exit",
    r"Class\.forName",
    r"Runtime\.exec",
    r"java\.io\.File",
    r"java\.net\.",
    r"javax\.net\.",
    r"java\.lang\.reflect",
    r"ClassLoader",
]

# C++ dangerous patterns
CPP_BLOCKED_PATTERNS = [
    r"system\s*\(",
    r"popen\s*\(",
    r"exec[lv]?\s*\(",
    r"fork\s*\(",
    r"#include\s*<\s*(unistd|sys/|signal|dlfcn)",
]


def _check_python_safety(code: str) -> tuple[bool, str]:
    """Returns (is_safe, reason). Checks for dangerous imports and patterns."""
    lines = code.split("\n")
    for line in lines:
        stripped = line.strip()
        # Check import statements
        if stripped.startswith("import ") or stripped.startswith("from "):
            for blocked in PYTHON_BLOCKED_IMPORTS:
                if re.search(rf'\b{re.escape(blocked)}\b', stripped):
                    return False, f"Import not allowed: '{blocked}'. Only standard algorithm libraries are permitted."
    
    # Check dangerous patterns
    for pattern in PYTHON_BLOCKED_PATTERNS:
        if re.search(pattern, code):
            return False, f"Dangerous pattern detected. Only standard algorithm code is permitted."
    
    return True, ""


def _check_java_safety(code: str) -> tuple[bool, str]:
    for pattern in JAVA_BLOCKED_PATTERNS:
        if re.search(pattern, code):
            return False, "Dangerous Java pattern detected. System calls are not permitted."
    return True, ""


def _check_cpp_safety(code: str) -> tuple[bool, str]:
    for pattern in CPP_BLOCKED_PATTERNS:
        if re.search(pattern, code):
            return False, "Dangerous C++ pattern detected. System calls are not permitted."
    return True, ""


def _build_python_wrapper(user_code: str, stdin_data: str) -> str:
    """Wrap user code with resource limits and restricted builtins."""
    # We write user_code to a separate file and exec it
    # This avoids string escaping issues entirely
    return '''
import sys

# Set memory limit: 256MB
try:
    import resource
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
except Exception:
    pass  # Windows does not support resource limits

import collections, heapq, math, functools, itertools, bisect, copy, decimal, fractions, random, string
import re as _re

_safe_modules = {
    'collections': collections, 'heapq': heapq, 'math': math,
    'functools': functools, 'itertools': itertools, 'bisect': bisect,
    'copy': copy, 'decimal': decimal, 'fractions': fractions,
    'random': random, 'string': string, 're': _re,
}

def _safe_import(name, *args, **kwargs):
    if name in _safe_modules:
        return _safe_modules[name]
    raise ImportError(f"Import of '{name}' is not allowed in the sandbox.")

_safe_builtins = {
    'print': print, 'input': input, 'len': len, 'range': range,
    'int': int, 'float': float, 'str': str, 'bool': bool,
    'list': list, 'dict': dict, 'set': set, 'tuple': tuple,
    'min': min, 'max': max, 'sum': sum, 'abs': abs,
    'sorted': sorted, 'reversed': reversed, 'enumerate': enumerate,
    'zip': zip, 'map': map, 'filter': filter, 'any': any, 'all': all,
    'isinstance': isinstance, 'issubclass': issubclass,
    'type': type, 'id': id, 'hash': hash,
    'round': round, 'pow': pow, 'divmod': divmod,
    'chr': chr, 'ord': ord, 'hex': hex, 'oct': oct, 'bin': bin,
    'repr': repr, 'format': format, 'next': next, 'iter': iter,
    'StopIteration': StopIteration, 'Exception': Exception,
    'ValueError': ValueError, 'TypeError': TypeError,
    'IndexError': IndexError, 'KeyError': KeyError,
    'AttributeError': AttributeError, 'RuntimeError': RuntimeError,
    'OverflowError': OverflowError, 'ZeroDivisionError': ZeroDivisionError,
    'RecursionError': RecursionError, 'NotImplementedError': NotImplementedError,
    'True': True, 'False': False, 'None': None,
    '__name__': '__main__',
    '__import__': _safe_import,
    '__build_class__': __build_class__,
}

with open("user_code.py", "r") as f:
    _code = f.read()

exec(compile(_code, "solution.py", "exec"), {"__builtins__": _safe_builtins})
'''


def run_code(language: str, code: str, stdin: str = "") -> dict:
    """
    Execute student code securely and return results.
    
    Returns:
        dict with keys: stdout, stderr, exit_code, timed_out, error
    """
    # Size check
    if len(code) > MAX_CODE_LENGTH:
        return {
            "stdout": "",
            "stderr": "Code too large. Maximum 50KB allowed.",
            "exit_code": 1,
            "timed_out": False,
            "error": "Code size limit exceeded",
        }

    language = language.lower().strip()

    # Security checks
    if language == "python":
        is_safe, reason = _check_python_safety(code)
        if not is_safe:
            return {
                "stdout": "",
                "stderr": f"Security violation: {reason}",
                "exit_code": 1,
                "timed_out": False,
                "error": "Security violation",
            }
    elif language == "java":
        is_safe, reason = _check_java_safety(code)
        if not is_safe:
            return {
                "stdout": "",
                "stderr": f"Security violation: {reason}",
                "exit_code": 1,
                "timed_out": False,
                "error": "Security violation",
            }
    elif language in ("cpp", "c++"):
        is_safe, reason = _check_cpp_safety(code)
        if not is_safe:
            return {
                "stdout": "",
                "stderr": f"Security violation: {reason}",
                "exit_code": 1,
                "timed_out": False,
                "error": "Security violation",
            }

    with tempfile.TemporaryDirectory() as tmpdir:
        try:
            if language == "python":
                return _run_python(code, stdin, tmpdir)
            elif language == "java":
                return _run_java(code, stdin, tmpdir)
            elif language in ("cpp", "c++"):
                return _run_cpp(code, stdin, tmpdir)
            else:
                return {
                    "stdout": "",
                    "stderr": f"Unsupported language: {language}",
                    "exit_code": 1,
                    "timed_out": False,
                    "error": "Unsupported language",
                }
        except Exception as e:
            return {
                "stdout": "",
                "stderr": f"Execution error: {str(e)}",
                "exit_code": 1,
                "timed_out": False,
                "error": str(e),
            }


def _subprocess_run(cmd: list, stdin: str, tmpdir: str, env: dict = None) -> dict:
    """Common subprocess execution with timeout and output limits."""
    try:
        proc_env = os.environ.copy()
        # Block network on Linux via env (best effort)
        proc_env["no_proxy"] = "*"
        proc_env["NO_PROXY"] = "*"
        if env:
            proc_env.update(env)

        result = subprocess.run(
            cmd,
            input=stdin,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
            cwd=tmpdir,
            env=proc_env,
        )
        stdout = result.stdout[:MAX_OUTPUT_CHARS]
        stderr = result.stderr[:2000]
        return {
            "stdout": stdout,
            "stderr": stderr,
            "exit_code": result.returncode,
            "timed_out": False,
            "error": None,
        }
    except subprocess.TimeoutExpired:
        return {
            "stdout": "",
            "stderr": f"Time limit exceeded ({TIMEOUT_SECONDS}s). Check for infinite loops.",
            "exit_code": 1,
            "timed_out": True,
            "error": "timeout",
        }
    except FileNotFoundError as e:
        return {
            "stdout": "",
            "stderr": f"Runtime not found: {e}. Make sure Python/Java/g++ is installed.",
            "exit_code": 1,
            "timed_out": False,
            "error": str(e),
        }


def _run_python(code: str, stdin: str, tmpdir: str) -> dict:
    """Run Python code with sandboxed builtins."""
    # Write user code separately — avoids string escaping in wrapper
    user_code_file = os.path.join(tmpdir, "user_code.py")
    with open(user_code_file, "w", encoding="utf-8") as f:
        f.write(code)

    wrapper = _build_python_wrapper(code, stdin)
    wrapper_file = os.path.join(tmpdir, "solution.py")
    with open(wrapper_file, "w", encoding="utf-8") as f:
        f.write(wrapper)

    return _subprocess_run(
        [sys.executable, "-u", wrapper_file],
        stdin=stdin,
        tmpdir=tmpdir,
        env={"PYTHONDONTWRITEBYTECODE": "1", "PYTHONPATH": ""},
    )


def _run_java(code: str, stdin: str, tmpdir: str) -> dict:
    """Compile and run Java code."""
    # Extract class name
    match = re.search(r"public\s+class\s+(\w+)", code)
    class_name = match.group(1) if match else "Solution"
    
    java_file = os.path.join(tmpdir, f"{class_name}.java")
    with open(java_file, "w", encoding="utf-8") as f:
        f.write(code)

    # Compile
    compile_result = _subprocess_run(
        ["javac", java_file],
        stdin="",
        tmpdir=tmpdir,
    )
    if compile_result["exit_code"] != 0:
        return {
            "stdout": "",
            "stderr": compile_result["stderr"],
            "exit_code": compile_result["exit_code"],
            "timed_out": False,
            "error": "Compilation failed",
        }

    # Run with security manager and memory limits
    return _subprocess_run(
        [
            "java",
            f"-Xmx256m",         # max heap 256MB
            f"-Xss8m",           # stack size 8MB
            "-Djava.security.manager",
            "-Djava.net.preferIPv4Stack=true",
            "-cp", tmpdir,
            class_name,
        ],
        stdin=stdin,
        tmpdir=tmpdir,
    )


def _run_cpp(code: str, stdin: str, tmpdir: str) -> dict:
    """Compile and run C++ code."""
    cpp_file = os.path.join(tmpdir, "solution.cpp")
    exe_file = os.path.join(tmpdir, "solution")
    
    with open(cpp_file, "w", encoding="utf-8") as f:
        f.write(code)

    # Compile
    compile_result = _subprocess_run(
        ["g++", "-O2", "-o", exe_file, cpp_file, "-lm"],
        stdin="",
        tmpdir=tmpdir,
    )
    if compile_result["exit_code"] != 0:
        return {
            "stdout": "",
            "stderr": compile_result["stderr"],
            "exit_code": compile_result["exit_code"],
            "timed_out": False,
            "error": "Compilation failed",
        }

    return _subprocess_run(
        [exe_file],
        stdin=stdin,
        tmpdir=tmpdir,
    )