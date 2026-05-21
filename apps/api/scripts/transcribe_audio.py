import argparse
import json
import os
import sys


DEFAULT_INITIAL_PROMPT = (
    "This is a real Indian customer support call. The conversation may contain "
    "Hindi, Marathi, Hinglish, or mixed-language speech. Preserve names, numbers, "
    "and code-switched phrases naturally."
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Local faster-whisper runner")
    parser.add_argument("--audio-path", required=True)
    parser.add_argument("--model", default="small")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--beam-size", type=int, default=1)
    parser.add_argument("--vad-filter", action="store_true")
    parser.add_argument("--cpu-threads", type=int, default=4)
    parser.add_argument("--initial-prompt", default=DEFAULT_INITIAL_PROMPT)
    parser.add_argument("--model-cache-dir", default=None)
    return parser


def configure_stdio() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")


def fail(message: str, code: int = 1) -> int:
    sys.stderr.write(message.strip() + "\n")
    return code


def main() -> int:
    configure_stdio()
    parser = build_parser()
    args = parser.parse_args()

    if not os.path.exists(args.audio_path):
      return fail(f"Audio file not found: {args.audio_path}", 2)

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return fail(
            "Missing Python dependency 'faster-whisper'. Install it with "
            "'python -m pip install -r apps/api/requirements-local-ai.txt'.",
            4,
        )

    try:
        model = WhisperModel(
            args.model,
            device=args.device,
            compute_type=args.compute_type,
            cpu_threads=max(args.cpu_threads, 1),
            download_root=args.model_cache_dir or None,
        )

        segments, info = model.transcribe(
            args.audio_path,
            beam_size=max(args.beam_size, 1),
            vad_filter=args.vad_filter,
            initial_prompt=args.initial_prompt,
            condition_on_previous_text=False,
            temperature=0.0,
            word_timestamps=False,
        )

        transcript_parts = []
        segment_items = []

        for segment in segments:
            text = (segment.text or "").strip()
            if not text:
                continue
            transcript_parts.append(text)
            segment_items.append(
                {
                    "start": round(float(segment.start), 2),
                    "end": round(float(segment.end), 2),
                    "text": text,
                }
            )

        transcript = " ".join(transcript_parts).strip()
        duration_seconds = getattr(info, "duration", None)
        if duration_seconds is None and segment_items:
            duration_seconds = segment_items[-1]["end"]

        payload = {
            "transcript": transcript,
            "detectedLanguageCode": getattr(info, "language", None),
            "detectedLanguageProbability": getattr(
                info, "language_probability", None
            ),
            "durationSeconds": round(float(duration_seconds), 2)
            if duration_seconds is not None
            else None,
            "segmentCount": len(segment_items),
            "segments": segment_items,
            "model": args.model,
        }

        sys.stdout.write(json.dumps(payload, ensure_ascii=False))
        return 0
    except Exception as exc:  # pragma: no cover - runtime safeguard
        return fail(f"faster-whisper transcription failed: {exc}", 5)


if __name__ == "__main__":
    raise SystemExit(main())
