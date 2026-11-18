"""Run Instant Meshes in triangle mode, preserving the reconstruction coordinate system."""
import argparse
import os
from pathlib import Path
import subprocess
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("input", type=Path)
parser.add_argument("output", type=Path)
parser.add_argument("--binary", default="Instant Meshes", help="Executable path or name on PATH")
parser.add_argument("--vertices", type=int, default=50_000)
args = parser.parse_args()
if not args.input.is_file() or args.output.suffix.lower() != ".ply":
    parser.error("Specify an existing input mesh and a .ply destination")
if args.output.exists() or args.vertices < 3:
    parser.error("Choose a new output path and at least three target vertices")
args.output.parent.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(dir=args.output.parent) as temp:
    mesh = Path(temp) / "mesh.ply"
    try:
        subprocess.run([args.binary, "-r", "6", "-p", "3", "-v", str(args.vertices),
                        "-o", str(mesh), str(args.input)], check=True)
        if not mesh.is_file() or not mesh.stat().st_size:
            raise OSError("Instant Meshes returned without writing a mesh")
        os.link(mesh, args.output)
    except (OSError, subprocess.CalledProcessError) as exc:
        parser.exit(1, f"Remeshing failed: {exc}\n")
print(args.output)
