"""Render PedalMap 9:16 Reel ads from generated campaign scenes.

Produces original 15-second MP4s with subtle cinematic motion and an
original, copyright-safe electronic audio bed.
"""

from __future__ import annotations

import math
import shutil
import subprocess
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
REELS = ROOT / "public" / "social" / "campaign-august" / "reels"
SCENES = REELS / "scenes"
TEMP = REELS / ".render"

REEL_NAMES = [
    "reel-01-antes-de-salir",
    "reel-02-viento",
    "reel-03-gpx",
]


def render_audio(path: Path, duration: float = 15.0, sample_rate: int = 48_000) -> None:
    """Create a restrained original synth bed (no third-party music)."""
    t = np.arange(round(duration * sample_rate), dtype=np.float64) / sample_rate
    audio = np.zeros_like(t)

    # Warm minor pad (A–C–E), slowly breathing.
    envelope = 0.5 + 0.5 * np.sin(2 * np.pi * 0.10 * t - np.pi / 2)
    for frequency, gain in [(110.0, 0.10), (130.81, 0.07), (164.81, 0.055)]:
        audio += gain * envelope * np.sin(2 * np.pi * frequency * t)

    # Branded pulse every 1.5 s.
    for beat in np.arange(0, duration, 1.5):
        dt = t - beat
        mask = (dt >= 0) & (dt < 0.32)
        decay = np.exp(-dt[mask] * 13)
        audio[mask] += 0.24 * decay * np.sin(2 * np.pi * (58 + 22 * decay) * dt[mask])

    # Light high pulse, keeps it moving without sounding like stock music.
    rng = np.random.default_rng(83)
    noise = rng.normal(0, 1, t.size)
    for beat in np.arange(0.75, duration, 0.75):
        dt = t - beat
        mask = (dt >= 0) & (dt < 0.075)
        audio[mask] += 0.025 * np.exp(-dt[mask] * 50) * noise[mask]

    # Intro/outro and safe peak.
    fade = np.minimum(np.clip(t / 0.45, 0, 1), np.clip((duration - t) / 0.75, 0, 1))
    audio *= fade
    audio /= max(1.0, np.max(np.abs(audio)) / 0.86)
    pcm = (audio * 32767).astype(np.int16)

    with wave.open(str(path), "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(sample_rate)
        out.writeframes(pcm.tobytes())


def run(args: list[str]) -> None:
    print(" ".join(args))
    subprocess.run(args, check=True)


def render_reel(name: str, audio_path: Path) -> None:
    work = TEMP / name
    work.mkdir(parents=True, exist_ok=True)
    clips: list[Path] = []

    for index in range(1, 6):
        scene = SCENES / name / f"{index:02d}.jpg"
        clip = work / f"{index:02d}.mp4"
        direction = 1 if index % 2 else -1
        # 3 seconds / 90 frames. Slow 1.0→1.045 Ken Burns motion.
        zoom = (
            "zoompan="
            "z='min(zoom+0.0005,1.045)':"
            f"x='iw/2-(iw/zoom/2)+{direction}*min(on,90)*0.08':"
            "y='ih/2-(ih/zoom/2)':"
            "d=90:s=1080x1920:fps=30,"
            "fade=t=in:st=0:d=0.16,"
            "fade=t=out:st=2.84:d=0.16,"
            "format=yuv420p"
        )
        run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-loop",
                "1",
                "-i",
                str(scene),
                "-vf",
                zoom,
                "-t",
                "3",
                "-r",
                "30",
                "-c:v",
                "libx264",
                "-preset",
                "medium",
                "-crf",
                "20",
                "-pix_fmt",
                "yuv420p",
                str(clip),
            ]
        )
        clips.append(clip)

    manifest = work / "concat.txt"
    manifest.write_text("\n".join(f"file '{clip}'" for clip in clips) + "\n")
    silent = work / "silent.mp4"
    run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(manifest),
            "-c",
            "copy",
            str(silent),
        ]
    )

    output = REELS / f"{name}.mp4"
    run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(silent),
            "-i",
            str(audio_path),
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            "-movflags",
            "+faststart",
            str(output),
        ]
    )
    print(output.relative_to(ROOT))


def main() -> None:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg is required")
    TEMP.mkdir(parents=True, exist_ok=True)
    audio = TEMP / "pedalmap-original-bed.wav"
    render_audio(audio)
    for reel in REEL_NAMES:
        render_reel(reel, audio)


if __name__ == "__main__":
    main()
