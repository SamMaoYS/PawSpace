import QuickLook
import UIKit

final class LibraryTableViewController: UITableViewController, QLPreviewControllerDataSource {
    private let directory: URL
    private var items: [URL] = []
    private var preview: URL?

    init(directory: URL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]) {
        self.directory = directory
        super.init(style: .insetGrouped)
        title = directory == FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0] ? "Scan library" : directory.lastPathComponent
    }
    required init?(coder: NSCoder) { fatalError() }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        reloadFiles()
    }

    private func reloadFiles() {
        do {
            items = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.isDirectoryKey, .fileSizeKey], options: .skipsHiddenFiles)
                .sorted { $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedDescending }
            tableView.backgroundView = items.isEmpty ? message("No scans yet. Your local recordings will appear here.") : nil
        } catch { items = []; tableView.backgroundView = message(error.localizedDescription) }
        tableView.reloadData()
    }

    private func message(_ text: String) -> UILabel {
        let label = UILabel()
        label.text = text
        label.numberOfLines = 0
        label.textAlignment = .center
        label.textColor = .secondaryLabel
        return label
    }

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int { items.count }
    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "file") ?? UITableViewCell(style: .subtitle, reuseIdentifier: "file")
        let url = items[indexPath.row]
        var content = cell.defaultContentConfiguration()
        content.text = url.lastPathComponent
        content.textProperties.numberOfLines = 2
        content.image = UIImage(systemName: url.hasDirectoryPath ? "folder" : url.pathExtension == "mp4" ? "film" : url.pathExtension == "zip" ? "doc.zipper" : "doc.text")
        if let size = try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize, !url.hasDirectoryPath {
            content.secondaryText = ByteCountFormatter.string(fromByteCount: Int64(size), countStyle: .file)
        }
        cell.contentConfiguration = content
        cell.accessoryType = .disclosureIndicator
        return cell
    }
    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        let url = items[indexPath.row]
        if url.hasDirectoryPath {
            navigationController?.pushViewController(LibraryTableViewController(directory: url), animated: true)
        } else {
            preview = url
            let controller = QLPreviewController()
            controller.dataSource = self
            present(controller, animated: true)
        }
    }
    func numberOfPreviewItems(in controller: QLPreviewController) -> Int { preview == nil ? 0 : 1 }
    func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem { preview! as NSURL }
}
