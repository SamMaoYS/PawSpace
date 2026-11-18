# Run ScanDesigner

Open `ScannerApp-Swift.xcodeproj` in a version of Xcode supported by the Mac. Select the **ScanDesigner** scheme and an iPad simulator, then choose **Run**. Use **Preview scanner** to record synthetic frames and browse the resulting files locally.

For a physical device, choose a LiDAR-equipped iPad Pro or iPhone Pro running iOS or iPadOS 16 or later. Select the device as the run destination. In **Signing & Capabilities**, choose a development team and bundle identifier provisioned for the device. Run the app and allow camera access.

Use the same team and bundle identifier when updating an existing installation to retain its Documents directory. Xcode 26 or later enables the native glass capture button on supported systems.
