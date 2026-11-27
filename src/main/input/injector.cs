using System;
using System.IO;
using System.Runtime.InteropServices;

namespace ShowSecondScreens.Input
{
    /// <summary>
    /// Native Windows Input Injection Engine using Win32 SendInput API.
    /// Supports:
    ///  - Ghost Mode ("ghost*" commands): moves to target, injects hardware SendInput,
    ///    then restores physical cursor to its exact prior position.
    ///  - Phantom Mode ("msg*" commands): PostMessage targeting with automatic
    ///    hardware Ghost fallback for Shell/UWP/non-client/UIPI windows.
    ///  - Direct Mode: moves cursor to the target display without restoring.
    /// </summary>
    public static class Program
    {
        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetCursorPos(int X, int Y);

        [DllImport("kernel32.dll")]
        private static extern bool AttachConsole(int dwProcessId);

        [DllImport("user32.dll")]
        private static extern bool GetCursorPos(out POINT lpPoint);

        [DllImport("user32.dll")]
        private static extern int GetSystemMetrics(int nIndex);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetProcessDPIAware();

        [DllImport("shcore.dll")]
        private static extern int SetProcessDpiAwareness(int awareness);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetProcessDpiAwarenessContext(IntPtr dpiContext);

        [DllImport("user32.dll")]
        private static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr lprcClip, MonitorEnumProc lpfnEnum, IntPtr dwData);

