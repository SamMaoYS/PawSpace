# 在远程 Linux 上运行 texrecon

本目录包含原项目使用的 [MVS-Texturing fork](https://github.com/3dlg-hcvc/mvs-texturing/tree/7220821c9ca5a39ccdd8b9b6fd733b677aaeb6c4) 的实际 C++ 源码、Dockerfile 和适配 ScanDesigner 的相机导出脚本。目标是 **Linux x86_64、CPU、无需桌面或 CUDA**。建议在运行任务的机器上构建，旧版依赖使用 x86 SIMD，并按本机指令集优化。

以下命令从仓库根目录执行。示例中的 `data/room` 代表一次录制，`runs/room` 代表该次扫描的工作目录。

## 1. 准备输入

| 文件 | 用途 |
| --- | --- |
| `data/room/rgb.mp4` | 原始相机 H.264 视频，使用原生像素方向 |
| `data/room/camera.jsonl` | 同次录制、逐帧的 ARKit 内参与位姿 |
| `runs/room/remeshed.ply` | 同次扫描的 Instant Meshes 三角网格，保持原始尺度、朝向和坐标原点 |

`depth.zip` 用于前面的 TSDF 重建，已经有减面网格时可只传上表三个文件。若要从头重建，则将录制的三个文件一起复制过去，按根目录 README 生成网格。iPad 系统录屏带有界面叠加，其时间轴和图像裁切与传感器记录不同；请使用 App 写出的 `rgb.mp4`。

## 2. 导出图像和相机

在远程主机或有原始数据的 Mac 上安装 Python 3.12。这个步骤仅需 PyAV、NumPy 和 Pillow。已建好的重建环境也可使用。

```sh
python3.12 -m venv .venv-views
.venv-views/bin/python -m pip install -r texturing/requirements.txt
.venv-views/bin/python texturing/prepare_views.py data/room runs/room/views --stride 30
```

脚本按 MP4 的显示顺序解码，核对每一帧的相对时间和 JSONL 位姿数量。每 30 个已保存帧输出一张 PNG 和一个同名的 MVE 相机文件，如 `00000030.png` 与 `00000030.cam`。图像保留原始分辨率，文件名是源帧序号。更小的步长会增加视角数量、磁盘和内存占用。输出到新目录可避免混入上一次的相机。

第一行相机参数为平移后接按行排列的旋转矩阵。脚本按列读取 Swift 位姿，计算 `world_to_camera = inverse(T_arkit @ diag(1,-1,-1,1))`。第二行记录 MVE 的归一化焦距、两个零畸变参数、像素宽高参数及归一化主点。内参使用 PNG 实际宽高，坐标保持与网格一致。

## 3. 安装 texrecon

**Docker 路径**。远程机器需要 Docker；构建期间需要访问 Ubuntu 软件源和 GitHub。运行阶段在本地读取文件。Ubuntu 20.04 提供经典 TBB。此 fork 使用 `tbb/task_scheduler_init.h`，许多新发行版自带的 oneTBB 已移除这个接口。

```sh
docker build --platform linux/amd64 -t scandesigner-texrecon -f texturing/Dockerfile texturing
```

**原生路径**。在 Ubuntu 20.04 x86_64 上直接编译时使用以下依赖。GCC 提供 OpenMP，CMake 会拉取 MVE、mapMAP、rayint 和 Eigen。若构建内存不足，可把并行数降为 2。

```sh
sudo apt-get update
sudo apt-get install -y build-essential cmake git ca-certificates libpng-dev libjpeg-dev libtiff-dev libtbb-dev
test -f /usr/include/tbb/task_scheduler_init.h
cmake -S texturing/vendor/mvs-texturing -B build/texrecon -DCMAKE_BUILD_TYPE=Release
cmake --build build/texrecon --target texrecon --parallel 4
```

源码基于提交 `7220821`。本仓库固定了依赖下载版本，保留算法与旧管线的纹理图集参数。MVE 为 `SamMaoYS/mve@c524aca`，mapMAP 为 `55d14fd`，rayint 为 `b62c890`，Eigen 为 3.3.2 并校验 SHA-256。完整版本在 [elibs/CMakeLists.txt](vendor/mvs-texturing/elibs/CMakeLists.txt)，许可证见 [LICENSE.txt](vendor/mvs-texturing/LICENSE.txt)。

## 4. 生成纹理

新建一个输出目录。最后一个参数是输出文件名前缀。Docker 命令只挂载本次需要的图像、几何和输出目录。

```sh
mkdir runs/room/textured
docker run --rm --user "$(id -u):$(id -g)" \
  -v "$PWD/runs/room/views:/views:ro" \
  -v "$PWD/runs/room/remeshed.ply:/mesh.ply:ro" \
  -v "$PWD/runs/room/textured:/out" scandesigner-texrecon \
  -d area -o gauss_clamping --keep_unseen_faces --num_threads=8 \
  --max_texture_size=8192 --prefer_texture_size=4096 --min_texture_size=256 \
  --padding=7 --waste_ratio=1.0 /views /mesh.ply /out/room
```

原生安装使用同一组参数，直接调用可执行文件。两种方法任选其一，在新输出目录运行。

```sh
mkdir -p runs/room/textured-native
build/texrecon/apps/texrecon/texrecon \
  -d area -o gauss_clamping --keep_unseen_faces --num_threads=8 \
  --max_texture_size=8192 --prefer_texture_size=4096 --min_texture_size=256 \
  --padding=7 --waste_ratio=1.0 \
  runs/room/views runs/room/remeshed.ply runs/room/textured-native/room
```

将 `room.obj`、`room.mtl` 和 MTL 中引用的纹理图片放在同一目录，用 MeshLab 或 Blender 打开 OBJ。先核对一个清晰物体的照片方向和位置。若纹理大面积错位，优先检查网格是否被居中、旋转或缩放，及视频和 JSONL 是否属于同一次扫描。已有 `tmp` 的输出目录会被 texrecon 拒绝，新建一个输出目录即可重试。

## 验证范围

Mac 上已用真实 iPad 扫描验证图像导出、视频与位姿同步、相机数值，以及前序重建和 Instant Meshes。Linux 构建和最终 OBJ 贴图需在目标 Linux 环境验证。另附之前的 Open3D 投影实验 [experimental/open3d_texture.py](experimental/open3d_texture.py)，属于独立实验；以上安装和运行使用原始 C++ texrecon。
