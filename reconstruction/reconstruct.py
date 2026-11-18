"""Reconstruct a local ScanDesigner recording with Open3D's CPU TSDF integrator."""
import argparse
import json
import math
import os
import sys
import tempfile
import time
from contextlib import ExitStack
from pathlib import Path
from zipfile import BadZipFile, ZipFile

import av
import numpy as np
import open3d as o3d


ARKIT_FROM_OPTICAL = np.diag([1.0, -1.0, -1.0, 1.0])


def depth_frames(archive):
    """Yield native metre-valued float32 depth and uint8 confidence, one batch in memory."""
    manifest = json.loads(archive.read("manifest.json"))
    expected = {"format": "ScanDesigner.depth", "version": 1, "byteOrder": "little",
                "depthUnit": "metre", "layout": "frame,row,column"}
    if any(manifest.get(key) != value for key, value in expected.items()):
        raise ValueError("Unsupported depth.zip format, unit, or layout")
    count = 0
    for name in sorted(n for n in archive.namelist() if n.startswith("index/") and n.endswith(".json")):
        index = json.loads(archive.read(name))
        layout = index["layout"]
        times = index["timestampsNS"]
        key = f"{count:08d}"
        if index["firstFrame"] != count or name != f"index/{key}.json" or not times:
            raise ValueError(f"Missing or unordered depth batch at frame {count}")
        if layout["depthType"] != "f32le" or min(layout["height"], layout["width"]) <= 0:
            raise ValueError(f"Invalid depth layout at frame {count}")
        shape = (len(times), layout["height"], layout["width"])
        depths = np.frombuffer(archive.read(f"depth/{key}.f32le"), "<f4").reshape(shape)
        confidence = np.frombuffer(archive.read(f"confidence/{key}.u8"), np.uint8).reshape(shape)
        yield from zip(times, depths, confidence, strict=True)
        count += len(times)
    if not count or count != manifest["frameCount"]:
        raise ValueError(f"Depth archive contains {count} frames, manifest declares {manifest['frameCount']}")


def calibration(camera, video, depth_shape):
    height, width = depth_shape
    if width * video.height != height * video.width:
        raise ValueError("RGB and depth aspect ratios differ")
    # The recorder serializes simd matrices column by column in native sensor orientation.
    k = np.array(camera["intrinsics"]).reshape(3, 3, order="F")
    k = np.diag([width / video.width, height / video.height, 1]) @ k
    pose = np.array(camera["transform"]).reshape(4, 4, order="F")
    if (not np.isfinite(k).all() or min(k[0, 0], k[1, 1]) <= 0 or
            not np.isfinite(pose).all() or not np.allclose(pose[3], [0, 0, 0, 1])):
        raise ValueError("Invalid camera intrinsics or pose")
    intrinsic = o3d.camera.PinholeCameraIntrinsic(width, height, k[0, 0], k[1, 1], k[0, 2], k[1, 2])
    return intrinsic, np.linalg.inv(pose @ ARKIT_FROM_OPTICAL)