        private delegate bool MonitorEnumProc(IntPtr hMonitor, IntPtr hdcMonitor, ref RECT lprcMonitor, IntPtr dwData);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFOEX lpmi);

        // --- Phantom (PostMessage) injection APIs ---
        [DllImport("user32.dll")]
        private static extern IntPtr WindowFromPoint(POINT pPoint);

        [DllImport("user32.dll")]
        private static extern IntPtr ChildWindowFromPointEx(IntPtr hwndParent, POINT pt, uint uFlags);

        [DllImport("user32.dll")]
        private static extern bool ScreenToClient(IntPtr hWnd, ref POINT lpPoint);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder lpClassName, int nMaxCount);

        [DllImport("user32.dll")]
        private static extern IntPtr SendMessageTimeout(
            IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam,
            uint fuFlags, uint uTimeout, out IntPtr lpdwResult);

        private const uint CWP_SKIPINVISIBLE = 0x0001;
        private const uint CWP_SKIPDISABLED = 0x0002;
        private const uint CWP_SKIPTRANSPARENT = 0x0004;

        private const uint WM_NCHITTEST = 0x0084;
        private const int HTCLIENT = 1;
        private const uint SMTO_ABORTIFHUNG = 0x0002;

        private const uint WM_MOUSEMOVE = 0x0200;
        private const uint WM_LBUTTONDOWN = 0x0201;
        private const uint WM_LBUTTONUP = 0x0202;
        private const uint WM_LBUTTONDBLCLK = 0x0203;
        private const uint WM_RBUTTONDOWN = 0x0204;
        private const uint WM_RBUTTONUP = 0x0205;
        private const uint WM_RBUTTONDBLCLK = 0x0206;
        private const uint WM_MBUTTONDOWN = 0x0207;
        private const uint WM_MBUTTONUP = 0x0208;
        private const uint WM_MBUTTONDBLCLK = 0x0209;
        private const uint WM_MOUSEWHEEL = 0x020A;

        private static readonly IntPtr MK_LBUTTON = new IntPtr(0x0001);
        private static readonly IntPtr MK_RBUTTON = new IntPtr(0x0002);
        private static readonly IntPtr MK_MBUTTON = new IntPtr(0x0010);

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
        private struct MONITORINFOEX
        {
            public int cbSize;
            public RECT rcMonitor;
            public RECT rcWork;
            public int dwFlags;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
            public string szDevice;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT
        {
            public int left;
            public int top;
            public int right;
            public int bottom;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT
        {
            public int X;
            public int Y;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct INPUT
        {
            public uint type;
            public InputUnion u;
        }

        [StructLayout(LayoutKind.Explicit)]
        private struct InputUnion
        {
            [FieldOffset(0)]
            public MOUSEINPUT mi;
            [FieldOffset(0)]
            public KEYBDINPUT ki;
            [FieldOffset(0)]
            public HARDWAREINPUT hi;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct MOUSEINPUT
        {
            public int dx;
            public int dy;
            public uint mouseData;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct KEYBDINPUT
        {
            public ushort wVk;
            public ushort wScan;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct HARDWAREINPUT
        {
            public uint uMsg;
            public ushort wParamL;
            public ushort wParamH;
        }

        private const uint INPUT_MOUSE = 0;
        private const uint MOUSEEVENTF_MOVE = 0x0001;
        private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        private const uint MOUSEEVENTF_LEFTUP = 0x0004;
        private const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
        private const uint MOUSEEVENTF_RIGHTUP = 0x0010;
        private const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
        private const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
        private const uint MOUSEEVENTF_WHEEL = 0x0800;
        private const uint MOUSEEVENTF_VIRTUALDESK = 0x4000;
        private const uint MOUSEEVENTF_ABSOLUTE = 0x8000;

        private const int SM_XVIRTUALSCREEN = 76;
        private const int SM_YVIRTUALSCREEN = 77;
        private const int SM_CXVIRTUALSCREEN = 78;
        private const int SM_CYVIRTUALSCREEN = 79;

        private static POINT _savedOrigin;
        private static bool _isDragging = false;

        private static string GetMonitorsJson()
        {
            var list = new System.Collections.Generic.List<string>();
            int idx = 0;
            EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, (IntPtr hMon, IntPtr hdc, ref RECT rc, IntPtr data) =>
            {
                var mi = new MONITORINFOEX();
                mi.cbSize = Marshal.SizeOf(typeof(MONITORINFOEX));
                if (GetMonitorInfo(hMon, ref mi))
                {
                    int w = mi.rcMonitor.right - mi.rcMonitor.left;
                    int h = mi.rcMonitor.bottom - mi.rcMonitor.top;
                    bool isPrimary = (mi.dwFlags & 1) != 0;
                    string dev = (mi.szDevice ?? "").Replace("\\", "\\\\");
                    list.Add(string.Format("{{\"index\":{0},\"device\":\"{1}\",\"left\":{2},\"top\":{3},\"right\":{4},\"bottom\":{5},\"width\":{6},\"height\":{7},\"isPrimary\":{8}}}",
                        idx++, dev, mi.rcMonitor.left, mi.rcMonitor.top, mi.rcMonitor.right, mi.rcMonitor.bottom, w, h, isPrimary ? "true" : "false"));
                }
                return true;
            }, IntPtr.Zero);

            return "[" + string.Join(",", list.ToArray()) + "]";
        }

        [STAThread]
        public static void Main(string[] args)
        {
            try { AttachConsole(-1); } catch { }
            try
            {
                // Enable Per-Monitor V2 DPI awareness so coordinates match physical desktop bounds 1:1
                SetProcessDpiAwarenessContext(new IntPtr(-4));
            }
            catch
            {
                try { SetProcessDpiAwareness(2); }
                catch { try { SetProcessDPIAware(); } catch { } }
            }

            if (args != null && args.Length > 0)
            {
                ExecuteCommand(string.Join(" ", args));
                return;
            }

            using (var reader = new StreamReader(Console.OpenStandardInput()))
            {
                string line;
                while ((line = reader.ReadLine()) != null)
                {
                    line = line.Trim();
                    if (string.IsNullOrEmpty(line)) continue;
                    if (line.Equals("exit", StringComparison.OrdinalIgnoreCase) ||
                        line.Equals("quit", StringComparison.OrdinalIgnoreCase))
                    {
                        break;
                    }

                    ExecuteCommand(line);
                }
            }
        }

        private static void ExecuteCommand(string command)
        {
            try
            {
                var parts = command.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length == 0) return;

                var action = parts[0].ToLowerInvariant();

                switch (action)
                {
                    case "getmonitors":
                    case "monitors":
                        Console.WriteLine(GetMonitorsJson());
                        break;

                    // ---------------- Phantom Mode (PostMessage + hardware fallback) ----------------

                    case "msgclick":
                        if (parts.Length >= 3)
                        {
                            int tx = int.Parse(parts[1]);
                            int ty = int.Parse(parts[2]);
                            string btn = parts.Length >= 4 ? parts[3].ToLowerInvariant() : "left";

                            if (!PhantomClick(tx, ty, btn))
                            {
                                GhostClick(tx, ty, btn);
                            }
                        }
                        break;

                    case "msgdblclick":
                        if (parts.Length >= 3)
                        {
                            int tx = int.Parse(parts[1]);
                            int ty = int.Parse(parts[2]);

                            if (!PhantomDoubleClick(tx, ty))
                            {
                                GhostDoubleClick(tx, ty);
                            }
                        }
                        break;

                    case "msgwheel":
                        if (parts.Length >= 4)
                        {
                            int tx = int.Parse(parts[1]);
                            int ty = int.Parse(parts[2]);
                            int delta = int.Parse(parts[3]);

                            if (!PhantomWheel(tx, ty, delta))
                            {
                                GhostWheel(tx, ty, delta);
                            }
                        }
                        break;

                    case "msgdown":
                        if (parts.Length >= 3)
                        {
                            int tx = int.Parse(parts[1]);
                            int ty = int.Parse(parts[2]);
                            string btnD = parts.Length >= 4 ? parts[3].ToLowerInvariant() : "left";

                            if (!PhantomButton(tx, ty, btnD, true))
                            {
                                GetCursorPos(out _savedOrigin);
                                _isDragging = true;
                                MoveCursorExact(tx, ty);
                                System.Threading.Thread.Sleep(5);
                                FireDown(btnD);
                            }
                            else
                            {
                                _isDragging = true;
                            }
                        }
                        break;

                    case "msgup":
                        if (parts.Length >= 3)
                        {
                            int tx = int.Parse(parts[1]);
                            int ty = int.Parse(parts[2]);
                            string btnU = parts.Length >= 4 ? parts[3].ToLowerInvariant() : "left";

                            if (!PhantomButton(tx, ty, btnU, false))
                            {
                                MoveCursorExact(tx, ty);
                                System.Threading.Thread.Sleep(5);
                                FireUp(btnU);
                                if (_isDragging)
                                {
                                    System.Threading.Thread.Sleep(5);
                                    MoveCursorExact(_savedOrigin.X, _savedOrigin.Y);
                                    _isDragging = false;
                                }
                            }
                            else
                            {
                                _isDragging = false;
                            }
                        }
                        break;

                    case "msgmove":
                        if (parts.Length >= 3)
                        {
                            int tx = int.Parse(parts[1]);
                            int ty = int.Parse(parts[2]);
                            string btnM = parts.Length >= 4 ? parts[3].ToLowerInvariant() : null;
                            if (!PhantomMove(tx, ty, btnM))
                            {
                                MoveCursorExact(tx, ty);
                            }
                        }
                        break;

                    // Recorded, native drag replay. This runs only after the host
                    // preview releases the mouse, preserving preview mouse events.
                    // The helper acknowledges input dispatch, not the OLE effect.
                    case "replaydrag":
                        if (parts.Length >= 5)
                        {
                            bool sent = false;
                            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
                            try
                            {
                                sent = NativeDragReplay.Replay(parts[2],
                                    parts[3] == "1", parts[4] == "1");
                            }
                            catch (Exception error)
                            {
                                Console.Error.WriteLine("[NativeDragReplay] " + error.Message);
                            }
                            stopwatch.Stop();
                            Console.WriteLine("REPLAY_RESULT " + parts[1] + " "
                                + (sent ? "ok" : "failed") + " " + stopwatch.ElapsedMilliseconds);
                            Console.Out.Flush();
                        }
                        break;

                    // Cursor-independent native drag protocol. Window moves use
                    // SetWindowPos; Explorer-to-Explorer file transfers use Shell
                    // automation and require confirmation before changing files.
                    case "virtualdragstart":
                        if (parts.Length >= 3)
                            VirtualDrag.Start(int.Parse(parts[1]), int.Parse(parts[2]));
                        break;
                    case "virtualdragmove":
                        if (parts.Length >= 3)
                            VirtualDrag.Move(int.Parse(parts[1]), int.Parse(parts[2]));
                        break;
                    case "virtualdragend":
                        if (parts.Length >= 3)
                            VirtualDrag.Finish(int.Parse(parts[1]), int.Parse(parts[2]),
                                parts.Length >= 4 && parts[3] == "1",
                                parts.Length >= 5 && parts[4] == "1");
                        break;
                    case "virtualdragcancel":
                        VirtualDrag.Cancel();
                        break;
                    case "virtualfiledrop":
                        if (parts.Length >= 4)
                            VirtualDrag.DropFiles(parts[3], int.Parse(parts[1]), int.Parse(parts[2]),
                                parts.Length >= 5 && parts[4] == "1",
                                parts.Length >= 6 && parts[5] == "1");
                        break;

                    // ---------------- Ghost Mode (SendInput + instant cursor restore) ----------------

                    case "ghostclick":
                        if (parts.Length >= 3)
                        {
                            int tx = int.Parse(parts[1]);
                            int ty = int.Parse(parts[2]);
                            string btn = parts.Length >= 4 ? parts[3].ToLowerInvariant() : "left";
                            GhostClick(tx, ty, btn);
                        }
                        break;

                    case "ghostdblclick":
                        if (parts.Length >= 3)
                        {
                            GhostDoubleClick(int.Parse(parts[1]), int.Parse(parts[2]));
                        }
                        break;

                    case "ghostwheel":
                        if (parts.Length >= 4)
                        {
                            GhostWheel(int.Parse(parts[1]), int.Parse(parts[2]), int.Parse(parts[3]));
                        }
                        break;

                    case "ghostdown":
                        if (parts.Length >= 3)
                        {
                            int tx = int.Parse(parts[1]);
                            int ty = int.Parse(parts[2]);
                            string btn = parts.Length >= 4 ? parts[3].ToLowerInvariant() : "left";

                            GetCursorPos(out _savedOrigin);
                            _isDragging = true;

                            MoveCursorExact(tx, ty);
                            System.Threading.Thread.Sleep(5);
                            FireDown(btn);
                        }
                        break;

                    case "ghostup":
                        if (parts.Length >= 3)
                        {
                            int tx = int.Parse(parts[1]);
                            int ty = int.Parse(parts[2]);
                            string btn = parts.Length >= 4 ? parts[3].ToLowerInvariant() : "left";

                            MoveCursorExact(tx, ty);
                            System.Threading.Thread.Sleep(5);
                            FireUp(btn);

                            if (_isDragging)
                            {
                                System.Threading.Thread.Sleep(6);
                                MoveCursorExact(_savedOrigin.X, _savedOrigin.Y);
                                _isDragging = false;
                            }
                        }
                        break;

                    case "ghostdrag":
                        if (parts.Length >= 3)
                        {
                            int tx = int.Parse(parts[1]);
                            int ty = int.Parse(parts[2]);
                            MoveCursorExact(tx, ty);
                        }
                        break;

                    // ---------------- Direct Mode (warps cursor to target) ----------------

                    case "move":
                        if (parts.Length >= 3)
                        {
                            int x = int.Parse(parts[1]);
                            int y = int.Parse(parts[2]);
                            MoveCursorExact(x, y);
                        }
                        break;

                    case "click":
                        {
                            var btn = parts.Length >= 2 ? parts[1].ToLowerInvariant() : "left";
                            FireClick(btn);
                        }
                        break;

                    case "dblclick":
                        {
                            FireClick("left");
                            System.Threading.Thread.Sleep(20);
                            FireClick("left");
                        }
                        break;

                    case "down":
                    case "mousedown":
                        {
                            var btn = parts.Length >= 2 ? parts[1].ToLowerInvariant() : "left";
                            FireDown(btn);
                        }
                        break;

                    case "up":
                    case "mouseup":
                        {
                            var btn = parts.Length >= 2 ? parts[1].ToLowerInvariant() : "left";
                            FireUp(btn);
                        }
                        break;

                    case "wheel":
                        if (parts.Length >= 2)
                        {
                            int delta = int.Parse(parts[1]);
                            FireWheel(delta);
                        }
                        break;
                }
            }
            catch
            {
                // Ignore parse errors for continuous stream stability
            }
        }

        // ---------------------------------------------------------------------
        // Phantom (PostMessage) implementation
        // ---------------------------------------------------------------------

        private static bool RequiresHardwareFallback(IntPtr hwnd, int tx, int ty)
        {
            var sb = new System.Text.StringBuilder(128);
            GetClassName(hwnd, sb, sb.Capacity);
            string cls = sb.ToString();

            // Shell, Taskbar, Desktop, Start Menu, UWP/WinUI windows ignore PostMessage mouse input
            if (cls == "Shell_TrayWnd" || cls == "Shell_SecondaryTrayWnd" ||
                cls == "Progman" || cls == "WorkerW" || cls == "SysListView32" ||
                cls == "SHELLDLL_DefView" || cls == "ApplicationFrameWindow" ||
                cls == "Windows.UI.Core.CoreWindow" || cls == "XamlExplorerHostIslandWindow")
            {
                return true;
            }

            // Non-client areas (titlebar, close/minimize/maximize, resize borders) require hardware input
            IntPtr hitResult;
            IntPtr lpScreen = MakeLParam(tx, ty);
            if (SendMessageTimeout(hwnd, WM_NCHITTEST, IntPtr.Zero, lpScreen, SMTO_ABORTIFHUNG, 50, out hitResult) != IntPtr.Zero)
            {
                if (hitResult.ToInt32() != HTCLIENT)
                {
                    return true;
                }
            }

            return false;
        }

        private static bool ResolveTarget(int tx, int ty, out IntPtr hwnd, out POINT client)
        {
            POINT screen; screen.X = tx; screen.Y = ty;
            hwnd = WindowFromPoint(screen);
            if (hwnd == IntPtr.Zero)
            {
                client = default(POINT);
                return false;
            }

            for (int i = 0; i < 24; i++)
            {
                POINT local = screen;
                ScreenToClient(hwnd, ref local);
                IntPtr child = ChildWindowFromPointEx(hwnd, local,
                    CWP_SKIPINVISIBLE | CWP_SKIPDISABLED | CWP_SKIPTRANSPARENT);
                if (child == IntPtr.Zero || child == hwnd) break;
                hwnd = child;
            }

            if (RequiresHardwareFallback(hwnd, tx, ty))
            {
                client = default(POINT);
                return false;
            }

            client = screen;
            return ScreenToClient(hwnd, ref client);
        }

        private static IntPtr MakeLParam(int lo, int hi)
        {
            return (IntPtr)((lo & 0xFFFF) | ((hi & 0xFFFF) << 16));
        }

        private static void ButtonMessages(string btn, bool dblSecond, out uint downMsg, out uint upMsg, out IntPtr mk)
        {
            if (btn == "right") { downMsg = dblSecond ? WM_RBUTTONDBLCLK : WM_RBUTTONDOWN; upMsg = WM_RBUTTONUP; mk = MK_RBUTTON; }
            else if (btn == "middle") { downMsg = dblSecond ? WM_MBUTTONDBLCLK : WM_MBUTTONDOWN; upMsg = WM_MBUTTONUP; mk = MK_MBUTTON; }
            else { downMsg = dblSecond ? WM_LBUTTONDBLCLK : WM_LBUTTONDOWN; upMsg = WM_LBUTTONUP; mk = MK_LBUTTON; }
        }

        private static bool PhantomClick(int tx, int ty, string btn)
        {
            IntPtr hwnd; POINT c;
            if (!ResolveTarget(tx, ty, out hwnd, out c)) return false;

            uint down, up; IntPtr mk;
            ButtonMessages(btn, false, out down, out up, out mk);
            IntPtr lp = MakeLParam(c.X, c.Y);

            PostMessage(hwnd, WM_MOUSEMOVE, mk, lp);
            bool ok = PostMessage(hwnd, down, mk, lp);
            System.Threading.Thread.Sleep(2);
            PostMessage(hwnd, up, IntPtr.Zero, lp);
            return ok;
        }

        private static bool PhantomDoubleClick(int tx, int ty)
        {
            if (!PhantomClick(tx, ty, "left")) return false;
            System.Threading.Thread.Sleep(15);

            IntPtr hwnd; POINT c;
            if (!ResolveTarget(tx, ty, out hwnd, out c)) return false;

            uint down, up; IntPtr mk;
            ButtonMessages("left", true, out down, out up, out mk);
            IntPtr lp = MakeLParam(c.X, c.Y);

            bool ok = PostMessage(hwnd, down, mk, lp);
            System.Threading.Thread.Sleep(2);
            PostMessage(hwnd, up, IntPtr.Zero, lp);
            return ok;
        }

        private static bool PhantomWheel(int tx, int ty, int delta)
        {
            IntPtr hwnd; POINT c;
            if (!ResolveTarget(tx, ty, out hwnd, out c)) return false;

            IntPtr wParam = (IntPtr)(((delta << 16) & unchecked((int)0xFFFF0000)) | 0x0000);
            IntPtr lp = MakeLParam(tx, ty);
            PostMessage(hwnd, WM_MOUSEMOVE, IntPtr.Zero, MakeLParam(c.X, c.Y));
            return PostMessage(hwnd, WM_MOUSEWHEEL, wParam, lp);
        }

        private static bool PhantomButton(int tx, int ty, string btn, bool isDown)
        {
            IntPtr hwnd; POINT c;
            if (!ResolveTarget(tx, ty, out hwnd, out c)) return false;

            uint down, up; IntPtr mk;
            ButtonMessages(btn, false, out down, out up, out mk);
            IntPtr lp = MakeLParam(c.X, c.Y);

            if (isDown)
            {
                PostMessage(hwnd, WM_MOUSEMOVE, mk, lp);
                return PostMessage(hwnd, down, mk, lp);
            }
            else
            {
                PostMessage(hwnd, WM_MOUSEMOVE, mk, lp);
                return PostMessage(hwnd, up, IntPtr.Zero, lp);
            }
        }

        private static bool PhantomMove(int tx, int ty, string heldButton)
        {
            IntPtr hwnd; POINT c;
            if (!ResolveTarget(tx, ty, out hwnd, out c)) return false;

            IntPtr mk = IntPtr.Zero;
            if (heldButton == "right") mk = MK_RBUTTON;
            else if (heldButton == "middle") mk = MK_MBUTTON;
            else if (heldButton != null) mk = MK_LBUTTON;

            return PostMessage(hwnd, WM_MOUSEMOVE, mk, MakeLParam(c.X, c.Y));
        }

        // ---------------------------------------------------------------------
        // Hardware Ghost implementation (SendInput + cursor restore)
        // ---------------------------------------------------------------------

        /// <summary>
        /// Moves the cursor to exact physical virtual-screen coordinates, retrying across
        /// mixed-DPI monitor boundaries so Windows never clamps on an intermediate screen.
        /// </summary>
        private static void MoveCursorExact(int tx, int ty)
        {
            SetCursorPos(tx, ty);
            POINT cur;
            if (GetCursorPos(out cur) && cur.X == tx && cur.Y == ty)
            {
                return;
            }

            System.Threading.Thread.Sleep(1);
            SetCursorPos(tx, ty);
            if (GetCursorPos(out cur) && cur.X == tx && cur.Y == ty)
            {
                return;
            }

            int vx = GetSystemMetrics(SM_XVIRTUALSCREEN);
            int vy = GetSystemMetrics(SM_YVIRTUALSCREEN);
            int vw = GetSystemMetrics(SM_CXVIRTUALSCREEN);
            int vh = GetSystemMetrics(SM_CYVIRTUALSCREEN);
            if (vw > 1 && vh > 1)
            {
                int dx = (int)Math.Round(((double)(tx - vx) * 65535.0) / (vw - 1));
                int dy = (int)Math.Round(((double)(ty - vy) * 65535.0) / (vh - 1));
                var inp = new INPUT[1];
                inp[0].type = INPUT_MOUSE;
                inp[0].u.mi = new MOUSEINPUT
                {
                    dx = dx,
                    dy = dy,
                    mouseData = 0,
                    dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK,
                    time = 0,
                    dwExtraInfo = IntPtr.Zero,
                };
                SendInput(1, inp, Marshal.SizeOf(typeof(INPUT)));
                SetCursorPos(tx, ty);
            }
        }

        private static void GhostClick(int tx, int ty, string btn)
        {
            POINT orig;
            GetCursorPos(out orig);

            MoveCursorExact(tx, ty);
            System.Threading.Thread.Sleep(6);
            FireClick(btn);
            System.Threading.Thread.Sleep(6);
            MoveCursorExact(orig.X, orig.Y);
        }

        private static void GhostDoubleClick(int tx, int ty)
        {
            POINT orig;
            GetCursorPos(out orig);

            MoveCursorExact(tx, ty);
            System.Threading.Thread.Sleep(6);
            FireClick("left");
            System.Threading.Thread.Sleep(20);
            FireClick("left");
            System.Threading.Thread.Sleep(6);
            MoveCursorExact(orig.X, orig.Y);
        }

        private static void GhostWheel(int tx, int ty, int delta)
        {
            POINT orig;
            GetCursorPos(out orig);

            MoveCursorExact(tx, ty);
            System.Threading.Thread.Sleep(4);
            FireWheel(delta);
            System.Threading.Thread.Sleep(4);
            MoveCursorExact(orig.X, orig.Y);
        }

        private static void SendMouseFlag(uint flag, uint mouseData = 0)
        {
            var inp = new INPUT[1];
            inp[0].type = INPUT_MOUSE;
            inp[0].u.mi = new MOUSEINPUT
            {
                dx = 0,
                dy = 0,
                mouseData = mouseData,
                dwFlags = flag,
                time = 0,
                dwExtraInfo = IntPtr.Zero,
            };
            SendInput(1, inp, Marshal.SizeOf(typeof(INPUT)));
        }

        private static void FireClick(string btn)
        {
            FireDown(btn);
            System.Threading.Thread.Sleep(8);
            FireUp(btn);
        }

        private static void FireDown(string btn)
        {
            if (btn == "right") SendMouseFlag(MOUSEEVENTF_RIGHTDOWN);
            else if (btn == "middle") SendMouseFlag(MOUSEEVENTF_MIDDLEDOWN);
            else SendMouseFlag(MOUSEEVENTF_LEFTDOWN);
        }

        private static void FireUp(string btn)
        {
            if (btn == "right") SendMouseFlag(MOUSEEVENTF_RIGHTUP);
            else if (btn == "middle") SendMouseFlag(MOUSEEVENTF_MIDDLEUP);
            else SendMouseFlag(MOUSEEVENTF_LEFTUP);
        }

        private static void FireWheel(int delta)
        {
            SendMouseFlag(MOUSEEVENTF_WHEEL, unchecked((uint)delta));
        }
    }
}
