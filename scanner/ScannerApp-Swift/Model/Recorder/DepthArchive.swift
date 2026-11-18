import CoreVideo
import Foundation

struct CaptureError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

/// Queue-confined writer. Each batch is independently extractable using a standard ZIP reader.
final class DepthArchive {
    private struct Layout: Codable, Equatable {
        let width: Int
        let height: Int
        let depthType: String
    }

    private struct Index: Encodable {
        let firstFrame: Int
        let layout: Layout
        let timestampsNS: [Int64]
    }

    private var zip: zipFile?
    private let destination: URL
    private let partial: URL
    private var layout: Layout?
    private var depths = Data()
    private var confidences = Data()
    private var times: [Int64] = []
    private(set) var frameCount = 0

    init(directory: URL) throws {
        destination = directory.appendingPathComponent("depth.zip")
        partial = directory.appendingPathComponent(".depth.zip.partial")
        guard let handle = zipOpen64(partial.path, APPEND_STATUS_CREATE) else {
            throw CaptureError("Could not create the depth archive.")
        }
        zip = handle
    }

    deinit {
        if let zip { zipClose(zip, nil) }
    }

    func append(depth: CVPixelBuffer, confidence: CVPixelBuffer, timestampNS: Int64) throws {
        guard CVPixelBufferGetPixelFormatType(depth) == kCVPixelFormatType_DepthFloat32 else {
            throw CaptureError("Expected native Float32 depth.")
        }
        let next = Layout(width: CVPixelBufferGetWidth(depth), height: CVPixelBufferGetHeight(depth),
                          depthType: "f32le")
        guard CVPixelBufferGetWidth(confidence) == next.width,
              CVPixelBufferGetHeight(confidence) == next.height,
              CVPixelBufferGetPixelFormatType(confidence) == kCVPixelFormatType_OneComponent8 else {
            throw CaptureError("The confidence map does not match its depth frame.")
        }
        if next != layout || times.count >= 16 || depths.count + confidences.count >= 4 * 1024 * 1024 {
            try flush()
        }
        layout = next
        try copyRows(depth, bytesPerPixel: 4, into: &depths)
        try copyRows(confidence, bytesPerPixel: 1, into: &confidences)
        times.append(timestampNS)
        frameCount += 1
    }

    private func copyRows(_ buffer: CVPixelBuffer, bytesPerPixel: Int, into output: inout Data) throws {
        guard CVPixelBufferLockBaseAddress(buffer, .readOnly) == kCVReturnSuccess else {
            throw CaptureError("Could not lock a sensor frame.")
        }
        defer { CVPixelBufferUnlockBaseAddress(buffer, .readOnly) }
        let rowSize = CVPixelBufferGetWidth(buffer) * bytesPerPixel
        let stride = CVPixelBufferGetBytesPerRow(buffer)
        guard let address = CVPixelBufferGetBaseAddress(buffer), stride >= rowSize else {
            throw CaptureError("Invalid pixel buffer layout.")
        }
        let start = address.assumingMemoryBound(to: UInt8.self)
        for row in 0..<CVPixelBufferGetHeight(buffer) {
            output.append(start.advanced(by: row * stride), count: rowSize)
        }
    }

    private func write(_ name: String, _ data: Data) throws {
        guard let zip, zipOpenNewFileInZip64(zip, name, nil, nil, 0, nil, 0, nil,
                                             Z_DEFLATED, Z_BEST_SPEED, 0) == ZIP_OK else {
            throw CaptureError("Could not open a ZIP entry.")
        }
        let status = data.withUnsafeBytes { zipWriteInFileInZip(zip, $0.baseAddress, UInt32($0.count)) }
        let close = zipCloseFileInZip(zip)
        guard status == ZIP_OK, close == ZIP_OK else { throw CaptureError("Could not write a ZIP entry. Check device storage.") }
    }

    private func flush() throws {
        guard let layout, !times.isEmpty else { return }
        let first = frameCount - times.count
        let key = String(format: "%08d", first)
        try write("depth/\(key).\(layout.depthType)", depths)
        try write("confidence/\(key).u8", confidences)
        try write("index/\(key).json", JSONEncoder().encode(Index(firstFrame: first, layout: layout, timestampsNS: times)))
        times.removeAll(keepingCapacity: true)
        depths.removeAll(keepingCapacity: true)
        confidences.removeAll(keepingCapacity: true)
    }

    func finish(observedFrames: Int) throws {
        try flush()
        let manifest: [String: Any] = ["format": "ScanDesigner.depth", "version": 1, "frameCount": frameCount,
                                       "skippedFrames": observedFrames - frameCount, "depthUnit": "metre", "layout": "frame,row,column", "byteOrder": "little"]
        try write("manifest.json", JSONSerialization.data(withJSONObject: manifest))
        guard let handle = zip else { throw CaptureError("The archive is already closed.") }
        zip = nil
        guard zipClose(handle, nil) == ZIP_OK else { throw CaptureError("Could not finalize the depth archive.") }
        try FileManager.default.moveItem(at: partial, to: destination)
    }
}
