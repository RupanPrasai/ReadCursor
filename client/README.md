# ReadCursor

**ReadCursor** is a Chrome extension that overlays a reading cursor on any webpage, helping you read faster and more deliberately by highlighting text and advancing at a configurable words-per-minute (WPM) pace.

It works directly on live page content and provides a lightweight, draggable control panel for playback-style reading control.

---

## Features

- **Reading cursor overlay**  
  Highlights text directly on webpages to guide focus while reading.

- **WPM-based auto-advance**  
  Progress through text at a configurable reading speed.

- **Playback controls**  
  Play, pause, skip forward/backward, and adjust speed in real time.

- **Draggable control panel**  
  Move and resize the reader panel without disrupting page layout.

- **Works on most webpages**  
  Operates on standard article and text-heavy pages without requiring special formats.

---

## Installation

### Chrome (Development / Unpacked)

1. Clone the repository:
   ```bash
   git clone https://github.com/RupanPrasai/ReadCursor.git
   cd ReadCursor
   ```

2. Install dependencies:
    ```bash
    pnpm install
    ```

3. Build the extension:
    ```bash
    pnpm build
    ```

4. Open Chrome and navigate to:
    ```bash
        chrome://extensions
    ```

5. Enable **Developer mode** (top right).

6. Click **Load unpacked** and select the generated `dist` directory.

## Usage
1. Navigate to a webpage with readable text.
2. Open ReadCursor from the browser toolbar.
3. Start playback to activate the reading cursor.
4. Adjust WPM, pause, or skip using the control panel.
5. Right click on any word on the webpage to "Start from here".

## Tech Stack
- React
- TypeScript
- Vite
- Tailwind CSS
- Turborepo
- Chrome Extensions (Manifest V3)

## Status
- **Version**: 1.0.0
- Actively developed
- Initial public release

## License
MIT © Rupan Prasai
