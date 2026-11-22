# PawSpace 本地重建

在 Mac 上把一次扫描的 `rgb.mp4`、`depth.zip`、`camera.jsonl` 融合成米制、带顶点颜色的三角网格和表面点云。三个文件须来自同一次扫描，放在同一目录，保留原文件名。模型使用采集时的 ARKit 世界坐标，Y 轴朝上。

## 在 Mac 上运行

在本目录使用 Python 3.12。首次安装依赖需要联网，处理扫描时可以离线。

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python reconstruct.py ~/Downloads results/first-scan
.venv/bin/open3d draw results/first-scan/mesh.ply
```

输出目录须为新目录。用 `mesh.ply` 查看彩色表面，用 `points.ply` 查看彩色点云。同步检查、融合帧数、参数、模型范围和面数见 `report.json`。重建范围取决于实际扫到的表面。

## 数据和算法

- 按 ZIP 中的批次索引流式解码原始小端 Float32 米制深度和 UInt8 置信度。逐帧按显示时间解码 MP4，并核对视频相对时间、深度时间、相机时间和三者帧数。无需解压到磁盘。
- 将 RGB 缩放到该帧的深度分辨率，并按宽高比例缩放内参。按列读取 Swift 存储的矩阵，翻转相机的 Y、Z 轴，再将 ARKit 相机到世界的位姿求逆，得到 Open3D 所需的世界到光学相机变换。
- 用 Open3D 的 CPU ScalableTSDFVolume 融合深度与颜色。默认体素边长 2 cm，截断带为 4 个体素，使用 5 m 以内的中、高置信度有效深度。直接使用 ARKit 位姿，没有额外的回环优化或补洞。

可选参数：`--voxel 0.01` 使用 1 cm 体素，`--confidence 2` 仅使用高置信度深度，`--max-depth 4` 将融合距离限制为 4 m，`--stride 3` 每三帧融合一帧。调整体素会影响细节、内存和耗时。
