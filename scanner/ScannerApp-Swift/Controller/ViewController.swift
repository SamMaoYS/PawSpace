import ARKit
import SwiftUI

final class ViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        navigationItem.backButtonTitle = "Studio"
        let home = StudioHome(open: { [weak self] in self?.open() }, browse: { [weak self] in
            self?.navigationController?.pushViewController(LibraryTableViewController(), animated: true)
        })
        let host = UIHostingController(rootView: home)
        addChild(host)
        host.view.frame = view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(host.view)
        host.didMove(toParent: self)
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        navigationController?.setNavigationBarHidden(true, animated: animated)
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        navigationController?.setNavigationBarHidden(false, animated: animated)
    }

    private func open() {
        #if targetEnvironment(simulator)
        navigationController?.pushViewController(LiDARViewController(), animated: true)
        #else
        AVCaptureDevice.requestAccess(for: .video) { allowed in
            DispatchQueue.main.async { [weak self] in
                guard let self, self.navigationController?.topViewController === self else { return }
                guard allowed else {
                    let alert = UIAlertController(title: "Camera access needed", message: "Allow camera access for ScanDesigner in Settings to capture a scan.", preferredStyle: .alert)
                    alert.addAction(UIAlertAction(title: "Settings", style: .default) { _ in
                        if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
                    })
                    alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
                    self.present(alert, animated: true)
                    return
                }
                let camera = LiDARViewController()
                self.navigationController?.pushViewController(camera, animated: true)
            }
        }
        #endif
    }
}

private struct StudioHome: View {
    let open: () -> Void
    let browse: () -> Void
    private var supported: Bool {
        #if targetEnvironment(simulator)
        true
        #else
        ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth)
        #endif
    }
    @Environment(\.dynamicTypeSize) private var typeSize
    private let ink = Color(red: 0.06, green: 0.16, blue: 0.17)
    private let mint = Color(red: 0.80, green: 0.96, blue: 0.73)
    private let paper = Color(red: 0.96, green: 0.96, blue: 0.93)

    var body: some View {
        GeometryReader { geometry in
            let wide = geometry.size.width > 690 && !typeSize.isAccessibilitySize
            ScrollView {
                VStack(alignment: .leading, spacing: wide ? 28 : 20) {
                    HStack(spacing: 10) {
                        artwork("ScanMark").resizable().accessibilityHidden(true).frame(width: 39, height: 39).clipShape(RoundedRectangle(cornerRadius: 10))
                        Text("ScanDesigner").font(.title3.weight(.bold))
                        Spacer(minLength: 12)
                        artwork("HKUST").resizable().scaledToFit().frame(width: wide ? 182 : 106, height: wide ? 57 : 34)
                            .accessibilityLabel("The Hong Kong University of Science and Technology")
                    }
                    Divider()
                    Text("Capture studio").font(.system(size: wide ? 48 : 34, weight: .semibold)).tracking(-1.6)
                        .accessibilityAddTraits(.isHeader)
                    Group {
                        if wide && geometry.size.width >= geometry.size.height {
                            HStack(spacing: 0) {
                                captureControls.padding(36).frame(maxWidth: .infinity, alignment: .leading)
                                specimen.frame(maxWidth: .infinity)
                            }
                        } else {
                            VStack(alignment: .leading, spacing: 0) {
                                specimen.frame(height: wide ? 320 : 170).padding(.top, wide ? 18 : 8)
                                captureControls.padding(wide ? 30 : 22)
                            }
                        }
                    }
                    .foregroundStyle(.white)
                    .background(LinearGradient(colors: [ink, Color(red: 0.09, green: 0.23, blue: 0.23)], startPoint: .leading, endPoint: .trailing))
                    .clipShape(RoundedRectangle(cornerRadius: 26))
                    Button(action: browse) {
                        HStack(spacing: 16) {
                            Image(systemName: "folder").font(.title2).frame(width: 56, height: 56)
                                .background(ink.opacity(0.07), in: RoundedRectangle(cornerRadius: 16))
                            VStack(alignment: .leading, spacing: 5) {
                                Text("Scan library").font(.title3.bold())
                                Text("Browse recordings saved on this device.").font(.subheadline).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: "arrow.up.right").font(.headline)
                        }.padding(20).frame(maxWidth: .infinity, alignment: .leading)
                            .background(.white, in: RoundedRectangle(cornerRadius: 20))
                    }.buttonStyle(.plain)
                    Label("Files  /  On My \(UIDevice.current.userInterfaceIdiom == .pad ? "iPad" : "iPhone")  /  ScanDesigner",
                          systemImage: "internaldrive").font(.footnote.monospaced()).foregroundStyle(.secondary)
                }.frame(maxWidth: 1150).padding(.horizontal, wide ? 48 : 20).padding(.vertical, wide ? 32 : 16)
                    .frame(maxWidth: .infinity)
            }
        }.background(paper.ignoresSafeArea()).foregroundStyle(ink).environment(\.colorScheme, .light)
    }

    private func artwork(_ name: String) -> Image {
        Image(uiImage: UIImage(named: name) ?? UIImage())
    }

    private var specimen: some View {
        artwork("RoomCloud").resizable().scaledToFit().accessibilityHidden(true)
            .frame(maxWidth: .infinity, maxHeight: 320)
    }

    private var captureControls: some View {
        VStack(alignment: .leading, spacing: 15) {
            Label("LiDAR + RGB", systemImage: "sensor.tag.radiowaves.forward")
                .font(.subheadline.monospaced().weight(.semibold)).foregroundStyle(mint)
            Text("Spatial scan")
                .font(.system(.largeTitle, design: .rounded).weight(.semibold))
            Text(supported ? "Record RGB video with synchronized depth and confidence maps." : "Spatial capture requires a device with a LiDAR Scanner.").font(.body).foregroundStyle(.white.opacity(0.80)).fixedSize(horizontal: false, vertical: true)
            openButton.padding(.top, 7)
        }
    }

    @ViewBuilder private var openButton: some View {
        #if targetEnvironment(simulator)
        let label = "Preview scanner"
        #else
        let label = "Open camera"
        #endif
        let button = Button { open() } label: {
            Label(label, systemImage: "viewfinder").font(.headline).padding(.horizontal, 8).padding(.vertical, 4)
        }.disabled(!supported)
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            button.buttonStyle(.glassProminent).tint(mint).foregroundStyle(ink)
        } else {
            button.buttonStyle(.borderedProminent).buttonBorderShape(.capsule).tint(mint).foregroundStyle(ink)
        }
        #else
        button.buttonStyle(.borderedProminent).buttonBorderShape(.capsule).tint(mint).foregroundStyle(ink)
        #endif
    }
}

#if DEBUG
private struct StudioHome_Previews: PreviewProvider {
    static var previews: some View { StudioHome(open: {}, browse: {}) }
}
#endif
