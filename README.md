# ScanDesigner

用 LiDAR iPad 或 iPhone 采集房间，在 Mac 或 Linux CPU 上重建，再用 Instant Meshes 生成轻量三角网格。默认交付物是减面后的 PLY。需要照片纹理时，可在 Linux x86_64 机器上额外运行原项目的 `texrecon`。

| 目录 | 入口 | 产物 |
| --- | --- | --- |
| [scanner](scanner/) | Xcode 工程、真机安装与录制说明 | `rgb.mp4`、`depth.zip`、`camera.jsonl` |
| [reconstruction](reconstruction/) | Python + Open3D CPU TSDF | 米制彩色 `mesh.ply`、`points.ply`、`report.json` |
| [instant-meshes](instant-meshes/) | Instant Meshes 源码及命令行封装 | 保留 ARKit 世界坐标的轻量三角网格 |
| [texturing](texturing/) | 远程 Linux 安装、相机转换与 texrecon 源码 | 带 UV 的 OBJ、MTL 与纹理图片 |
| [showcase](showcase/) | 房间漫游、虚拟副本与猫窝布置演示 | 交互网页、纹理网格及可编辑的 Blender 场景 |

## 在本机打开演示网页

安装 Python 3 后，克隆仓库并启动本地服务。

```sh
git clone https://github.com/SamMaoYS/ScanDesigner.git
cd ScanDesigner
python3 -m http.server 8731 --bind 127.0.0.1 --directory showcase/web
```

在支持 WebGL 2 的浏览器打开 [本机演示网页](http://127.0.0.1:8731/)。页面默认使用英文，右上角可切换中文。在终端按 Ctrl+C 停止服务。网页所需的模型、视频、渲染图和查看器均已随仓库提供。模型源文件位置、macOS 快捷启动方式和 Windows 命令见 [showcase 使用说明](showcase/README.md)。

## 从一次扫描开始

```sh
git clone git@github.com:SamMaoYS/ScanDesigner.git
cd ScanDesigner
python3.12 -m venv .venv
.venv/bin/python -m pip install -r reconstruction/requirements.txt
```

在「文件 → 我的 iPad → ScanDesigner」中复制同一次扫描的三个文件，放到 `data/room/`。所有命令在仓库根目录执行。Linux 上使用 Open3D 的无桌面机器如果报告缺少 `libGL.so.1` 或 `libgomp.so.1`，可安装发行版的 `libgl1` 和 `libgomp1`。

```sh
.venv/bin/python reconstruction/reconstruct.py data/room runs/room
# 按 instant-meshes/README.md 安装或构建 CLI，指定它的实际路径。
.venv/bin/python instant-meshes/remesh.py runs/room/mesh.ply runs/room/remeshed.ply \
  --binary "/path/to/Instant Meshes" --vertices 50000
```

此时即可使用 `runs/room/remeshed.ply`。原始重建的 RGB 保存在 `mesh.ply` 的顶点颜色中；Instant Meshes 输出几何网格。需要进一步贴图时，把减面网格、同次扫描的 RGB 视频与相机文件带到远程机器，按[远程 texrecon 使用说明](texturing/README.md)继续。

采集数据和重建产物保存在本地。源码包含第三方组件，各组件的版权、许可证和出处见对应目录；HKUST 校徽的使用说明见 [scanner](scanner/README.md)。
