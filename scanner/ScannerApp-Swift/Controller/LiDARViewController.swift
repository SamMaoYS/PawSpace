import ARKit
import RealityKit
import UIKit

final class LiDARViewController: UIViewController, ARSessionDelegate {
    private let pipeline = DispatchQueue(label: "ScanDesigner.capture")
    // Absorb short ZIP flushes without allowing retained camera buffers to grow with scan duration.
    private let slot = DispatchSemaphore(value: 3)
    private var scan: RGBDScan? // pipeline only
    private var session: ARSession?
    private var recording = false // UI and ARSession callbacks are on main
    private var finishing = false
    private var ready = false
    private let trigger = UIButton(type: .system)
    private let status = UILabel()
    private var simulatedTimer: Timer?
    private var observedFrames = 0
    private var startedAt = Date()
    #if targetEnvironment(simulator)
    private var sampleNumber = 0
    private let previewImage = UIImageView(image: UIImage(named: "RoomCloud"))
    private let simulatedRoom = UIImage(named: "RoomCloud")?.cgImage
    #endif

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.04, green: 0.11, blue: 0.12, alpha: 1)
        title = "LiDAR capture"
        #if targetEnvironment(simulator)
        title = "Simulator preview"
        previewImage.contentMode = .scaleAspectFit
        installPreview(previewImage)
        ready = true
        #else
        let preview = ARView(frame: .zero, cameraMode: .ar, automaticallyConfigureSession: false)
        preview.debugOptions.insert(.showSceneUnderstanding)
        session = preview.session
        session?.delegate = self
        session?.delegateQueue = .main
        installPreview(preview)
        #endif

        status.textColor = .white
        status.font = .preferredFont(forTextStyle: .subheadline)
        status.textAlignment = .center
        status.numberOfLines = 0
        var config = UIButton.Configuration.filled()
        config.cornerStyle = .capsule
        config.baseBackgroundColor = .white
        config.baseForegroundColor = .black
        config.imagePadding = 10
        config.contentInsets = .init(top: 14, leading: 26, bottom: 14, trailing: 26)
        trigger.configuration = config
        trigger.addTarget(self, action: #selector(toggleRecording), for: .touchUpInside)
        let controls = UIStackView(arrangedSubviews: [status, trigger])
        controls.axis = .vertical
        controls.alignment = .center
        controls.spacing = 12
        let panel = UIVisualEffectView(effect: UIBlurEffect(style: .systemUltraThinMaterialDark))
        panel.layer.cornerRadius = 22
        panel.clipsToBounds = true
        panel.contentView.addSubview(controls)
        view.addSubview(panel)
        panel.translatesAutoresizingMaskIntoConstraints = false
        controls.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            panel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            panel.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -20),
            panel.widthAnchor.constraint(lessThanOrEqualTo: view.safeAreaLayoutGuide.widthAnchor, constant: -24),
            controls.leadingAnchor.constraint(equalTo: panel.contentView.leadingAnchor, constant: 24),
            controls.trailingAnchor.constraint(equalTo: panel.contentView.trailingAnchor, constant: -24),
            controls.topAnchor.constraint(equalTo: panel.contentView.topAnchor, constant: 16),
            controls.bottomAnchor.constraint(equalTo: panel.contentView.bottomAnchor, constant: -16)
        ])
        updateControls()
        NotificationCenter.default.addObserver(self, selector: #selector(suspendCapture), name: UIApplication.willResignActiveNotification, object: nil)
    }

    private func installPreview(_ preview: UIView) {
        preview.frame = view.bounds
        preview.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(preview)
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        UIApplication.shared.isIdleTimerDisabled = true
        if let session {
            ready = false
            updateControls()
            let config = ARWorldTrackingConfiguration()
            config.frameSemantics = .sceneDepth
            if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
                config.sceneReconstruction = .mesh
            }
            session.run(config)
        }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        suspendCapture()
        session?.pause()
        UIApplication.shared.isIdleTimerDisabled = false
    }

    private func updateControls() {
        trigger.configuration?.title = finishing ? "Saving…" : recording ? "Stop & save" : "Record scan"
        trigger.configuration?.image = UIImage(systemName: recording ? "stop.fill" : "record.circle")
        trigger.isEnabled = !finishing && (ready || recording)
        navigationItem.hidesBackButton = recording || finishing
        navigationController?.interactivePopGestureRecognizer?.isEnabled = !(recording || finishing)
        #if targetEnvironment(simulator)
        status.text = recording ? "Recording synthetic frames" : "Synthetic RGB, depth and confidence"
        #else
        status.text = recording ? "Recording RGB, depth and confidence" : ready ? "LiDAR ready" : "Waiting for LiDAR frames…"
        #endif
    }

    @objc private func toggleRecording() {
        if recording { stop(); return }
        guard ready, !finishing else { return }
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        #if targetEnvironment(simulator)
        let name = "Preview " + Helper.getRecordingId()
        #else
        let name = "Scan " + Helper.getRecordingId()
        #endif
        do {
            let newScan = try RGBDScan(documents: documents, name: name)
            pipeline.sync { scan = newScan }
            recording = true
            observedFrames = 0
            startedAt = Date()
            #if targetEnvironment(simulator)
            sampleNumber = 0
            simulatedTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 15, repeats: true) { [weak self] _ in self?.simulateFrame() }
            #endif
            updateControls()
        } catch { alert(title: "Could not start scan", message: error.localizedDescription) }
    }

    @objc private func suspendCapture() {
        if recording { stop() }
    }

    private func stop(error: Error? = nil) {
        guard recording else { return }
        recording = false
        finishing = true
        simulatedTimer?.invalidate()
        simulatedTimer = nil
        updateControls()
        var backgroundTask = UIBackgroundTaskIdentifier.invalid
        backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "Finish local scan")
        let total = observedFrames
        pipeline.async { [self] in
            guard let current = scan else { return }
            scan = nil
            let failure = captureFailure ?? error
            captureFailure = nil
            current.finish(observedFrames: total, priorError: failure) { result in
                DispatchQueue.main.async { [self] in
                    if backgroundTask != .invalid { UIApplication.shared.endBackgroundTask(backgroundTask) }
                    finishing = false
                    updateControls()
                    guard viewIfLoaded?.window != nil else { return }
                    switch result {
                    case .success(let url):
                        let sheet = UIAlertController(title: "Scan saved", message: url.lastPathComponent, preferredStyle: .alert)
                        sheet.addAction(UIAlertAction(title: "View files", style: .default) { [weak self] _ in
                            self?.navigationController?.pushViewController(LibraryTableViewController(directory: url), animated: true)
                        })
                        sheet.addAction(UIAlertAction(title: "Done", style: .cancel))
                        present(sheet, animated: true)
                    case .failure(let error): alert(title: "Scan could not finish", message: error.localizedDescription)
                    }
                }
            }
        }
    }

    private var captureFailure: Error? // pipeline only

    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        guard let depth = frame.sceneDepth, let confidence = depth.confidenceMap else {
            if recording { observedFrames += 1 }
            return
        }
        if !ready { ready = true; updateControls() }
        guard recording else { return }
        let info = CameraInfo(timestamp: frame.timestamp, intrinsics: frame.camera.intrinsics,
                              transform: frame.camera.transform, eulerAngles: frame.camera.eulerAngles,
                              exposureDuration: frame.camera.exposureDuration)
        submit(color: frame.capturedImage, depth: depth.depthMap, confidence: confidence, time: frame.timestamp, info: info)
    }

    private func submit(color: CVPixelBuffer, depth: CVPixelBuffer, confidence: CVPixelBuffer, time: Double, info: CameraInfo) {
        observedFrames += 1
        if observedFrames % 15 == 0 {
            let seconds = max(0, Int(Date().timeIntervalSince(startedAt)))
            status.text = String(format: "%02d:%02d  ·  Recording RGB-D", seconds / 60, seconds % 60)
        }
        guard slot.wait(timeout: .now()) == .success else { return }
        pipeline.async { [self] in
            defer { slot.signal() }
            guard let scan, captureFailure == nil else { return }
            do {
                try scan.append(color: color, depth: depth, confidence: confidence,
                                time: CMTime(value: Int64(time * 1e9), timescale: 1_000_000_000), camera: info)
            } catch {
                captureFailure = error
                DispatchQueue.main.async { self.stop(error: error) }
            }
        }
    }

    func sessionWasInterrupted(_ session: ARSession) {
        ready = false
        suspendCapture()
        updateControls()
    }

    func session(_ session: ARSession, didFailWithError error: Error) {
        ready = false
        if recording { stop(error: error) }
        else { updateControls(); alert(title: "Camera unavailable", message: error.localizedDescription) }
    }

    private func alert(title: String, message: String) {
        let sheet = UIAlertController(title: title, message: message, preferredStyle: .alert)
        sheet.addAction(UIAlertAction(title: "OK", style: .default))
        present(sheet, animated: true)
    }
}

