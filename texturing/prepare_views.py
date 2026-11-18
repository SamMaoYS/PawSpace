"""Export synchronized native RGB frames and MVE cameras from a ScanDesigner recording."""
import argparse
import json
import os
import tempfile
from itertools import zip_longest
from pathlib import Path

import av
import numpy as np


def mve_camera(camera, width, height):
    k = np.asarray(camera["intrinsics"], dtype=float).reshape(3, 3, order="F")
    pose = np.asarray(camera["transform"], dtype=float).reshape(4, 4, order="F")
    if not np.isfinite(k).all() or not np.isfinite(pose).all():
        raise ValueError("Non-finite camera calibration")
    fx, fy = k[0, 0], k[1, 1]
    if min(fx, fy) <= 0 or not np.allclose(pose[3], [0, 0, 0, 1]):
        raise ValueError("Invalid camera intrinsics or transform")
    world_to_camera = np.linalg.inv(pose @ np.diag([1, -1, -1, 1]))
    extrinsics = np.r_[world_to_camera[:3, 3], world_to_camera[:3, :3].ravel()]
    # In MVE's CameraInfo::fill_calibration, ay = ax * paspect.
    aspect = fy / fx
    focal = fx / width if width * aspect >= height else fy / height
    intrinsics = [focal, 0, 0, aspect, k[0, 2] / width, k[1, 2] / height]
    return "\n".join(" ".join(format(v, ".15g") for v in row)
                     for row in (extrinsics, intrinsics)) + "\n"


def export(scan, output, stride):
    if output.exists():
        raise ValueError(f"Choose a new output directory: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    saved = 0
    with tempfile.TemporaryDirectory(dir=output.parent) as temp:
        scene = Path(temp) / "views"
        scene.mkdir()
        with av.open(str(scan / "rgb.mp4")) as movie, (scan / "camera.jsonl").open() as poses:
            stream = movie.streams.video[0]
            stream.thread_type = "AUTO"
            previous = None
            for i, (frame, line) in enumerate(zip_longest(movie.decode(stream), poses)):
                if frame is None or line is None or frame.pts is None:
                    raise ValueError(f"Incomplete video/pose pair at frame {i}")
                camera = json.loads(line)
                stamp = camera["timestamp"]
                if previous is None:
                    first_stamp, first_video_time = stamp, frame.pts * frame.time_base
                elif stamp <= previous:
                    raise ValueError(f"Camera timestamps out of order at frame {i}")
                previous = stamp
                elapsed = float(frame.pts * frame.time_base - first_video_time)
                if abs(elapsed - (stamp - first_stamp) * 1e-9) > 2 * float(frame.time_base) + 2e-9:
                    raise ValueError(f"RGB and ARKit timestamps differ at frame {i}")
                if i % stride == 0:
                    stem = scene / f"{i:08d}"
                    stem.with_suffix(".cam").write_text(mve_camera(camera, frame.width, frame.height))
                    frame.to_image().save(stem.with_suffix(".png"), compress_level=1)
                    saved += 1
        if saved == 0:
            raise ValueError("Recording is empty")
        os.rename(scene, output)
    return saved


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("scan", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--stride", type=int, default=30, help="Keep every Nth accepted frame")
    args = parser.parse_args()
    if args.stride < 1:
        parser.error("--stride must be positive")
    try:
        print(f"Exported {export(args.scan, args.output, args.stride)} PNG/camera pairs to {args.output}")
    except (OSError, ValueError, KeyError, np.linalg.LinAlgError) as exc:
        parser.exit(1, f"View export failed: {exc}\n")
