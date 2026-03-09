# iOS Deployment Guide (New Device)

I have already built the latest code and synced it to your Xcode project. You just need to follow these steps in Xcode:

### 1. Connect the Device
- Connect the destination iPhone to your Mac using a USB cable.
- If the phone asks, tap **Trust** and enter the passcode.

### 2. Open the Project in Xcode
I have prepared the project. You can open it by clicking the file in your `ios/App/` folder named `App.xcworkspace`.

### 3. Run on Device
1. **Select Target Device**: At the very top of the Xcode window, click where it says "App > [Device Name]" and select the newly connected iPhone from the list.
2. **Run**: Click the **Play** button (a triangular icon) in the top-left corner.

### 4. Final Step on Phone
Once the app installs, you might see an "Untrusted Developer" message.
- On the phone, go to **Settings > General > VPN & Device Management**.
- Tap your developer email/ID.
- Tap **Trust**.
