using System;
using System.IO;
using System.Runtime.InteropServices;

namespace ShowSecondScreens.Input
{
    /// <summary>
    /// Native Windows Input Injection Engine using Win32 API.
    /// Reads one-line commands from Standard Input (stdin) and executes them instantly.
    /// </summary>
    public static class Program
    {
        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetCursorPos(int X, int Y);

        [DllImport("user32.dll")]
        private static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);

        private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        private const uint MOUSEEVENTF_LEFTUP = 0x0004;
        private const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
        private const uint MOUSEEVENTF_RIGHTUP = 0x0010;
        private const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
        private const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
        private const uint MOUSEEVENTF_WHEEL = 0x0800;

        public static void Main(string[] args)
        {
            // If arguments are passed directly for one-shot execution:
            // e.g. injector.exe move 100 200
            if (args != null && args.Length > 0)
            {
                ExecuteCommand(string.Join(" ", args));
                return;
            }

            // Stream / Daemon mode: Reads commands from stdin
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
                    case "move":
                        if (parts.Length >= 3)
                        {
                            int x = int.Parse(parts[1]);
                            int y = int.Parse(parts[2]);
                            SetCursorPos(x, y);
                        }
                        break;

                    case "mousedown":
                    case "down":
                        {
                            var btn = parts.Length >= 2 ? parts[1].ToLowerInvariant() : "left";
                            if (btn == "right") mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, UIntPtr.Zero);
                            else if (btn == "middle") mouse_event(MOUSEEVENTF_MIDDLEDOWN, 0, 0, 0, UIntPtr.Zero);
                            else mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                        }
                        break;

                    case "mouseup":
                    case "up":
                        {
                            var btn = parts.Length >= 2 ? parts[1].ToLowerInvariant() : "left";
                            if (btn == "right") mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, UIntPtr.Zero);
                            else if (btn == "middle") mouse_event(MOUSEEVENTF_MIDDLEUP, 0, 0, 0, UIntPtr.Zero);
                            else mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                        }
                        break;

                    case "click":
                        {
                            var btn = parts.Length >= 2 ? parts[1].ToLowerInvariant() : "left";
                            if (btn == "right")
                            {
                                mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, UIntPtr.Zero);
                                mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, UIntPtr.Zero);
                            }
                            else if (btn == "middle")
                            {
                                mouse_event(MOUSEEVENTF_MIDDLEDOWN, 0, 0, 0, UIntPtr.Zero);
                                mouse_event(MOUSEEVENTF_MIDDLEUP, 0, 0, 0, UIntPtr.Zero);
                            }
                            else
                            {
                                mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                                mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                            }
                        }
                        break;

                    case "dblclick":
                        {
                            mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
                            mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
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
                // Ignore parsing errors for uninterrupted high-speed streaming
            }
        }
    }
}
