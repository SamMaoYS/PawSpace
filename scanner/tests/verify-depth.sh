#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT
zipdir=ScannerApp-Swift/ThirdParty/minizip
xcrun --sdk macosx clang -c "$zipdir/zip.c" -o "$tmpdir/zip.o"
xcrun --sdk macosx clang -c "$zipdir/ioapi.c" -o "$tmpdir/ioapi.o"
xcrun --sdk macosx swiftc -module-cache-path "$tmpdir/modules" -import-objc-header "$zipdir/zip.h" \
    ScannerApp-Swift/Model/Recorder/DepthArchive.swift tests/DepthArchiveFixture.swift \
    "$tmpdir/zip.o" "$tmpdir/ioapi.o" -lz -o "$tmpdir/fixture"
"$tmpdir/fixture" "$tmpdir"
python3 - "$tmpdir/depth.zip" <<'PY'
import json, struct, sys, zipfile

patterns = [0, 0x80000000, 0x3f800001, 1, 0x7f800000, 0xff800000, 0x7fc12345]
with zipfile.ZipFile(sys.argv[1]) as z:
    assert z.testzip() is None
    manifest = json.loads(z.read('manifest.json'))
    assert (manifest['frameCount'], manifest['skippedFrames']) == (41, 2)
    count = 0
    for path in sorted(p for p in z.namelist() if p.startswith('index/')):
        key = path.split('/')[1].split('.')[0]
        index = json.loads(z.read(path))
        assert index['firstFrame'] == count
        layout = index['layout']
        depth = bytearray()
        confidence = bytearray()
        for ts in index['timestampsNS']:
            assert ts == count * 16_666_667
            width = 7 if count < 33 else 11
            assert (layout['width'], layout['height']) == (width, 5)
            for i in range(width * 5):
                depth.extend(struct.pack('<I', patterns[(i + count) % len(patterns)]))
                confidence.append((i + count) % 3)
            count += 1
        assert depth == z.read('depth/' + key + '.f32le')
        assert confidence == z.read('confidence/' + key + '.u8')
    assert count == 41
print('41 padded RGB-D map pairs round-tripped, including signed zero, subnormal, infinity and NaN payload bits.')
PY
