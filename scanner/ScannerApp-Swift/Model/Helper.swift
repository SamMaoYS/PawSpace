import Foundation

enum Helper {
    static func getRecordingId() -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd HH-mm-ss"
        return formatter.string(from: Date()) + " " + UUID().uuidString.prefix(8)
    }
}
