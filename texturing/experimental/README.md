# Open3D 贴图实验

这个脚本保留了先前的照片投影实验。项目的远程贴图入口见 [texrecon](../README.md)。如需复现实验，在仓库根目录用带 Intel IPP 的 x86_64 Open3D 0.19 环境安装 `reconstruction/requirements.txt` 和 `xatlas==0.0.11`，运行：

```sh
python -m texturing.experimental.open3d_texture data/room runs/room/remeshed.ply runs/room/experimental.glb
```

Apple Silicon 需使用 Rosetta 和 x86_64 Python。此实验的亮度校正流程未作最终质量验证。
