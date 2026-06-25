# ============================================
# validate.py — Fixed Version
# ============================================
# Save as: backend/dsa_bank/validate.py
# Usage: python validate.py batches/batch_01_arrays.json

import json
import sys
import copy


def find_main_function(exec_globals, function_signature=""):
    """Find the main solution function from executed code."""
    # Try extracting from function_signature first
    if function_signature:
        func_name = function_signature.split("(")[0].replace("def ", "").strip()
        if func_name in exec_globals and callable(exec_globals[func_name]):
            return func_name, exec_globals[func_name]
    
    # Fallback: find all user-defined callables
    builtins_to_skip = {
        'print', 'len', 'range', 'sorted', 'min', 'max', 'sum', 'abs',
        'map', 'filter', 'zip', 'enumerate', 'list', 'dict', 'set',
        'tuple', 'str', 'int', 'float', 'bool', 'type', 'isinstance',
        'hasattr', 'getattr', 'setattr', 'defaultdict', 'Counter',
        'deque', 'heappush', 'heappop', 'heapify', 'inf'
    }
    
    candidates = [
        k for k in exec_globals 
        if callable(exec_globals[k]) 
        and not k.startswith('_')
        and k not in builtins_to_skip
        and not isinstance(exec_globals[k], type)  # skip imported classes
    ]
    
    if not candidates:
        return None, None
    
    # Return last candidate (main function is usually defined after helpers)
    return candidates[-1], exec_globals[candidates[-1]]


def run_tests(func, test_cases, problem_name, label="solution"):
    """Run test cases against a function. Returns list of failures."""
    failures = []
    
    for i, tc in enumerate(test_cases):
        try:
            inp = tc.get("input", {})
            expected = tc.get("expected_output")
            
            # Deep copy to avoid mutation
            if isinstance(inp, dict):
                inp_copy = copy.deepcopy(inp)
                actual = func(**inp_copy)
            elif isinstance(inp, list):
                inp_copy = copy.deepcopy(inp)
                actual = func(*inp_copy)
            else:
                actual = func(inp)
            
            passed = actual == expected
            
            # Handle float comparison with tolerance
            if not passed and isinstance(actual, float) and isinstance(expected, (int, float)):
                passed = abs(actual - expected) < 1e-4
            if not passed and isinstance(expected, float) and isinstance(actual, (int, float)):
                passed = abs(actual - expected) < 1e-4
            
            # Handle unordered list comparison
            if not passed and isinstance(actual, list) and isinstance(expected, list):
                if len(actual) == len(expected):
                    try:
                        if all(not isinstance(x, list) for x in actual):
                            passed = sorted(actual) == sorted(expected)
                        else:
                            passed = sorted(
                                [sorted(x) if isinstance(x, list) else x for x in actual]
                            ) == sorted(
                                [sorted(x) if isinstance(x, list) else x for x in expected]
                            )
                    except TypeError:
                        passed = False
            
            if not passed:
                case_type = tc.get("case_type", "sample" if "explanation" in tc else "unknown")
                failures.append({
                    "case": i,
                    "type": case_type,
                    "input": str(inp)[:150],
                    "expected": str(expected)[:150],
                    "actual": str(actual)[:150]
                })
        except Exception as e:
            failures.append({
                "case": i,
                "type": tc.get("case_type", "unknown"),
                "error": str(e)[:300]
            })
    
    return failures


def validate_batch(filepath):
    with open(filepath, encoding='utf-8') as f:
        problems = json.load(f)
    
    total_problems = len(problems)
    solution_pass = 0
    solution_fail = 0
    brute_pass = 0
    brute_fail = 0
    brute_skip = 0
    
    for p in problems:
        name = p.get("problem_name", "Unknown")
        solution_code = p.get("solution_code", "")
        brute_code = p.get("brute_force_code", "")
        func_sig = p.get("function_signature", "")
        
        sample_cases = p.get("sample_cases", [])
        hidden_cases = p.get("hidden_test_cases", [])
        all_cases = sample_cases + hidden_cases
        
        # Non-performance cases for brute force testing
        non_perf_cases = sample_cases + [
            tc for tc in hidden_cases 
            if tc.get("case_type") != "performance"
        ]
        
        print(f"\n--- {name} ---")
        
        # ---- Validate solution code ----
        if not solution_code:
            print(f"  ❌ SOLUTION: No solution code!")
            solution_fail += 1
            continue
        
        exec_globals = {}
        try:
            exec(solution_code, exec_globals)
        except Exception as e:
            print(f"  ❌ SOLUTION: Syntax error: {e}")
            solution_fail += 1
            continue
        
        func_name, solution_fn = find_main_function(exec_globals, func_sig)
        if not solution_fn:
            print(f"  ❌ SOLUTION: No function found")
            solution_fail += 1
            continue
        
        failures = run_tests(solution_fn, all_cases, name, "solution")
        
        if failures:
            print(f"  ❌ SOLUTION: {len(all_cases) - len(failures)}/{len(all_cases)} passed")
            for f in failures:
                if "error" in f:
                    print(f"     Case {f['case']} ({f['type']}): ERROR — {f['error']}")
                else:
                    print(f"     Case {f['case']} ({f['type']}): expected {f['expected']}, got {f['actual']}")
            solution_fail += 1
        else:
            print(f"  ✅ SOLUTION: all {len(all_cases)} cases passed")
            solution_pass += 1
        
        # ---- Validate brute force code ----
        if not brute_code:
            print(f"  ⏭  BRUTE: No brute force code, skipping")
            brute_skip += 1
            continue
        
        brute_globals = {}
        try:
            exec(brute_code, brute_globals)
        except Exception as e:
            print(f"  ❌ BRUTE: Syntax error: {e}")
            brute_fail += 1
            continue
        
        _, brute_fn = find_main_function(brute_globals, func_sig)
        if not brute_fn:
            print(f"  ❌ BRUTE: No function found")
            brute_fail += 1
            continue
        
        brute_failures = run_tests(brute_fn, non_perf_cases, name, "brute")
        
        if brute_failures:
            print(f"  ❌ BRUTE: {len(non_perf_cases) - len(brute_failures)}/{len(non_perf_cases)} passed (excl. performance)")
            for f in brute_failures:
                if "error" in f:
                    print(f"     Case {f['case']} ({f['type']}): ERROR — {f['error']}")
                else:
                    print(f"     Case {f['case']} ({f['type']}): expected {f['expected']}, got {f['actual']}")
            brute_fail += 1
        else:
            print(f"  ✅ BRUTE: all {len(non_perf_cases)} non-performance cases passed")
            brute_pass += 1
    
    print(f"\n{'='*60}")
    print(f"SOLUTION: {solution_pass}/{total_problems} passed, {solution_fail} failed")
    print(f"BRUTE:    {brute_pass}/{total_problems} passed, {brute_fail} failed, {brute_skip} skipped")
    print(f"{'='*60}")
    
    if solution_fail > 0:
        print(f"\n⚠️  {solution_fail} problems need fixes before import!")
        return False
    
    print(f"\n✅ All solutions validated. Safe to import.")
    return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python validate.py <batch_file.json>")
        sys.exit(1)
    
    success = validate_batch(sys.argv[1])
    sys.exit(0 if success else 1)