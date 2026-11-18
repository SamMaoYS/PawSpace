# ScanDesigner 房间展示

这个演示从 App 扫描开始，在同一视角对比实景扫描与虚拟副本，再用 Blender 渲染和带尺寸的猫窝方案展示家具之间的关系。

## 启动网页

准备 Python 3.7 或更新版本，以及支持 WebGL 2 的浏览器。模型查看器和所有展示素材都在本目录内，克隆完成后可以离线运行。

从仓库根目录执行以下命令。

```sh
python3 -m http.server 8731 --bind 127.0.0.1 --directory showcase/web
```

Windows 可用 `py -3` 代替 `python3`。在浏览器打开 [http://127.0.0.1:8731/](http://127.0.0.1:8731/)，在终端按 Ctrl+C 停止。若端口已被占用，将命令和网址中的 `8731` 改为 `8732`。

macOS 也可双击 [打开房间漫游.command](web/打开房间漫游.command)。它会选用空闲的本机端口并打开浏览器。

## 查看与编辑素材

| 文件或目录 | 用途 |
| --- | --- |
| [web/](web/) | 可直接通过 HTTP 提供的完整静态网页 |
| [room.glb](web/assets/room.glb) | 漫游里带有现场纹理的扫描模型 |
| [design.glb](web/assets/design.glb) | 与扫描对齐的虚拟副本，可用相同的相机视角对比 |
| [pet-layout.glb](web/assets/pet-layout.glb) | 带猫窝和建议占地虚线的三维方案 |
| [views.json](web/assets/views.json) | 房间全景及五个家具、门口视角的相机参数与双语标注 |
| [相机轨迹视频](web/assets/showcase/camera-path.mp4) | 位于 App 介绍与房间漫游之间，用绿色标记展示扫描时相机在重建房间内的位置和朝向 |
| [展示素材](web/assets/showcase/) | 网页播放的加速版 App 视频与封面、Blender 渲染图和带尺寸的分析图 |
| [纹理扫描源文件](source/scan/) | 完整的扫描 GLB，以及 texrecon 输出的 OBJ、MTL 和七张 PNG 纹理图。导入 OBJ 时将这些文件放在同一目录。 |
| [ScanDesigner-room.blend](source/replica/ScanDesigner-room.blend) | 可编辑的虚拟副本源场景，包含按扫描搭建的家具、墙体、相机和灯光，使用 Blender 5.0.1 制作。猫窝方案可另行导入上面的 pet-layout.glb。 |

扫描与虚拟副本的视角缩略图分别位于 [web/assets/](web/assets/) 和 [web/assets/design-views/](web/assets/design-views/)。随网页分发的 model-viewer 组件附有[许可证](web/assets/LICENSE-model-viewer.txt)。
