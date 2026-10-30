using System;
using System.IO;
using System.Runtime.InteropServices;

namespace ShowSecondScreens.Input
{
    /// <summary>
    /// Native Windows Input Injection Engine using Win32 API.
    /// Supports:
    ///  - Phantom Mode ("msg*" commands): clicks delivered via PostMessage to the
    ///    window under the target point. The physical cursor NEVER moves at all.
    ///  - Ghost Mode (legacy "ghost*" commands): SetCursorPos to target, click,
    ///    then restore the cursor (visible flicker, kept as fallback).
    ///  - Direct Mode: cursor warps to the target display.
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
        private static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);

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

        private const uint CWP_SKIPINVISIBLE = 0x0001;
        private const uint CWP_SKIPDISABLED = 0x0002;
        private const uint CWP_SKIPTRANSPARENT = 0x0004;

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

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT
        {
            public int X;
            public int Y;
        }

        private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        private const uint MOUSEEVENTF_LEFTUP = 0x0004;
        private const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
        private const uint MOUSEEVENTF_RIGHTUP = 0x0010;
        private const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
        private const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
        private const uint MOUSEEVENTF_WHEEL = 0x0800;

        private static POINT _savedOrigin;
        private static bool _isDragging = false;

        public static void Main(string[] args)
        {
            try { AttachConsole(-1); } catch { }
            try
            {
                // Enable Per-Monitor V2 DPI awareness so SetCursorPos matches physical desktop bounds exactly
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

                    // ---------------- Phantom Mode (cursor never moves) ----------------

                    case "msgclick":
                        if (parts.Length >= 3)
                        {
                            int tx = int.Parse(parts[1]);
                            int ty = int.Parse(parts[2]);
                            string btn = parts.Length >= 4 ? parts[3].ToLowerInvariant() : "left";

                            if (!PhantomClick(tx, ty, btn))
                            {
                                LegacyGhostClick(tx, ty, btn);
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
                                LegacyGhostDoubleClick(tx, ty);
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
                                LegacyGhostWheel(tx, ty, delta);
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
                                _savedOrigin = CurrentCursor();
                                _isDragging = true;
                                SetCursorPos(tx, ty);
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
                                SetCursorPos(tx, ty);
                                FireUp(btnU);
                                if (_isDragging)
                                {
                                    SetCursorPos(_savedOrigin.X, _savedOrigin.Y);
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
                            PhantomMove(tx, ty, btnM);
                        }
                        break;

                    // ---------------- Ghost Mode (legacy, cursor flickers) ----------------

                    // Ghost Click: executes remote click at target without moving the physical cursor away
                    case "ghostclick":
                        if (parts.Length >= 3)
                        {
                            int tx = int.Parse(parts[1]);
                            int ty = int.Parse(parts[2]);
                            string btn = parts.Length >= 4 ? parts[3].ToLowerInvariant() : "left";
                            LegacyGhostClick(tx, ty, btn);
                        }
                        break;

                    case "ghostdblclick":
                        if (parts.Length >= 3)
                        {
                            LegacyGhostDoubleClick(int.Parse(parts[1]), int.Parse(parts[2]));
                        }
                        break;

                    case "ghostwheel":
                        if (parts.Length >= 4)
                        {
                            LegacyGhostWheel(int.Parse(parts[1]), int.Parse(parts[2]), int.Parse(parts[3]));
                        }
                        break;

                    case "ghostdown":
                        if (parts.Length >= 3)
                        {
                            int tx = int.Parse(parts[1]);
                            int ty = int.Parse(parts[2]);
                            string btn = parts.Length >= 4 ? parts[3].ToLowerInvariant() : "left";

                            if (parts.Length >= 6)
                            {
                                _savedOrigin.X = int.Parse(parts[4]);
                                _savedOrigin.Y = int.Parse(parts[5]);
                            }
                            else
                            {
                                GetCursorPos(out _savedOrigin);
                            }
                            _isDragging = true;

                            SetCursorPos(tx, ty);
                            FireDown(btn);
                        }
                        break;

                    case "ghostup":
                        if (parts.Length >= 3)
                        {
                            int tx = int.Parse(parts[1]);
                            int ty = int.Parse(parts[2]);
                            string btn = parts.Length >= 4 ? parts[3].ToLowerInvariant() : "left";

                            SetCursorPos(tx, ty);
                            FireUp(btn);

                            if (_isDragging)
                            {
                                SetCursorPos(_savedOrigin.X, _savedOrigin.Y);
                                System.Threading.Thread.Sleep(5);
                                SetCursorPos(_savedOrigin.X, _savedOrigin.Y);
                                _isDragging = false;
                            }
                        }
                        break;

                    case "ghostdrag":
                        if (parts.Length >= 3)
                        {
                            int tx = int.Parse(parts[1]);
                            int ty = int.Parse(parts[2]);
                            SetCursorPos(tx, ty);
                        }
                        break;

                    // ---------------- Direct Mode (warps cursor to target) ----------------

                    case "move":
                        if (parts.Length >= 3)
                        {
                            int x = int.Parse(parts[1]);
                            int y = int.Parse(parts[2]);
                            SetCursorPos(x, y);
                        }
                        break;

                    case "click":
                        {
                            var btn = parts.Length >= 2 ? parts[1].ToLowerInvariant() : "left";
                            FireClick(btn);
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
                            mouse_event(MOUSEEVENTF_WHEEL, 0, 0, (uint)delta, UIntPtr.Zero);
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
        // Phantom (PostMessage) implementation - zero cursor movement
        // ---------------------------------------------------------------------

        private static POINT CurrentCursor()
        {
            POINT p;
            GetCursorPos(out p);
            return p;
        }

        /// <summary>
        /// Finds the deepest visible window under the given virtual-desktop
        /// (physical pixel) point and converts the point to its client space.
        /// </summary>
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
            System.Threading.Thread.Sleep(12);
            PostMessage(hwnd, up, IntPtr.Zero, lp);
            return ok;
        }

        private static bool PhantomDoubleClick(int tx, int ty)
        {
            if (!PhantomClick(tx, ty, "left")) return false;
            System.Threading.Thread.Sleep(40);

            IntPtr hwnd; POINT c;
            if (!ResolveTarget(tx, ty, out hwnd, out c)) return false;

            uint down, up; IntPtr mk;
            ButtonMessages("left", true, out down, out up, out mk);
            IntPtr lp = MakeLParam(c.X, c.Y);

            bool ok = PostMessage(hwnd, down, mk, lp);
            System.Threading.Thread.Sleep(12);
            PostMessage(hwnd, up, IntPtr.Zero, lp);
            return ok;
        }

        private static bool PhantomWheel(int tx, int ty, int delta)
        {
            IntPtr hwnd; POINT c;
            if (!ResolveTarget(tx, ty, out hwnd, out c)) return false;

            // WM_MOUSEWHEEL: wParam high word = signed wheel delta, lParam = SCREEN coords
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
        // Legacy Ghost implementation (SendInput + cursor restore) - fallback
        // ---------------------------------------------------------------------

        private static void LegacyGhostClick(int tx, int ty, string btn)
        {
            POINT orig;
            GetCursorPos(out orig);

            SetCursorPos(tx, ty);
            FireClick(btn);
            SetCursorPos(orig.X, orig.Y);

            System.Threading.Thread.Sleep(5);
            SetCursorPos(orig.X, orig.Y);
        }

        private static void LegacyGhostDoubleClick(int tx, int ty)
        {
            POINT orig;
            GetCursorPos(out orig);

            SetCursorPos(tx, ty);
            FireClick("left");
            System.Threading.Thread.Sleep(25);
            FireClick("left");
            SetCursorPos(orig.X, orig.Y);

            System.Threading.Thread.Sleep(5);
            SetCursorPos(orig.X, orig.Y);
        }

        private static void LegacyGhostWheel(int tx, int ty, int delta)
        {
            POINT orig;
            GetCursorPos(out orig);

            SetCursorPos(tx, ty);
            mouse_event(MOUSEEVENTF_WHEEL, 0, 0, (uint)delta, UIntPtr.Zero);
            SetCursorPos(orig.X, orig.Y);

            System.Threading.Thread.Sleep(5);
            SetCursorPos(orig.X, orig.Y);
        }

        private static void FireClick(string btn)
        {
            FireDown(btn);
            System.Threading.Thread.Sleep(10);
            FireUp(btn);
        }

        private static void FireDown(string btn)
        {
            if (btn == "right") mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, UIntPtr.Zero);
            else if (btn == "middle") mouse_event(MOUSEEVENTF_MIDDLEDOWN, 0, 0, 0, UIntPtr.Zero);
            else mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        }

        private static void FireUp(string btn)
        {
            if (btn == "right") mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, UIntPtr.Zero);
            else if (btn == "middle") mouse_event(MOUSEEVENTF_MIDDLEUP, 0, 0, 0, UIntPtr.Zero);
            else mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
        }
    }
}