#if targetEnvironment(simulator)
extension LiDARViewController {
    private func simulateFrame() {
        let n = sampleNumber
        sampleNumber += 1
        // Deterministic test pattern, with the same writer and frame admission as ARKit.
        func make(_ width: Int, _ height: Int, _ format: OSType, fill: (UnsafeMutableRawPointer, Int) -> Void) -> CVPixelBuffer? {
            var buffer: CVPixelBuffer?
            guard CVPixelBufferCreate(nil, width, height, format, [kCVPixelBufferIOSurfacePropertiesKey: [:]] as CFDictionary, &buffer) == kCVReturnSuccess,
                  let buffer, CVPixelBufferLockBaseAddress(buffer, []) == kCVReturnSuccess else { return nil }
            defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
            guard let base = CVPixelBufferGetBaseAddress(buffer) else { return nil }
            for row in 0..<height { fill(base.advanced(by: row * CVPixelBufferGetBytesPerRow(buffer)), row) }
            return buffer
        }
        guard let room = simulatedRoom else { stop(error: CaptureError("Missing simulator artwork.")); return }
        let width = 480, height = 304
        var colorBuffer: CVPixelBuffer?
        let options = [kCVPixelBufferIOSurfacePropertiesKey: [:]] as CFDictionary
        guard CVPixelBufferCreate(nil, width, height, kCVPixelFormatType_32BGRA, options, &colorBuffer) == kCVReturnSuccess,
              let rgb = colorBuffer, CVPixelBufferLockBaseAddress(rgb, []) == kCVReturnSuccess else {
            stop(error: CaptureError("Could not allocate a simulator RGB frame.")); return
        }
        let bitmapInfo = CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.noneSkipFirst.rawValue
        let context = CGContext(data: CVPixelBufferGetBaseAddress(rgb), width: width, height: height,
                                bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(rgb),
                                space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: bitmapInfo)
        if let context {
            let bounds = CGRect(x: 0, y: 0, width: width, height: height)
            context.setFillColor(UIColor(red: 0.04, green: 0.11, blue: 0.12, alpha: 1).cgColor)
            context.fill(bounds)
            context.draw(room, in: bounds)
            context.setFillColor(UIColor(red: 0.76, green: 1, blue: 0.80, alpha: 0.68).cgColor)
            context.fill(CGRect(x: 0, y: (n * 3) % height, width: width, height: 1))
            previewImage.image = context.makeImage().map { UIImage(cgImage: $0) }
        }
        CVPixelBufferUnlockBaseAddress(rgb, [])
        guard context != nil, let depth = make(64, 48, kCVPixelFormatType_DepthFloat32, fill: { address, y in
            let row = address.assumingMemoryBound(to: Float.self)
            for x in 0..<64 { row[x] = 1 + Float(x + y + n) / 1000 }
        }), let confidence = make(64, 48, kCVPixelFormatType_OneComponent8, fill: { address, y in
            let row = address.assumingMemoryBound(to: UInt8.self)
            for x in 0..<64 { row[x] = UInt8((x + y + n) % 3) }
        }) else { stop(error: CaptureError("Could not allocate a simulator frame.")); return }
        let time = Double(n) / 15
        let info = CameraInfo(timestamp: time, intrinsics: matrix_identity_float3x3, transform: matrix_identity_float4x4,
                              eulerAngles: .zero, exposureDuration: 1 / 60)
        submit(color: rgb, depth: depth, confidence: confidence, time: time, info: info)
    }
}
#endif
