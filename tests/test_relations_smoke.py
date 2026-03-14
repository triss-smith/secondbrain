"""Smoke test — verifies classify logic without loading the NLI model."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from backend.ai.relations import _classify_pair, _softmax


def test_duplicate():
    assert _classify_pair(0.95, [0.1, 0.1, 0.8]) == "duplicate"


def test_contradiction():
    probs = _softmax([2.0, -1.0, 0.0])   # high contradiction logit
    assert _classify_pair(0.6, probs) == "contradicts"


def test_supports():
    probs = _softmax([-1.0, 2.5, 0.0])   # high entailment logit
    assert _classify_pair(0.65, probs) == "supports"


def test_related():
    probs = _softmax([0.0, 0.0, 2.0])    # neutral
    assert _classify_pair(0.55, probs) == "related"


def test_below_floor():
    assert _classify_pair(0.30, [0.33, 0.33, 0.34]) is None


if __name__ == "__main__":
    tests = [test_duplicate, test_contradiction, test_supports, test_related, test_below_floor]
    for t in tests:
        t()
        print(f"  PASS {t.__name__}")
    print("All smoke tests passed.")
