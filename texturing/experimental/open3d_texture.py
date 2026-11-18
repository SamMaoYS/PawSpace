"""Project ScanDesigner's RGB keyframes onto a world-aligned Instant Meshes mesh."""
import argparse
import json
import platform
import tempfile
from itertools import zip_longest
from pathlib import Path

import av
import numpy as np
import open3d as o3d
import xatlas

from reconstruction.reconstruct import calibration


def unwrap(path, size):
    source = o3d.io.read_triangle_mesh(str(path))
    if not source.has_triangles():
        raise ValueError(f"No triangles in {path}")
    # Split the vertices at UV seams. xatlas also accepts the non-manifold
    # junctions that Instant Meshes can generate near scanning boundaries.
    atlas = xatlas.Atlas()
    atlas.add_mesh(np.asarray(source.vertices, dtype=np.float32),
                   np.asarray(source.triangles, dtype=np.uint32))
    pack = xatlas.PackOptions()
    pack.resolution = size
    pack.padding = 3
    atlas.generate(pack_options=pack)
    mapping, indices, uv = atlas[0]
    if len(indices) != len(source.triangles) or atlas.atlas_count != 1:
        raise ValueError("Could not fit the mesh into a single UV atlas")
    tensor = o3d.core.Tensor
    mesh = o3d.t.geometry.TriangleMesh(
        tensor(np.asarray(source.vertices, dtype=np.float32)[mapping]),
        tensor(indices.astype(np.int64)))
    mesh.triangle.texture_uvs = tensor(np.ascontiguousarray(uv[indices]))
    mesh.compute_vertex_normals()
    return mesh


def read_views(scan, views):
    cameras = [json.loads(line) for line in (scan / "camera.jsonl").read_text().splitlines()]
    if not cameras:
        raise ValueError("No camera poses")
    indices = set(np.linspace(0, len(cameras)-1, min(views, len(cameras)), dtype=int))
    images, intrinsics, extrinsics = [], [], []
    with av.open(str(scan / "rgb.mp4")) as movie:
        stream = movie.streams.video[0]
        stream.thread_type = "AUTO"
        for i, (video, camera) in enumerate(zip_longest(movie.decode(stream), cameras)):
            if video is None or camera is None or video.pts is None:
                raise ValueError(f"Video/pose count or timestamp mismatch at frame {i}")
            if i == 0:
                first_pts = video.pts
            seconds = float((video.pts - first_pts) * video.time_base)
            elapsed = (camera["timestamp"] - cameras[0]["timestamp"]) * 1e-9
            if abs(seconds - elapsed) > 2 * float(video.time_base) + 2e-9:
                raise ValueError(f"Video and camera timing disagree at frame {i}")
            if i in indices:
                intrinsic, extrinsic = calibration(camera, video, (video.height, video.width))
                images.append(o3d.t.geometry.Image(np.ascontiguousarray(video.to_ndarray(format="rgb24"))))
                intrinsics.append(o3d.core.Tensor(intrinsic.intrinsic_matrix.copy()))
                extrinsics.append(o3d.core.Tensor(extrinsic))
    return images, intrinsics, extrinsics


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("scan", type=Path)
    parser.add_argument("mesh", type=Path)
    parser.add_argument("output", type=Path, help="New .glb file, including embedded texture")
    parser.add_argument("--size", type=int, default=2048)
    parser.add_argument("--views", type=int, default=48)
    args = parser.parse_args()
    if args.output.suffix.lower() != ".glb" or args.output.exists():
        parser.error("Choose a new .glb output path")
    if args.views < 1 or args.size < 64:
        parser.error("Use at least one view and a texture size of at least 64")
    if platform.machine() not in ("x86_64", "AMD64"):
        parser.error("This Open3D build lacks Intel IPP. Use the x86_64 texture environment.")
    print("Unwrapping the mesh...", flush=True)
    mesh = unwrap(args.mesh, args.size)
    print("Reading synchronized RGB keyframes...", flush=True)
    images, intrinsics, extrinsics = read_views(args.scan, args.views)
    print(f"Projecting {len(images)} views onto a {args.size} x {args.size} texture...", flush=True)
    albedo = mesh.project_images_to_albedo(images, intrinsics, extrinsics, args.size)
    # Open3D 0.19 also adds a baseline weight for views that miss a texel.
    # Projecting white measures that attenuation with identical visibility and weights.
    white_images = {}
    masks = []
    for image in images:
        shape = (image.rows, image.columns, 3)
        if shape not in white_images:
            white_images[shape] = o3d.t.geometry.Image(np.full(shape, 255, dtype=np.uint8))
        masks.append(white_images[shape])
    del images
    weights = mesh.project_images_to_albedo(masks, intrinsics, extrinsics, args.size,
                                           update_material=False)
    denominator = weights.as_tensor().numpy()[:, :, :1]
    rgb = albedo.as_tensor().numpy().astype(np.float32)
    rgb *= 255.0 / np.maximum(denominator, 1)
    rgb = np.where(denominator > 0, rgb, 0).clip(0, 255).round().astype(np.uint8)
    mesh.material.texture_maps["albedo"] = o3d.t.geometry.Image(rgb)
    if not np.any(rgb):
        raise ValueError("Empty texture. Check the mesh and camera coordinate systems.")
    mesh.material.material_name = "defaultLit"
    mesh.material.vector_properties["emissive_color"] = np.array([0, 0, 0, 1], np.float32)
    mesh.material.scalar_properties["transmission"] = 0.0
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=args.output.parent) as staging:
        target = Path(staging) / args.output.name
        if not o3d.t.io.write_triangle_mesh(str(target), mesh):
            raise OSError(f"Could not export {target.name}")
        target.rename(args.output)
    print(args.output)


if __name__ == "__main__":
    main()
