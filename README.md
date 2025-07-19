# Claude Paste: Save Clipboard Image!

Save clipboard images instantly to your workspace for seamless referencing with Claude Code and other AI tools.

## 🚀 Features

- **One-Click Image Saving**: Press `Ctrl+Shift+V` (Windows/Linux) or `Cmd+Shift+V` (macOS) to save clipboard images
- **Smart Detection**: Automatically detects both image files and screenshot data in clipboard
- **Cross-Platform Support**: Works on Windows, WSL2, macOS, and Linux
- **Organized Storage**: Images saved to `temp/` folder with timestamped filenames
- **File Size Display**: Shows image size and provides easy path copying
- **Robust Error Handling**: Validates image integrity and provides helpful error messages

## 📋 How It Works

1. Copy any image to your clipboard (screenshot, copied image file, etc.)
2. Use `Ctrl+Shift+V` or run "Claude Paste: Save Clipboard Image" from command palette
3. Image is instantly saved to `temp/clipboard-image-YYYYMMDD_HHMMSS_fff.png`
4. Get notification with file path and size - click "Copy Path" to copy the relative path

Perfect for quickly saving images to reference in Claude Code conversations!

## 🔧 Requirements

### Windows & WSL2
- PowerShell (included with Windows)
- .NET Framework (usually pre-installed)

### macOS
- `pngpaste` utility: `brew install pngpaste`

### Linux
- **X11 systems**: `sudo apt-get install xclip`
- **Wayland systems**: `sudo apt-get install wl-clipboard`
- Auto-detects your display server (X11/Wayland)

## ⚙️ Usage

### Command Palette
1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Type "Claude Paste: Save Clipboard Image"
3. Press Enter

### Keyboard Shortcut
- Windows/Linux: `Ctrl+Shift+V`
- macOS: `Cmd+Shift+V`

## 🗂️ File Organization

Images are saved to:
```
your-workspace/
├── temp/
│   ├── clipboard-image-20250718_143052_123.png
│   ├── clipboard-image-20250718_143105_456.jpg
│   └── ...
```

Filename format: `clipboard-image-YYYYMMDD_HHMMSS_fff.{ext}`

## 🔍 Supported Platforms

- ✅ **Windows** - Native PowerShell support
- ✅ **WSL2** - Full Ubuntu/Windows integration  
- ✅ **macOS** - Via pngpaste utility
- ✅ **Linux** - X11 (xclip) and Wayland (wl-clipboard) support

## 🐛 Known Issues

- Large images (>50MB) are rejected for performance
- Requires active workspace folder
- Linux: Requires X11 (xclip) or Wayland (wl-clipboard) utilities

## 📝 Release Notes

### 1.0.0

- Initial release
- Full cross-platform support: Windows, WSL2, macOS, and Linux
- Smart clipboard detection for files and screenshots
- Auto-detects Linux display server (X11/Wayland)
- Robust error handling and file validation
- Smart filename generation with collision prevention

---

## 💡 Perfect for Claude Code Users

This extension was designed specifically for developers using Claude Code who need to quickly save and reference images in their conversations. No more manual saving - just copy, paste, and reference!

**Enjoy seamless image workflow with Claude Code! 🎉**
