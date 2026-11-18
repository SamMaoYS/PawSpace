import AVFoundation

/// Called on the capture queue. Backpressure skips the whole RGB-D tuple.
final class RGBMovieWriter {
    private let writer: AVAssetWriter
    private let input: AVAssetWriterInput
    private let adaptor: AVAssetWriterInputPixelBufferAdaptor
    private(set) var frameCount = 0

    init(url: URL, width: Int, height: Int) throws {
        writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
        input = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width, AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: [AVVideoAllowFrameReorderingKey: false]
        ])
        input.expectsMediaDataInRealTime = true
        input.mediaTimeScale = 90_000
        adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: nil)
        guard writer.canAdd(input) else { throw CaptureError("H.264 is unavailable for this resolution.") }
        writer.add(input)
    }

    func append(_ pixelBuffer: CVPixelBuffer, at time: CMTime) throws -> Bool {
        if writer.status == .unknown {
            guard writer.startWriting() else { throw writer.error ?? CaptureError("Could not start the RGB movie.") }
            writer.startSession(atSourceTime: time)
        }
        guard writer.status == .writing else { throw writer.error ?? CaptureError("The RGB movie stopped writing.") }
        guard input.isReadyForMoreMediaData else { return false }
        guard adaptor.append(pixelBuffer, withPresentationTime: time) else {
            throw writer.error ?? CaptureError("Could not append an RGB frame.")
        }
        frameCount += 1
        return true
    }

    func finish(_ completion: @escaping (Error?) -> Void) {
        guard frameCount > 0, writer.status == .writing else {
            let error = writer.error ?? CaptureError("No complete RGB-D frames were recorded.")
            if writer.status == .writing { writer.cancelWriting() }
            completion(error)
            return
        }
        input.markAsFinished()
        writer.finishWriting { [writer] in
            completion(writer.status == .completed ? nil : writer.error ?? CaptureError("Could not finish the RGB movie."))
        }
    }
}
