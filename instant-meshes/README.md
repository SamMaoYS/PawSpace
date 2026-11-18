# Instant Meshes

输入为 Open3D 导出的三角网格，输出为同一米制世界坐标系下的轻量 PLY。封装传入 `-r 6 -p 3` 选择三角面，`--vertices` 是目标顶点数，实际数量由算法决定。输出不携带原网格的 RGB 顶点颜色。

## Mac

下载并解压[作者提供的 Mac 版](https://github.com/wjakob/instant-meshes#pre-compiled-binaries)。在仓库根目录执行，按实际位置调整程序路径。Apple Silicon 使用 Rosetta 运行 Intel 版。

```sh
python3 instant-meshes/remesh.py runs/room/mesh.ply runs/room/remeshed.ply \
  --vertices 50000 --binary "/Applications/Instant Meshes.app/Contents/MacOS/Instant Meshes"
```

## Linux 无界面构建

`source/` 是原项目使用的 [3dlg-hcvc fork](https://github.com/3dlg-hcvc/instant-meshes)，固定在 `2b99a421bb4e3f91254ff11c2af6cfea81a16b6f`。以下命令面向带 GCC 和 CMake 3.x 的 Ubuntu x86_64 主机。在仓库根目录执行。仅下载 CLI 需要的嵌套子模块。

```sh
sudo apt-get update
sudo apt-get install -y build-essential cmake git libeigen3-dev
git submodule update --init instant-meshes/source
git -C instant-meshes/source submodule update --init ext/tbb ext/dset ext/pss ext/pcg32
cmake -S instant-meshes/source -B build/instant-meshes -DBUILD_GUI=OFF -DCMAKE_BUILD_TYPE=Release
cmake --build build/instant-meshes --target InstantMeshes --parallel 4
python3 instant-meshes/remesh.py runs/room/mesh.ply runs/room/remeshed.ply \
  --binary "$PWD/build/instant-meshes/Instant Meshes" --vertices 50000
```

机器上若已有生成好的 `remeshed.ply`，可直接进入[贴图步骤](../texturing/README.md)。保持模型与相机处于同一坐标系。
