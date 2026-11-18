import CoreVideo
import Foundation

@main
enum DepthArchiveFixture {
    static func main() throws {
        let output = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
        let writer = try DepthArchive(directory: output)
        let patterns: [UInt32] = [0, 0x80000000, 0x3f800001, 0x00000001, 0x7f800000, 0xff800000, 0x7fc12345]
        for frame in 0..<41 {
            let width = frame < 33 ? 7 : 11
            let height = 5
            let depth = try makeBuffer(width, height, kCVPixelFormatType_DepthFloat32)
            let confidence = try makeBuffer(width, height, kCVPixelFormatType_OneComponent8)
            for (buffer, isDepth) in [(depth, true), (confidence, false)] {
                precondition(CVPixelBufferLockBaseAddress(buffer, []) == kCVReturnSuccess)
                let stride = CVPixelBufferGetBytesPerRow(buffer)
                precondition(stride > width * (isDepth ? 4 : 1))
                let base = CVPixelBufferGetBaseAddress(buffer)!
                memset(base, 0xa5, stride * height)
                for row in 0..<height {
                    let start = base.advanced(by: row * stride)
                    for x in 0..<width {
                        let i = row * width + x + frame
                        if isDepth { start.assumingMemoryBound(to: UInt32.self)[x] = patterns[i % patterns.count] }
                        else { start.assumingMemoryBound(to: UInt8.self)[x] = UInt8(i % 3) }
                    }
                }
                CVPixelBufferUnlockBaseAddress(buffer, [])
            }
            try writer.append(depth: depth, confidence: confidence, timestampNS: Int64(frame) * 16_666_667)
        }
        try writer.finish(observedFrames: 43)
    }

    private static func makeBuffer(_ w: Int, _ h: Int, _ type: OSType) throws -> CVPixelBuffer {
        var result: CVPixelBuffer?
        let options = [kCVPixelBufferBytesPerRowAlignmentKey: 64] as CFDictionary
        guard CVPixelBufferCreate(nil, w, h, type, options, &result) == kCVReturnSuccess, let result else {
            throw CaptureError("Fixture pixel buffer allocation failed.")
        }
        return result
    }
}
