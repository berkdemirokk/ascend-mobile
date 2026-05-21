#!/usr/bin/env python3
"""
Generate per-lesson MP3 narration with Piper TTS.

Reads a lessons.<lang>.json (the schema used by mobile/src/i18n/locales)
and produces one MP3 per lesson, named `<pathId>-<order>.mp3`. The
GitHub Actions workflow uploads these as release assets so the mobile
app can stream them on demand.

Usage:
  python3 scripts/generate-lesson-audio.py \
      --lessons mobile/src/i18n/locales/lessons.tr.json \
      --voice voices/tr_TR-fahrettin-medium.onnx \
      --paths dopamine-detox \
      --lesson-range 1-5 \
      --output audio_out/
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path


def strip_markdown(text: str) -> str:
    """Remove Markdown emphasis markers — they read aloud as 'asterisk'."""
    # **bold** / *italic* / __bold__ / _italic_ → plain
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"__(.+?)__", r"\1", text)
    text = re.sub(r"\*(.+?)\*", r"\1", text)
    text = re.sub(r"_(.+?)_", r"\1", text)
    # Backticks
    text = re.sub(r"`(.+?)`", r"\1", text)
    return text


def in_range(lesson_id: str, lesson_range: str) -> bool:
    if lesson_range == "all":
        return True
    if "-" in lesson_range:
        start_s, end_s = lesson_range.split("-", 1)
        try:
            n = int(lesson_id)
            return int(start_s) <= n <= int(end_s)
        except ValueError:
            return False
    # Comma-separated explicit list, e.g. "1,3,7"
    if "," in lesson_range:
        return lesson_id in [s.strip() for s in lesson_range.split(",")]
    return lesson_id == lesson_range.strip()


def synth_one(text: str, voice: Path, out_wav: Path) -> None:
    """Run Piper to produce a WAV. Piper reads text from stdin."""
    proc = subprocess.run(
        [
            "piper",
            "--model",
            str(voice),
            "--output_file",
            str(out_wav),
        ],
        input=text.encode("utf-8"),
        capture_output=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"piper failed: {proc.stderr.decode('utf-8', errors='ignore')}"
        )


def to_mp3(wav: Path, mp3: Path, bitrate: str = "64k") -> None:
    """Compress WAV → MP3 with ffmpeg. 64k mono is more than enough for speech."""
    proc = subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(wav),
            "-ac",
            "1",  # mono
            "-codec:a",
            "libmp3lame",
            "-b:a",
            bitrate,
            str(mp3),
        ],
        capture_output=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"ffmpeg failed: {proc.stderr.decode('utf-8', errors='ignore')}"
        )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lessons", required=True, help="Path to lessons.<lang>.json")
    ap.add_argument("--voice", required=True, help="Path to .onnx model")
    ap.add_argument(
        "--paths",
        default="all",
        help='Path IDs (comma-separated) or "all"',
    )
    ap.add_argument(
        "--lesson-range",
        default="all",
        help='Lesson range like "1-5", "1,3,7", or "all"',
    )
    ap.add_argument("--output", required=True, help="Output directory")
    args = ap.parse_args()

    lessons_path = Path(args.lessons)
    voice_path = Path(args.voice)
    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    if not lessons_path.is_file():
        print(f"Lessons file not found: {lessons_path}", file=sys.stderr)
        return 1
    if not voice_path.is_file():
        print(f"Voice model not found: {voice_path}", file=sys.stderr)
        return 1

    data = json.loads(lessons_path.read_text(encoding="utf-8"))
    lessons_root = data.get("lessons", {})
    if args.paths == "all":
        target_paths = list(lessons_root.keys())
    else:
        target_paths = [p.strip() for p in args.paths.split(",") if p.strip()]

    total = 0
    failed = 0
    for path_id in target_paths:
        lessons_in_path = lessons_root.get(path_id)
        if not lessons_in_path:
            print(f"[skip] no lessons for path {path_id}")
            continue
        for lesson_id, lesson in sorted(
            lessons_in_path.items(), key=lambda kv: int(kv[0])
        ):
            if not in_range(lesson_id, args.lesson_range):
                continue
            teaching = lesson.get("teaching", "")
            if not teaching.strip():
                continue
            clean = strip_markdown(teaching)
            out_wav = out_dir / f"{path_id}-{lesson_id}.wav"
            out_mp3 = out_dir / f"{path_id}-{lesson_id}.mp3"
            start = time.time()
            try:
                synth_one(clean, voice_path, out_wav)
                to_mp3(out_wav, out_mp3)
                out_wav.unlink(missing_ok=True)
                elapsed = time.time() - start
                size_kb = out_mp3.stat().st_size // 1024
                print(
                    f"[ok]  {path_id}-{lesson_id}.mp3  "
                    f"({size_kb} KB, {elapsed:.1f}s)"
                )
                total += 1
            except Exception as e:  # noqa: BLE001
                print(f"[err] {path_id}-{lesson_id}: {e}", file=sys.stderr)
                failed += 1

    print(f"\nGenerated {total} files, {failed} failed.")
    return 1 if failed and not total else 0


if __name__ == "__main__":
    sys.exit(main())
