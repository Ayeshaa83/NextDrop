"""
Musicnn Auto-Tagger — Isolated subprocess script.

This script is designed to be called via subprocess.run() from runner.py.
It loads TensorFlow/Musicnn in a separate process to prevent GPU/memory
conflicts with the main FastAPI server.

Usage:
    python tagger_musicnn.py /path/to/audio.mp3

Output:
    Prints RESULT:{json} to stdout. All other output goes to stderr.
"""
import os
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"  # Force CPU only — prevents GPU/RAM conflicts

import sys
import json
import numpy as np


class RedirectStdout:
    """Redirect stdout to stderr so only our RESULT line hits stdout."""
    def __init__(self):
        self.stdout = sys.stdout

    def __enter__(self):
        sys.stdout = sys.stderr
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        sys.stdout = self.stdout


def main():
    if len(sys.argv) < 2:
        print("RESULT:" + json.dumps({"error": "No file path provided"}), file=sys.__stdout__)
        return

    file_path = sys.argv[1]

    if not os.path.exists(file_path):
        print("RESULT:" + json.dumps({"error": f"File not found: {file_path}"}), file=sys.__stdout__)
        return

    try:
        with RedirectStdout():
            from musicnn.extractor import extractor

        # Extract tags using MSD_musicnn model
        # input_length=3 processes 3-second windows across the track
        # extractor() returns (taggram, labels) when extract_features=False —
        # only 3 values when extract_features=True (with a features dict too).
        taggram, tags = extractor(
            file_path,
            model='MSD_musicnn',
            input_length=3,
            extract_features=False
        )

        # Average probabilities across all time windows
        mean_probs = np.mean(taggram, axis=0)
        top_indices = np.argsort(mean_probs)[::-1][:20]  # Top 20 tags

        result = []
        for idx in top_indices:
            result.append({
                "tag": tags[idx],
                "score": round(float(mean_probs[idx]), 4)
            })

        print("RESULT:" + json.dumps({"tags": result}), file=sys.__stdout__)

    except Exception as e:
        print("RESULT:" + json.dumps({"error": str(e)}), file=sys.__stdout__)


if __name__ == "__main__":
    main()
