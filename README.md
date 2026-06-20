# Warid (وارِد)

**[Website](https://mohamedmaslooh.github.io/Warid/) · [Releases](https://github.com/mohamedmaslooh/Warid/releases) · [Issues](https://github.com/mohamedmaslooh/Warid/issues)**

Open-source desktop app that records your voice and sends it directly to Google Gemini for transcription, translation, or any custom output you define via prompt templates.

Gemini is natively multimodal and understands virtually every spoken language in the world. Speak in Arabic, English, French, Japanese, Spanish, or any other language, and Warid will produce text in whatever language and format your template specifies. The language behavior is entirely up to you.

Visit the [website](https://mohamedmaslooh.github.io/Warid/) for a visual overview and direct download links.

## Features

- **Record from microphone** or upload an audio file
- **Any language, any output:** speak in one language, get text in another. Gemini supports 100+ languages natively
- **Custom prompt templates,** each with its own output language and Gemini model
- **Streaming output:** text appears word by word as Gemini generates it
- **Auto-copy to clipboard** when transcription finishes
- **Global hotkey (Ctrl+Alt+R):** record from anywhere, even when the app is minimized
- **System tray:** keep Warid running silently in the background
- **History:** local SQLite store of past transcriptions, fully searchable
- **Editable output:** fix anything before copying
- **Privacy-first:** audio goes directly to Google using your own key, no third-party server, no analytics
- **API key stored securely** in the OS keychain

## Installation

Download from the [website](https://mohamedmaslooh.github.io/Warid/) or directly from the [Releases page](https://github.com/mohamedmaslooh/Warid/releases):

| Platform | File |
|----------|------|
| Windows | `.exe` setup file or `.msi` installer |
| macOS | `.dmg` (Apple Silicon or Intel) |
| Linux | `.AppImage` (portable) or `.deb` (Debian/Ubuntu) |

### macOS first launch

Warid is open-source and distributed **unsigned** — it is not enrolled in Apple's paid Developer Program, so it is not notarized. macOS Gatekeeper blocks it on first launch, and **there is a required one-time step to open it.** (This step cannot be avoided without Apple notarization.)

The build is ad-hoc signed, so you should *not* get the dead-end *"Warid is damaged"* error — but you will still see a Gatekeeper warning. Use whichever method matches your macOS version:

**Most reliable (works on every macOS version) — Terminal:**

```bash
xattr -cr /Applications/Warid.app
```

Then open Warid normally. (Run it once after moving the app into `/Applications`.)

**macOS 15 (Sequoia) / macOS 26 (Tahoe) and later:** Right-click → Open was removed in these versions. Double-click Warid, dismiss the warning, then go to **System Settings → Privacy & Security**, scroll to the bottom, and click **Open Anyway** (if shown). If it isn't shown, use the Terminal command above.

**macOS 14 (Sonoma) and earlier:** Right-click (or Control-click) `Warid.app` → **Open** → **Open** in the dialog.

## Getting an API Key

1. Go to [aistudio.google.com](https://aistudio.google.com/apikey)
2. Click **Get API key** and create one in a new project
3. Copy the key
4. Open Warid, go to Settings, and paste the key

The free tier is generous and covers most personal use entirely.

## Language Support

Warid works with any language Gemini understands, which covers virtually every major language in the world. You can:

- Speak in Arabic and get a polished English output
- Speak in French and get a structured Arabic transcript
- Mix two languages in the same sentence and get a clean result in either
- Dictate in one language and receive output formatted in a completely different one

The language behavior is defined entirely by your prompt template, giving you full control over both input and output.

## Templates

Warid ships with a **Coding Assistant** template designed for developers who dictate tasks. It turns mixed-language speech into a clean, structured brief in English.

You can add unlimited custom templates from the Templates page. Each template controls:

- The prompt body (what Gemini does with the audio)
- Output language
- Gemini model (default: `gemini-3.1-flash-lite`)

Import and export templates as JSON to share with others. The `templates/` folder in this repo has community examples.

## Building from Source

Requirements:
- Node.js 18+
- Rust 1.75+
- (Windows) Visual Studio Build Tools with C++ workload
- (Linux) `webkit2gtk-4.1`, `libsoup-3.0`, `libappindicator3-dev`

```bash
git clone https://github.com/mohamedmaslooh/Warid.git
cd Warid
npm install
npm run tauri dev      # development
npm run tauri build    # build installer
```

The installer ends up in `src-tauri/target/release/bundle/`.

## Architecture

- **Tauri 2:** Rust backend, ~10 MB bundle, ~30 MB RAM at idle
- **React 18 + TypeScript + Vite:** UI rendered in the system webview
- **Tailwind CSS 3:** sharp/corporate design, Noto Kufi Arabic font
- **@google/generative-ai:** Gemini SDK called directly from the frontend with the user's own API key
- **SQLite** (via tauri-plugin-sql): local templates and history storage
- **Web Audio API + MediaRecorder:** webm/opus audio capture

The Gemini API call happens entirely in the frontend. The Rust backend handles the global hotkey, system tray, and keychain access.

## Contributing

Pull requests are welcome. For larger changes, open an issue first to discuss the direction.

To contribute a community template, add a JSON file under `templates/` and open a PR.

## License

MIT. See [LICENSE](LICENSE).
