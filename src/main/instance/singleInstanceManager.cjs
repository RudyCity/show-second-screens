const { app, dialog } = require('electron');
const { execSync } = require('child_process');

/**
 * Single Instance Manager
 * Ensures only one instance of the application runs at any time.
 * If another instance is already running (e.g. portable executable or background tray),
 * displays a confirmation dialog asking the user whether to kill the existing instance.
 */
class SingleInstanceManager {
  constructor() {
    this.gotLock = false;
    this.windowManager = null;
  }

  /**
   * Set window manager reference so second instance attempts can focus existing window.
   * @param {object} windowManager
   */
  setWindowManager(windowManager) {
    this.windowManager = windowManager;
  }

  /**
   * Request initial single-instance lock from Electron.
   * Should be called before app.whenReady().
   * @returns {boolean} True if lock acquired, false if another instance holds the lock.
   */
  requestInitialLock() {
    this.gotLock = app.requestSingleInstanceLock();
    if (this.gotLock) {
      this.registerSecondInstanceListener();
    }
    return this.gotLock;
  }

  /**
   * Register listener to restore/focus window when a second instance tries to launch.
   */
  registerSecondInstanceListener() {
    app.on('second-instance', () => {
      console.log('[SingleInstanceManager] Another instance detected. Bringing the running window to the foreground.');
      if (this.windowManager) {
        const win = this.windowManager.getWindow();
        if (win) {
          if (win.isMinimized()) {
            win.restore();
          }
          win.show();
          win.focus();
        }
      }
    });
  }

  /**
   * Handle conflict when requestInitialLock() returned false.
   * Shows confirmation dialog asking user whether to kill existing instance.
   *
   * @returns {Promise<boolean>} True if caller should proceed to initialize, false if exiting/relaunched.
   */
  async handleLockConflict() {
    console.log('[SingleInstanceManager] Another instance detected. Showing confirmation dialog.');

    const choice = dialog.showMessageBoxSync({
      type: 'warning',
      buttons: ['Stop Existing & Restart', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
      title: 'Show Second Screens',
      message: 'Show Second Screens is already running.',
      detail:
        'An existing Show Second Screens instance is already running on this computer.\n\n' +
        'Do you want to stop the existing instance and launch a new one?',
      noLink: true,
    });

    if (choice === 1) {
      // User cancelled
      console.log('[SingleInstanceManager] User cancelled starting a new instance.');
      app.exit(0);
      return false;
    }

    // User confirmed: Kill existing instances
    console.log('[SingleInstanceManager] Confirmed: stopping the existing instance...');
    this.killExistingInstances();

    // Brief pause to allow OS process termination and handle release
    await new Promise((resolve) => setTimeout(resolve, 350));

    // Try to reacquire single instance lock in current process
    const reacquired = app.requestSingleInstanceLock();
    if (reacquired) {
      console.log('[SingleInstanceManager] The current process successfully acquired the instance lock.');
      this.gotLock = true;
      this.registerSecondInstanceListener();
      return true;
    }

    // If lock cannot be re-acquired in existing process, relaunch cleanly
    console.log('[SingleInstanceManager] Relaunching the app to ensure a clean instance state...');
    this.relaunchApp();
    return false;
  }

  /**
   * Relaunch the application and exit the current process.
   */
  relaunchApp() {
    const portableExe = process.env.PORTABLE_EXECUTABLE_FILE;
    if (portableExe) {
      app.relaunch({ execPath: portableExe });
    } else {
      app.relaunch();
    }
    app.exit(0);
  }

  /**
   * Kill any previously running instances of the app and helper processes.
   */
  killExistingInstances() {
    const currentPid = process.pid;
    const parentPid = process.ppid;

    if (process.platform === 'win32') {
      this.killWindowsInstances(currentPid, parentPid);
    } else {
      this.killUnixInstances(currentPid, parentPid);
    }
  }

  /**
   * Terminate matching Windows processes excluding current process and parent process.
   */
  killWindowsInstances(currentPid, parentPid) {
    const appNameExe = `${(app.name || '').toLowerCase()}.exe`;
    const portableFilename = (process.env.PORTABLE_EXECUTABLE_APP_FILENAME || '').toLowerCase();

    try {
      const output = execSync('tasklist /FO CSV /NH', { encoding: 'utf8' });
      const lines = output.split(/\r?\n/);

      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split('","').map((s) => s.replace(/^"|"$/g, ''));
        if (parts.length >= 2) {
          const name = parts[0];
          const pid = parseInt(parts[1], 10);

          if (isNaN(pid) || pid === currentPid || pid === parentPid) {
            continue;
          }

          const lowerName = name.toLowerCase();
          const isTargetApp =
            lowerName === 'show second screens.exe' ||
            (appNameExe && lowerName === appNameExe) ||
            (portableFilename && lowerName === portableFilename) ||
            lowerName.startsWith('show-second-screens-portable') ||
            lowerName === 'injector.exe';

          if (isTargetApp) {
            try {
              console.log(`[SingleInstanceManager] Stopping process: ${name} (PID: ${pid})`);
              execSync(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore' });
            } catch (e) {
              // Ignore if already terminated
            }
          }
        }
      }
    } catch (err) {
      console.error('[SingleInstanceManager] Error enumerating Windows processes:', err.message);
    }

    // Ensure any orphaned injector daemon is also cleaned up
    try {
      execSync('taskkill /F /IM injector.exe', { stdio: 'ignore' });
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Terminate matching Unix processes.
   */
  killUnixInstances(currentPid, parentPid) {
    try {
      const output = execSync('pgrep -f "Show Second Screens"', { encoding: 'utf8' });
      const pids = output
        .split(/\r?\n/)
        .map((p) => parseInt(p.trim(), 10))
        .filter((p) => !isNaN(p));

      for (const pid of pids) {
        if (pid !== currentPid && pid !== parentPid) {
          try {
            console.log(`[SingleInstanceManager] Stopping Unix process PID: ${pid}`);
            process.kill(pid, 'SIGKILL');
          } catch (e) {
            // Ignore
          }
        }
      }
    } catch (err) {
      // Ignore
    }
  }
}

module.exports = { SingleInstanceManager };
