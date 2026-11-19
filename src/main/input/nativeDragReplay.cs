using System;
using System.Collections.Generic;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

namespace ShowSecondScreens.Input
{
    /// <summary>
    /// Replays a preview gesture as a real, short Windows mouse drag AFTER the
    /// host mouse has been released. The on-screen duplicate pointer is a visual
    /// aid; native OLE drop targets require the one real Windows cursor.
    /// Always restores the original OS cursor position in finally.
    /// </summary>
    internal static class NativeDragReplay
    {
        private const uint INPUT_MOUSE = 0;
        private const uint INPUT_KEYBOARD = 1;
        private const uint MOUSEEVENTF_MOVE = 0x0001;
        private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        private const uint MOUSEEVENTF_LEFTUP = 0x0004;
        private const uint MOUSEEVENTF_VIRTUALDESK = 0x4000;
        private const uint MOUSEEVENTF_ABSOLUTE = 0x8000;
        private const uint KEYEVENTF_KEYUP = 0x0002;
        private const int VK_LBUTTON = 0x01;
        private const int VK_CONTROL = 0x11;
        private const int VK_SHIFT = 0x10;
        private const int SM_XVIRTUALSCREEN = 76;
        private const int SM_YVIRTUALSCREEN = 77;
        private const int SM_CXVIRTUALSCREEN = 78;
        private const int SM_CYVIRTUALSCREEN = 79;
        private const int MAX_POINTS = 192;
        private const int MAX_STEPS = 420;

        [StructLayout(LayoutKind.Sequential)]
        private struct POINT { public int X; public int Y; }

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

        [StructLayout(LayoutKind.Explicit)]
        private struct INPUTUNION
        {
            [FieldOffset(0)] public MOUSEINPUT mi;
            [FieldOffset(0)] public KEYBDINPUT ki;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct INPUT
        {
            public uint type;
            public INPUTUNION u;
        }

        [DllImport("user32.dll", SetLastError = true)]
        private static extern uint SendInput(uint count, INPUT[] inputs, int size);
        [DllImport("user32.dll")]
        private static extern bool GetCursorPos(out POINT point);
        [DllImport("user32.dll")]
        private static extern int GetSystemMetrics(int index);
        [DllImport("user32.dll")]
        private static extern short GetAsyncKeyState(int key);

        private static bool Mouse(uint flag, int dx = 0, int dy = 0)
        {
            var inp = new INPUT
            {
                type = INPUT_MOUSE,
                u = new INPUTUNION
                {
                    mi = new MOUSEINPUT { dx = dx, dy = dy, dwFlags = flag, dwExtraInfo = IntPtr.Zero }
                }
            };
            return SendInput(1, new[] { inp }, Marshal.SizeOf(typeof(INPUT))) == 1;
        }

        private static bool Key(int vk, bool down)
        {
            var inp = new INPUT
            {
                type = INPUT_KEYBOARD,
                u = new INPUTUNION
                {
                    ki = new KEYBDINPUT
                    {
                        wVk = (ushort)vk, wScan = 0,
                        dwFlags = down ? 0u : KEYEVENTF_KEYUP,
                        dwExtraInfo = IntPtr.Zero
                    }
                }
            };
            return SendInput(1, new[] { inp }, Marshal.SizeOf(typeof(INPUT))) == 1;
        }

        private static bool MoveTo(POINT point, int left, int top, int width, int height)
        {
            if (point.X < left || point.X >= left + width
                || point.Y < top || point.Y >= top + height) return false;
            int x = (int)Math.Round(((double)(point.X - left) * 65535.0) / (width - 1));
            int y = (int)Math.Round(((double)(point.Y - top) * 65535.0) / (height - 1));
            return Mouse(MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK, x, y);
        }