def reconstruct(args):
    started = time.monotonic()
    volume = o3d.pipelines.integration.ScalableTSDFVolume(
        voxel_length=args.voxel, sdf_trunc=4 * args.voxel,
        color_type=o3d.pipelines.integration.TSDFVolumeColorType.RGB8)
    integrated = 0
    previous_stamp = None
    with ExitStack() as stack:
        archive = stack.enter_context(ZipFile(args.scan / "depth.zip"))
        cameras = stack.enter_context((args.scan / "camera.jsonl").open())
        movie = stack.enter_context(av.open(str(args.scan / "rgb.mp4")))
        stream = movie.streams.video[0]
        stream.thread_type = "AUTO"
        frames = zip(depth_frames(archive), movie.decode(stream), cameras, strict=True)
        for i, ((stamp, depth, confidence), video, line) in enumerate(frames):
            camera = json.loads(line)
            if abs(stamp - camera["timestamp"]) > 1 or (previous_stamp is not None and stamp <= previous_stamp):
                raise ValueError(f"Camera and depth timestamps disagree or are unordered at frame {i}")
            if video.pts is None:
                raise ValueError(f"Missing RGB presentation timestamp at frame {i}")
            if i == 0:
                first_stamp, first_pts = stamp, video.pts
            rgb_elapsed = float((video.pts - first_pts) * video.time_base)
            if abs(rgb_elapsed - (stamp - first_stamp) * 1e-9) > 2 * float(video.time_base) + 1e-9:
                raise ValueError(f"RGB and depth timing disagree at frame {i}")
            previous_stamp = stamp
            if i % args.stride:
                continue
            intrinsic, extrinsic = calibration(camera, video, depth.shape)
            valid = np.isfinite(depth) & (depth > 0) & (depth < args.max_depth) & (confidence >= args.confidence)
            if not valid.any():
                continue
            height, width = depth.shape
            color = video.reformat(width, height, "rgb24", interpolation="AREA").to_ndarray()
            rgbd = o3d.geometry.RGBDImage.create_from_color_and_depth(
                o3d.geometry.Image(np.ascontiguousarray(color)),
                o3d.geometry.Image(np.where(valid, depth, np.float32(0))),
                depth_scale=1.0, depth_trunc=args.max_depth, convert_rgb_to_intensity=False)
            volume.integrate(rgbd, intrinsic, extrinsic)
            integrated += 1
            if integrated % 250 == 0:
                print(f"Integrated {integrated} frames (source frame {i + 1})", flush=True)
    mesh = volume.extract_triangle_mesh()
    cloud = volume.extract_point_cloud()
    if not mesh.has_triangles() or not cloud.has_points():
        raise ValueError("No surface reconstructed with the selected confidence and depth limits")
    mesh.compute_vertex_normals()
    report = dict(frames_checked=i + 1, frames_integrated=integrated,
                  duration_seconds=(previous_stamp - first_stamp) * 1e-9,
                  voxel_metres=args.voxel, max_depth_metres=args.max_depth,
                  min_confidence=args.confidence, stride=args.stride,
                  vertices=len(mesh.vertices), triangles=len(mesh.triangles), points=len(cloud.points),
                  bounds_metres=[mesh.get_min_bound().tolist(), mesh.get_max_bound().tolist()],
                  open3d=o3d.__version__, processing_seconds=round(time.monotonic() - started, 1))
    # Publish all outputs together, after the three streams have passed validation.
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=args.output.parent) as staging:
        result = Path(staging) / "result"
        result.mkdir()
        if not o3d.io.write_triangle_mesh(str(result / "mesh.ply"), mesh):
            raise OSError("Could not write mesh.ply")
        if not o3d.io.write_point_cloud(str(result / "points.ply"), cloud):
            raise OSError("Could not write points.ply")
        (result / "report.json").write_text(json.dumps(report, indent=2) + "\n")
        os.rename(result, args.output)
    print(json.dumps(report, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("scan", type=Path, help="Directory containing rgb.mp4, depth.zip and camera.jsonl")
    parser.add_argument("output", type=Path, help="New directory for the mesh, point cloud and report")
    parser.add_argument("--voxel", type=float, default=0.02, help="TSDF voxel size in metres (default 0.02)")
    parser.add_argument("--max-depth", type=float, default=5.0, help="Depth cutoff in metres (default 5)")
    parser.add_argument("--confidence", type=int, choices=[0, 1, 2], default=1, help="Minimum ARKit confidence")
    parser.add_argument("--stride", type=int, default=1, help="Fuse every Nth frame (default 1), validate all")
    args = parser.parse_args()
    if args.output.exists():
        parser.error("Output already exists. Choose a new output directory.")
    if args.stride < 1 or not all(math.isfinite(x) and x > 0 for x in [args.voxel, args.max_depth]):
        parser.error("Stride, voxel size and depth cutoff must be positive")
    try:
        reconstruct(args)
    except (OSError, ValueError, KeyError, RuntimeError, BadZipFile, np.linalg.LinAlgError) as exc:
        sys.exit(f"Reconstruction failed: {exc}")


if __name__ == "__main__":
    main()
