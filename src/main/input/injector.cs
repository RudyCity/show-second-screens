using System;
using System.IO;
using System.Runtime.InteropServices;

namespace ShowSecondScreens.Input
{
    /// <summary>
    /// Native Windows Input Injection Engine using Win32 API.
    /// Supports Ghost Mode (restoring cursor to local window immediately) 
    /// and Direct Mode (moving cursor to target display).
    /// </summary>
    public static class Program
    {
        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetCursorPos(int X, int Y);

        [DllImport("user32.dll")]
        private static extern bool GetCursorPos(out POINT lpPoint);

        [DllImport("user32.dll")]
        private static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);

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
                    // Ghost Click: executes remote click at target without moving the physical cursor away
                    case "ghostclick":
                        if (parts.Length >= 3)
                        {
                            int tx = int.Parse(parts[1]);
                            int ty = int.Parse(parts[2]);
                            string btn = parts.Length >= 4 ? parts[3].ToLowerInvariant() : "left";

                            POINT orig;
                            GetCursorPos(out orig);

                            SetCursorPos(tx, ty);
                            FireClick(btn);
                            SetCursorPos(orig.X, orig.Y);
                        }
                        break;

                    case "ghostdblclick":
                        if (parts.Length >= 3)
                        {
                            int tx = int.Parse(parts[1]);
                            int ty = int.Parse(parts[2]);

                            POINT orig;
                            GetCursorPos(out orig);

                            SetCursorPos(tx, ty);
                            FireClick("left");
                            FireClick("left");
                            SetCursorPos(orig.X, orig.Y);
                        }
                        break;

                    case "ghostwheel":
                        if (parts.Length >= 4)
                        {
                            int tx = int.Parse(parts[1]);
                            int ty = int.Parse(parts[2]);
                            int delta = int.Parse(parts[3]);

                            POINT orig;
                            GetCursorPos(out orig);

                            SetCursorPos(tx, ty);
                            mouse_event(MOUSEEVENTF_WHEEL, 0, 0, (uint)delta, UIntPtr.Zero);
                            SetCursorPos(orig.X, orig.Y);
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

                    // Direct Mode (Warps cursor to target)
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

        private static void FireClick(string btn)
        {
            FireDown(btn);
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
