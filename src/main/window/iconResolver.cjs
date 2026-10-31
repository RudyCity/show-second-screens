const path = require('path');
const fs = require('fs');
const { app, nativeImage } = require('electron');

/**
 * Robust cross-platform Icon Resolver.
 * Resolves application and system tray icons across development,
 * packaged ASAR, unpacked resources, and portable execution contexts.
 */
class IconResolver {
  /**
   * Get physical file path to an icon.
   * @param {'ico'|'png'} preferredExt
   * @returns {string|null}
   */
  static getIconPath(preferredExt = 'png') {
    const isWin = process.platform === 'win32';
    const targetExt = isWin && preferredExt === 'ico' ? 'ico' : 'png';
    const fallbackExt = targetExt === 'ico' ? 'png' : 'ico';

    const fileNames = [`icon.${targetExt}`, `icon.${fallbackExt}`];

    for (const fileName of fileNames) {
      const candidates = [
        // 1. Unpacked ASAR (when packaged with electron-builder asarUnpack)
        process.resourcesPath
          ? path.join(process.resourcesPath, 'app.asar.unpacked', 'assets', fileName)
          : null,
        // 2. Resources directory
        process.resourcesPath
          ? path.join(process.resourcesPath, 'assets', fileName)
          : null,
        // 3. App Path (dev or asar)
        typeof app.getAppPath === 'function'
          ? path.join(app.getAppPath(), 'assets', fileName)
          : null,
        // 4. Relative to current file location
        path.resolve(__dirname, '../../../assets', fileName),
        path.resolve(__dirname, '../../../../assets', fileName),
        // 5. CWD fallback
        path.resolve(process.cwd(), 'assets', fileName),
      ].filter(Boolean);

      for (const candidate of candidates) {
        try {
          if (fs.existsSync(candidate)) {
            return candidate;
          }
        } catch (e) {
          // Ignore filesystem permission errors
        }
      }
    }

    return null;
  }

  /**
   * Get NativeImage for window icon.
   * @returns {Electron.NativeImage|null}
   */
  static getWindowIcon() {
    const iconPath = this.getIconPath(process.platform === 'win32' ? 'ico' : 'png');
    if (iconPath && fs.existsSync(iconPath)) {
      try {
        const img = nativeImage.createFromPath(iconPath);
        if (!img.isEmpty()) {
          return img;
        }
      } catch (err) {
        console.warn('[IconResolver] Failed to create nativeImage from path:', iconPath, err.message);
      }
    }
    return null;
  }

  /**
   * Get NativeImage or path for System Tray icon.
   * Guaranteed to return a valid non-empty tray representation.
   * @returns {Electron.NativeImage|string}
   */
  static getTrayIcon() {
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';

    // Prefer ICO on Windows if available, otherwise PNG
    const iconPath = this.getIconPath(isWin ? 'ico' : 'png');

    if (iconPath && fs.existsSync(iconPath)) {
      try {
        const img = nativeImage.createFromPath(iconPath);
        if (!img.isEmpty()) {
          const size = isMac ? 16 : isWin ? 16 : 22;
          const resized = img.resize({ width: size, height: size, quality: 'best' });
          if (isMac) {
            resized.setTemplateImage(true);
          }
          return resized;
        }
      } catch (err) {
        console.warn('[IconResolver] Failed to create tray nativeImage:', err.message);
      }
    }

    // Ultimate fallback: generate crisp 16x16 raw RGBA pixel buffer (guaranteed non-empty)
    return this.generateFallbackTrayIcon();
  }

  /**
   * Generates a sleek 16x16 RGBA monitor icon directly from raw memory buffer.
   * Ensures the system tray icon will NEVER be blank or invisible under any condition.
   * @returns {Electron.NativeImage}
   */
  static generateFallbackTrayIcon() {
    const width = 16;
    const height = 16;
    const buffer = Buffer.alloc(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const isMonitorBorder =
          ((y === 2 || y === 11) && x >= 1 && x <= 14) ||
          ((x === 1 || x === 14) && y >= 2 && y <= 11);
        const isStand = y >= 12 && y <= 13 && x >= 7 && x <= 8;
        const isBase = y === 14 && x >= 5 && x <= 10;
        const isScreenInner = y >= 4 && y <= 9 && x >= 3 && x <= 12;

        if (isMonitorBorder || isStand || isBase) {
          buffer[idx] = 34; // R (#22c55e)
          buffer[idx + 1] = 197; // G
          buffer[idx + 2] = 94; // B
          buffer[idx + 3] = 255; // A
        } else if (isScreenInner) {
          buffer[idx] = 6; // R (#06b6d4)
          buffer[idx + 1] = 182; // G
          buffer[idx + 2] = 212; // B
          buffer[idx + 3] = 180; // A
        } else {
          buffer[idx + 3] = 0; // Transparent
        }
      }
    }

    return nativeImage.createFromBuffer(buffer, { width, height });
  }
}

module.exports = { IconResolver };