        private static List<POINT> DecodePoints(string base64)
        {
            if (string.IsNullOrEmpty(base64) || base64.Length > 8192)
                throw new ArgumentException("Invalid native drag path.");
            var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(base64));
            var tokens = decoded.Split(new[] { ';' }, StringSplitOptions.RemoveEmptyEntries);
            if (tokens.Length < 2 || tokens.Length > MAX_POINTS)
                throw new ArgumentException("Invalid native drag point count.");
            var points = new List<POINT>();
            foreach (var token in tokens)
            {
                var values = token.Split(',');
                int x, y;
                if (values.Length != 2
                    || !int.TryParse(values[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out x)
                    || !int.TryParse(values[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out y))
                    throw new ArgumentException("Invalid native drag coordinates.");
                points.Add(new POINT { X = x, Y = y });
            }
            return points;
        }

        public static bool Replay(string base64, bool ctrl, bool shift)
        {
            List<POINT> points;
            try { points = DecodePoints(base64); }
            catch (Exception error)
            {
                Console.Error.WriteLine("[NativeDragReplay] " + error.Message);
                return false;
            }

            int left = GetSystemMetrics(SM_XVIRTUALSCREEN);
            int top = GetSystemMetrics(SM_YVIRTUALSCREEN);
            int width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
            int height = GetSystemMetrics(SM_CYVIRTUALSCREEN);
            if (width < 2 || height < 2) return false;
            foreach (var point in points)
            {
                if (point.X < left || point.X >= left + width
                    || point.Y < top || point.Y >= top + height) return false;
            }
            var a = points[0];
            var b = points[points.Count - 1];
            if (Math.Abs((long)a.X - b.X) + Math.Abs((long)a.Y - b.Y) < 5)
                return false;

            POINT origin;
            if (!GetCursorPos(out origin)) return false;
            bool mouseDown = false;
            bool synthesizedCtrl = false, synthesizedShift = false;
            bool ok = true;
            try
            {
                if (!MoveTo(a, left, top, width, height)) return false;
                Thread.Sleep(55);

                if (ctrl && (GetAsyncKeyState(VK_CONTROL) & 0x8000) == 0)
                {
                    synthesizedCtrl = Key(VK_CONTROL, true);
                    if (!synthesizedCtrl) return false;
                }
                if (shift && (GetAsyncKeyState(VK_SHIFT) & 0x8000) == 0)
                {
                    synthesizedShift = Key(VK_SHIFT, true);
                    if (!synthesizedShift) return false;
                }

                if (!Mouse(MOUSEEVENTF_LEFTDOWN)) return false;
                mouseDown = true;
                Thread.Sleep(90); // Allow Explorer/OLE and titlebar hit testing to start.

                int totalSteps = 0;
                POINT previous = a;
                for (int index = 1; index < points.Count; index++)
                {
                    var next = points[index];
                    double distance = Math.Sqrt(
                        Math.Pow((double)next.X - previous.X, 2)
                        + Math.Pow((double)next.Y - previous.Y, 2));
                    int steps = Math.Max(1, (int)Math.Ceiling(distance / 28.0));
                    steps = Math.Min(steps, MAX_STEPS - totalSteps);
                    if (steps <= 0) break;

                    for (int step = 1; step <= steps; step++)
                    {
                        var position = new POINT
                        {
                            X = (int)Math.Round(previous.X + ((double)next.X - previous.X) * step / steps),
                            Y = (int)Math.Round(previous.Y + ((double)next.Y - previous.Y) * step / steps)
                        };
                        if (!MoveTo(position, left, top, width, height)) { ok = false; break; }
                        Thread.Sleep(9);
                    }
                    totalSteps += steps;
                    if (!ok || totalSteps >= MAX_STEPS) break;
                    previous = next;
                }

                // Always reach the precise final destination, even if throttled.
                if (!MoveTo(b, left, top, width, height)) ok = false;
                Thread.Sleep(110); // Let registered OLE drop targets process drag-over.
                if (!Mouse(MOUSEEVENTF_LEFTUP)) ok = false;
                mouseDown = false;
                Thread.Sleep(80);
                return ok;
            }
            catch (Exception error)
            {
                Console.Error.WriteLine("[NativeDragReplay] Failed: " + error.Message);
                return false;
            }
            finally
            {
                if (mouseDown) Mouse(MOUSEEVENTF_LEFTUP);
                if (synthesizedShift) Key(VK_SHIFT, false);
                if (synthesizedCtrl) Key(VK_CONTROL, false);
                // This is one temporary system cursor during the replay,
                // not a truly independent second Windows OS pointer.
                MoveTo(origin, left, top, width, height);
            }
        }
    }
}
