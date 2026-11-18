import AVFoundation

/// One unpublished session directory, committed only after both the ZIP and MP4 close.
final class RGBDScan {
    private static let stagingPrefix = ".scandesigner-recording-"
    private let directory: URL
    private let destination: URL
    private let cameraFile: FileHandle
    private let depth: DepthArchive
    private var movie: RGBMovieWriter?
    private let encoder = JSONEncoder()

    init(documents: URL, name: String) throws {
        destination = documents.appendingPathComponent(name, isDirectory: true)
        directory = documents.appendingPathComponent(Self.stagingPrefix + name, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
        do {
            depth = try DepthArchive(directory: directory)
            let url = directory.appendingPathComponent("camera.jsonl")
            try Data().write(to: url)
            cameraFile = try FileHandle(forWritingTo: url)
        } catch {
            try? FileManager.default.removeItem(at: directory)
            throw error
        }
        encoder.keyEncodingStrategy = .convertToSnakeCase
    }

    /// A process termination can leave a staging folder. Make it accessible in Files on relaunch.
    static func recoverInterruptedScans(in documents: URL) throws {
        let entries = try FileManager.default.contentsOfDirectory(at: documents, includingPropertiesForKeys: [.isDirectoryKey])
        for url in entries where url.lastPathComponent.hasPrefix(stagingPrefix) && url.hasDirectoryPath {
            try publishIncomplete(url)
        }
    }

    private static func publishIncomplete(_ directory: URL) throws {
        let manager = FileManager.default
        let name = String(directory.lastPathComponent.dropFirst(stagingPrefix.count))
        let output = directory.deletingLastPathComponent().appendingPathComponent("Incomplete " + name)
        let partial = directory.appendingPathComponent(".depth.zip.partial")
        if manager.fileExists(atPath: partial.path) {
            try manager.moveItem(at: partial, to: directory.appendingPathComponent("depth.zip.partial"))
        }
        try manager.moveItem(at: directory, to: output)
    }

    @discardableResult
    func append(color: CVPixelBuffer, depth map: CVPixelBuffer, confidence: CVPixelBuffer,
                time: CMTime, camera: CameraInfo) throws -> Bool {
        if movie == nil {
            movie = try RGBMovieWriter(url: directory.appendingPathComponent("rgb.mp4"),
                                       width: CVPixelBufferGetWidth(color), height: CVPixelBufferGetHeight(color))
        }
        guard try movie?.append(color, at: time) == true else { return false }
        let nanoseconds = CMTimeConvertScale(time, timescale: 1_000_000_000, method: .default).value
        try depth.append(depth: map, confidence: confidence, timestampNS: nanoseconds)
        var line = try encoder.encode(camera)
        line.append(10)
        try cameraFile.write(contentsOf: line)
        return true
    }

    func finish(observedFrames: Int, priorError: Error?, completion: @escaping (Result<URL, Error>) -> Void) {
        var failure = priorError
        do {
            try cameraFile.close()
            if failure == nil { try depth.finish(observedFrames: observedFrames) }
        } catch { failure = failure ?? error }
        let publish: (Error?) -> Void = { [self] movieError in
            do {
                if let error = failure ?? movieError {
                    if depth.frameCount == 0 {
                        try FileManager.default.removeItem(at: directory)
                    } else {
                        try Self.publishIncomplete(directory)
                    }
                    throw error
                }
                try FileManager.default.moveItem(at: directory, to: destination)
                completion(.success(destination))
            } catch { completion(.failure(error)) }
        }
        if let movie { movie.finish(publish) } else { publish(CaptureError("No complete RGB-D frames were recorded.")) }
    }
}
