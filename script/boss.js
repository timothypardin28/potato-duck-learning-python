window.initPreparationChapter({
    chapterNumber: 16,
    chapterTitle: "Boss: PyThorn",
    nextChapterUrl: "index.html",
    starterCode: `def choose_stabbingPoint(x, y):
    

def maxDamage(weak_degree):
    
`,
    testHarness: (userCode) => `
import time

${userCode}

def run_tests():
    if "choose_stabbingPoint" not in globals():
        return {"passed": False, "msg": "Function 'choose_stabbingPoint' is not defined."}
    if "maxDamage" not in globals():
        return {"passed": False, "msg": "Function 'maxDamage' is not defined."}

    def is_close(val, expected, tol=1e-4):
        try:
            return abs(float(val) - float(expected)) <= tol
        except Exception:
            return False

    # --- choose_stabbingPoint Test Cases ---
    # Test Case 1: Example 1 (Even length, interleaved)
    try:
        res1 = choose_stabbingPoint([1, 2], [3, 4])
        if not is_close(res1, 2.5):
            return {"passed": False, "msg": f"Failed: choose_stabbingPoint([1, 2], [3, 4]) returned {res1}, expected 2.5"}
    except Exception as e:
        return {"passed": False, "msg": f"Runtime error on choose_stabbingPoint([1, 2], [3, 4]): {str(e)}"}

    # Test Case 2: Example 2 (Odd length)
    try:
        res2 = choose_stabbingPoint([1, 3], [2])
        if not is_close(res2, 2.0):
            return {"passed": False, "msg": f"Failed: choose_stabbingPoint([1, 3], [2]) returned {res2}, expected 2.0"}
    except Exception as e:
        return {"passed": False, "msg": f"Runtime error on choose_stabbingPoint([1, 3], [2]): {str(e)}"}

    # Test Case 3: Disjoint non-overlapping lists
    try:
        res3a = choose_stabbingPoint([1, 2, 3], [4, 5, 6])
        if not is_close(res3a, 3.5):
            return {"passed": False, "msg": f"Failed: choose_stabbingPoint([1, 2, 3], [4, 5, 6]) returned {res3a}, expected 3.5"}
        res3b = choose_stabbingPoint([10, 20], [1, 2, 3])
        if not is_close(res3b, 3.0):
            return {"passed": False, "msg": f"Failed: choose_stabbingPoint([10, 20], [1, 2, 3]) returned {res3b}, expected 3.0"}
    except Exception as e:
        return {"passed": False, "msg": f"Runtime error on disjoint lists: {str(e)}"}

    # Test Case 4: Negative numbers and zeros
    try:
        res4a = choose_stabbingPoint([-5, -3, -1], [-2, 0, 2])
        if not is_close(res4a, -1.5):
            return {"passed": False, "msg": f"Failed: choose_stabbingPoint([-5, -3, -1], [-2, 0, 2]) returned {res4a}, expected -1.5"}
        res4b = choose_stabbingPoint([-10, 0], [0, 10])
        if not is_close(res4b, 0.0):
            return {"passed": False, "msg": f"Failed: choose_stabbingPoint([-10, 0], [0, 10]) returned {res4b}, expected 0.0"}
    except Exception as e:
        return {"passed": False, "msg": f"Runtime error on negative values: {str(e)}"}

    # Test Case 5: Duplicates & identical elements
    try:
        res5a = choose_stabbingPoint([1, 1, 1], [1, 1, 1, 1])
        if not is_close(res5a, 1.0):
            return {"passed": False, "msg": f"Failed: choose_stabbingPoint([1, 1, 1], [1, 1, 1, 1]) returned {res5a}, expected 1.0"}
        res5b = choose_stabbingPoint([2, 3, 3], [3, 3, 4])
        if not is_close(res5b, 3.0):
            return {"passed": False, "msg": f"Failed: choose_stabbingPoint([2, 3, 3], [3, 3, 4]) returned {res5b}, expected 3.0"}
    except Exception as e:
        return {"passed": False, "msg": f"Runtime error on duplicate values: {str(e)}"}

    # Test Case 6: Asymmetric lengths
    try:
        res6a = choose_stabbingPoint([3], [1, 2, 4, 5, 6])
        if not is_close(res6a, 3.5):
            return {"passed": False, "msg": f"Failed: choose_stabbingPoint([3], [1, 2, 4, 5, 6]) returned {res6a}, expected 3.5"}
        res6b = choose_stabbingPoint([1, 2, 3, 4, 5, 6, 7], [8])
        if not is_close(res6b, 4.5):
            return {"passed": False, "msg": f"Failed: choose_stabbingPoint([1, 2, 3, 4, 5, 6, 7], [8]) returned {res6b}, expected 4.5"}
    except Exception as e:
        return {"passed": False, "msg": f"Runtime error on asymmetric lists: {str(e)}"}

    # Test Case 7: Scale & Complexity Verification for O(log(m+n))
    try:
        class _MonitoredCoords(list):
            def __init__(self, seq):
                super().__init__(seq)
                self.access_count = 0
            def __getitem__(self, idx):
                if isinstance(idx, slice):
                    self.access_count += len(range(*idx.indices(len(self))))
                else:
                    self.access_count += 1
                return super().__getitem__(idx)
            def __iter__(self):
                self.access_count += len(self)
                return super().__iter__()
            def __add__(self, other):
                self.access_count += len(self)
                if hasattr(other, 'access_count'):
                    other.access_count += len(other)
                return super().__add__(other)

        big_x = _MonitoredCoords(range(0, 500000, 2))
        big_y = _MonitoredCoords(range(1, 500000, 2))

        t0 = time.perf_counter()
        res7 = choose_stabbingPoint(big_x, big_y)
        elapsed = time.perf_counter() - t0

        if not is_close(res7, 249999.5):
            return {"passed": False, "msg": f"Failed on scale test: returned {res7}, expected 249999.5"}

        total_accesses = big_x.access_count + big_y.access_count
        if total_accesses > 300:
            return {"passed": False, "msg": f"Complexity Limit Exceeded: choose_stabbingPoint accessed coordinate elements {total_accesses} times on 500,000 items (Limit: <= 300 for O(log(m+n))). An O(m+n) merge, sort, or linear scan was detected! You must use binary search."}

        if elapsed > 0.15:
            return {"passed": False, "msg": f"Time Limit Exceeded: choose_stabbingPoint took {elapsed:.2f}s (Limit: 0.15s). The required runtime complexity is O(log(m+n))."}
    except Exception as e:
        return {"passed": False, "msg": f"Runtime error on scale test: {str(e)}"}

    # --- maxDamage Test Cases ---
    # Test Case 8: Example from description
    try:
        res8 = maxDamage([3, 3, 5, 0, 0, 3, 1, 4])
        if res8 != 6:
            return {"passed": False, "msg": f"Failed: maxDamage([3, 3, 5, 0, 0, 3, 1, 4]) returned {res8}, expected 6"}
    except Exception as e:
        return {"passed": False, "msg": f"Runtime error on maxDamage example: {str(e)}"}

    # Test Case 9: Monotonically increasing
    try:
        res9 = maxDamage([1, 2, 3, 4, 5])
        if res9 != 4:
            return {"passed": False, "msg": f"Failed: maxDamage([1, 2, 3, 4, 5]) returned {res9}, expected 4"}
    except Exception as e:
        return {"passed": False, "msg": f"Runtime error on increasing weakness: {str(e)}"}

    # Test Case 10: Monotonically decreasing
    try:
        res10 = maxDamage([7, 6, 4, 3, 1])
        if res10 != 0:
            return {"passed": False, "msg": f"Failed: maxDamage([7, 6, 4, 3, 1]) returned {res10}, expected 0"}
    except Exception as e:
        return {"passed": False, "msg": f"Runtime error on decreasing weakness: {str(e)}"}

    # Test Case 11: Peaks and valleys with multiple options
    try:
        if maxDamage([1, 4, 2, 7]) != 8:
            return {"passed": False, "msg": "Failed: maxDamage([1, 4, 2, 7]) should return 8 ((4-1) + (7-2))"}
        if maxDamage([3, 2, 6, 5, 0, 3]) != 7:
            return {"passed": False, "msg": "Failed: maxDamage([3, 2, 6, 5, 0, 3]) should return 7 ((6-2) + (3-0))"}
        if maxDamage([2, 1, 4, 5, 2, 9, 7]) != 11:
            return {"passed": False, "msg": "Failed: maxDamage([2, 1, 4, 5, 2, 9, 7]) should return 11 ((5-1) + (9-2))"}
    except Exception as e:
        return {"passed": False, "msg": f"Runtime error on multi-peak weakness: {str(e)}"}

    # Test Case 12: Flat weakness & 2 elements
    try:
        if maxDamage([4, 4, 4, 4]) != 0:
            return {"passed": False, "msg": "Failed: maxDamage([4, 4, 4, 4]) should return 0"}
        if maxDamage([2, 4]) != 2:
            return {"passed": False, "msg": "Failed: maxDamage([2, 4]) should return 2"}
        if maxDamage([4, 2]) != 0:
            return {"passed": False, "msg": "Failed: maxDamage([4, 2]) should return 0"}
    except Exception as e:
        return {"passed": False, "msg": f"Runtime error on flat weakness: {str(e)}"}

    # Test Case 13: Scale Test for maxDamage O(N)
    try:
        large_weakness = [i % 50 for i in range(30000)]
        t0 = time.perf_counter()
        res13 = maxDamage(large_weakness)
        elapsed_dmg = time.perf_counter() - t0
        if res13 != 98:
            return {"passed": False, "msg": f"Failed on scale test for maxDamage: returned {res13}, expected 98"}
        if elapsed_dmg > 0.25:
            return {"passed": False, "msg": f"Time Limit Exceeded: maxDamage took {elapsed_dmg:.2f}s on 30,000 weakness values. O(N^2) is too slow! Use O(N) dynamic programming."}
    except Exception as e:
        return {"passed": False, "msg": f"Runtime error on maxDamage scale test: {str(e)}"}

    return {"passed": True, "msg": "PyThorn has been slain! With precision stabbing and perfect timing, Quackbit conquers the final boss!"}

run_tests()
`
});
