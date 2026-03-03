# ContractorPhotos MVP Prototype

This is a Vite + React application providing a functional MVP for the ContractorPhotos app.

## Features
- **Project Dashboard**: List of current active projects.
- **Project Gallery**: View photos isolated per project.
- **Custom Camera**: Bypasses native camera applications using WebRTC to grab the video feed and capture directly to an HTML5 Canvas.
- **Markup Tool**: Allows drawing natively on the canvas to highlight components (like network drops or tracing wirings) before appending a text note.
- **Local Persistence**: Photos and markups are encoded as Base64 strings and stored temporarily using `localStorage` and a mock DB structure.

## Setup Instructions

As this is a modern React project powered by Vite, you need **Node.js** installed on your machine to run it. 

### 1. Install Node.js
If you don't have Node installed, the easiest way on macOS is via Homebrew:
```bash
brew install node
```

### 2. Install Dependencies
Once Node is installed, navigate to the project directory and install the packages:
```bash
cd "Desktop/ContractorPhotos App"
npm install
```

### 3. Run the Development Server
```bash
npm run dev
```

### 4. Testing on Mobile
To verify the custom Camera routing and interactions on a real mobile device:
1. Ensure your phone and testing computer are on the same Wi-Fi network.
2. Run Vite with the `--host` flag to expose it: `npm run dev -- --host`
3. Open the "Network" IP address provided in your terminal in your phone's browser (e.g. `http://192.168.1.5:5173`).
4. **Note**: WebRTC `getUserMedia()` requires a secure context (HTTPS) or `localhost`. Since Vite runs HTTP locally, you may need to use a tunneling service (like Localtunnel or ngrok) if you want to test the camera strictly on a mobile device without tethering. 
   - Quick tunnel: `npx localtunnel --port 5173`

## Implementation Details
The app relies on `<video>` and `<canvas>` elements to capture images to prevent the device OS from capturing the photo and saving it to the native Camera Roll. This ensures high data privacy by saving images directly into the App's isolated database.
