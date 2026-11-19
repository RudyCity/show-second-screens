using System;
using System.IO;
using System.Collections.Generic;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;

namespace ShowSecondScreens.Input
{
    /// <summary>
    /// Cursor-independent Windows window moving and Explorer file transfers.
    /// No SetCursorPos or synthetic mouse buttons are used in this helper.
    /// General OLE drag-and-drop between arbitrary apps is NOT implemented.
    /// </summary>
    internal static class VirtualDrag
    {
        private const uint GA_ROOT = 2;
        private const uint WM_NCHITTEST = 0x0084;
        private const uint SMTO_ABORTIFHUNG = 0x0002;
        private const int HTCAPTION = 2;
        private const uint SWP_NOSIZE = 0x0001;
        private const uint SWP_NOZORDER = 0x0004;
        private const uint SWP_NOACTIVATE = 0x0010;
        private const uint SWP_ASYNCWINDOWPOS = 0x4000;
        private const uint MB_YESNO = 0x00000004;
        private const uint MB_ICONQUESTION = 0x00000020;
        private const uint MB_DEFBUTTON2 = 0x00000100;
        private const uint MB_OK = 0x00000000;
        private const uint MB_ICONERROR = 0x00000010;
        private const uint MB_TOPMOST = 0x00040000;
        private const int IDYES = 6;

        [StructLayout(LayoutKind.Sequential)]
        private struct POINT { public int X; public int Y; }
        [StructLayout(LayoutKind.Sequential)]
        private struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
        [DllImport("user32.dll")] private static extern IntPtr WindowFromPoint(POINT point);
        [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);
        [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
        [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr hwnd);
        [DllImport("user32.dll")] private static extern bool IsZoomed(IntPtr hwnd);
        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr SendMessageTimeout(IntPtr hwnd, uint message, IntPtr wparam,
            IntPtr lparam, uint flags, uint timeout, out IntPtr result);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern int MessageBox(IntPtr hwnd, string text, string caption, uint flags);

        private enum DragKind { None, Window, ExplorerFiles }
        private static DragKind kind = DragKind.None;
        private static IntPtr window = IntPtr.Zero;
        private static int originX;
        private static int originY;
        private static RECT originalRect;
        private static List<string> sourceFiles = new List<string>();
        private static string sourceFolder;

        private static IntPtr RootAt(int x, int y)
        {
            var child = WindowFromPoint(new POINT { X = x, Y = y });
            return child == IntPtr.Zero ? IntPtr.Zero : GetAncestor(child, GA_ROOT);
        }

        private static bool IsTitleBar(IntPtr hwnd, int x, int y)
        {
            if (hwnd == IntPtr.Zero || IsZoomed(hwnd)) return false;
            IntPtr hit;
            var packed = new IntPtr((long)((uint)(ushort)x | ((uint)(ushort)y << 16)));
            if (SendMessageTimeout(hwnd, WM_NCHITTEST, IntPtr.Zero, packed,
                SMTO_ABORTIFHUNG, 100, out hit) == IntPtr.Zero) return false;
            return hit.ToInt64() == HTCAPTION;
        }

        /// <summary>
        /// Reflection-based Shell automation avoids adding COM reference DLLs
        /// to the .NET Framework command-line build.
        /// </summary>
        private static object Com(object target, string name, bool method, params object[] args)
        {
            if (target == null) return null;
            return target.GetType().InvokeMember(name,
                BindingFlags.Public | BindingFlags.Instance |
                (method ? BindingFlags.InvokeMethod : BindingFlags.GetProperty),
                null, target, args);
        }

        private static bool TryGetExplorer(IntPtr hwnd, out string folder, out List<string> selected)
        {
            folder = null;
            selected = new List<string>();
            if (hwnd == IntPtr.Zero) return false;
            object shell = null, windows = null;
            try
            {
                var type = Type.GetTypeFromProgID("Shell.Application");
                if (type == null) return false;
                shell = Activator.CreateInstance(type);
                windows = Com(shell, "Windows", true);
                int count = Convert.ToInt32(Com(windows, "Count", false));
                for (int i = 0; i < count; i++)
                {
                    object item = null, doc = null;
                    try
                    {
                        item = Com(windows, "Item", true, i);
                        if (item == null) continue;
                        long handle = Convert.ToInt64(Com(item, "HWND", false));
                        if (handle != hwnd.ToInt64()) continue;
                        doc = Com(item, "Document", false);
                        object dir = Com(doc, "Folder", false);
                        object self = Com(dir, "Self", false);
                        folder = Convert.ToString(Com(self, "Path", false));
                        if (string.IsNullOrEmpty(folder) || !Directory.Exists(folder))
                            return false;
                        object collection = Com(doc, "SelectedItems", true);
                        int selectedCount = Convert.ToInt32(Com(collection, "Count", false));
                        if (selectedCount > 100) return false;
                        for (int j = 0; j < selectedCount; j++)
                        {
                            object entry = Com(collection, "Item", true, j);
                            var file = Convert.ToString(Com(entry, "Path", false));
                            if (!string.IsNullOrEmpty(file) && (File.Exists(file) || Directory.Exists(file)))
                                selected.Add(Path.GetFullPath(file));
                        }
                        return true;
                    }
                    catch { /* This is not an ordinary filesystem Explorer view. */ }
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("[VirtualDrag] Explorer lookup failed: " + ex.Message);
            }
            finally
            {
                if (windows != null && Marshal.IsComObject(windows)) Marshal.ReleaseComObject(windows);
                if (shell != null && Marshal.IsComObject(shell)) Marshal.ReleaseComObject(shell);
            }
            return false;
        }

        public static void Start(int x, int y)
        {
            Cancel();
            var hwnd = RootAt(x, y);
            if (hwnd == IntPtr.Zero) return;
            RECT rect;
            if (IsTitleBar(hwnd, x, y) && GetWindowRect(hwnd, out rect))
            {
                kind = DragKind.Window;
                window = hwnd;
                originX = x;
                originY = y;
                originalRect = rect;
                return;
            }
            string folder;
            List<string> files;
            if (TryGetExplorer(hwnd, out folder, out files) && files.Count > 0)
            {
                kind = DragKind.ExplorerFiles;
                sourceFolder = folder;
                sourceFiles = files;
            }
        }

        public static void Move(int x, int y)
        {
            if (kind != DragKind.Window || !IsWindow(window)) return;
            var dx = x - originX;
            var dy = y - originY;
            SetWindowPos(window, IntPtr.Zero, originalRect.Left + dx, originalRect.Top + dy,
                0, 0, SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_ASYNCWINDOWPOS);
        }

        public static void Finish(int x, int y, bool ctrl, bool shift)
        {
            var action = kind;
            var files = new List<string>(sourceFiles);
            if (action == DragKind.Window) Move(x, y);
            Cancel();
            if (action == DragKind.Window) return;
            if (action != DragKind.ExplorerFiles) return;
            string destination;
            List<string> ignored;
            if (!TryGetExplorer(RootAt(x, y), out destination, out ignored))
            {
                MessageBox(IntPtr.Zero,
                    "Drop onto an open File Explorer folder on the destination display.",
                    "File transfer unavailable", MB_OK | MB_ICONERROR | MB_TOPMOST);
                return;
            }
            Transfer(files, destination, ctrl, shift);
        }

        public static void Cancel()
        {
            kind = DragKind.None;
            window = IntPtr.Zero;
            sourceFiles.Clear();
            sourceFolder = null;
        }

        public static void DropFiles(string encodedPaths, int x, int y, bool ctrl, bool shift)
        {
            try
            {
                var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(encodedPaths));
                var paths = decoded.Split(new[] { '\n' }, StringSplitOptions.RemoveEmptyEntries);
                if (paths.Length == 0 || paths.Length > 100) return;
                string folder;
                List<string> ignored;
                if (!TryGetExplorer(RootAt(x, y), out folder, out ignored))
                {
                    MessageBox(IntPtr.Zero,
                        "Drop onto an open File Explorer folder on the destination display.",
                        "File transfer unavailable", MB_OK | MB_ICONERROR | MB_TOPMOST);
                    return;
                }
                Transfer(new List<string>(paths), folder, ctrl, shift);
            }
            catch (Exception ex)
            {
                MessageBox(IntPtr.Zero, ex.Message, "File transfer failed", MB_OK | MB_ICONERROR | MB_TOPMOST);
            }
        }

        private static void Transfer(List<string> paths, string destination, bool ctrl, bool shift)
        {
            if (paths.Count == 0 || paths.Count > 100 || !Directory.Exists(destination)) return;
            var actual = new List<string>();
            foreach (var candidate in paths)
            {
                var src = Path.GetFullPath(candidate);
                if (!File.Exists(src) && !Directory.Exists(src)) continue;
                if (Directory.Exists(src) && (File.GetAttributes(src) & FileAttributes.ReparsePoint) != 0)
                    continue; // Never traverse a directory junction/reparse point.
                var dst = Path.GetFullPath(Path.Combine(destination, Path.GetFileName(src.TrimEnd('\\'))));
                if (string.Equals(src.TrimEnd('\\'), dst.TrimEnd('\\'), StringComparison.OrdinalIgnoreCase)
                    || dst.StartsWith(src.TrimEnd('\\') + "\\", StringComparison.OrdinalIgnoreCase))
                    continue;
                if (File.Exists(dst) || Directory.Exists(dst)) continue; // Never overwrite.
                actual.Add(src);
            }
            if (actual.Count == 0)
            {
                MessageBox(IntPtr.Zero, "No transferable files were found or the destination already contains them.",
                    "Nothing to transfer", MB_OK | MB_ICONERROR | MB_TOPMOST);
                return;
            }
            // Explorer semantics: Ctrl copies, Shift moves; otherwise same volume
            // moves and crossing volumes copies.
            bool copy = ctrl || (!shift && !SameVolume(actual[0], destination));
            string action = copy ? "Copy" : "Move";
            string summary = action + " " + actual.Count + " item(s) to:\n" + destination
                + "\n\nExisting files are never overwritten. Continue?";
            if (MessageBox(IntPtr.Zero, summary, "Confirm file transfer",
                MB_YESNO | MB_ICONQUESTION | MB_DEFBUTTON2 | MB_TOPMOST) != IDYES) return;

            var failures = new List<string>();
            int successes = 0;
            foreach (var src in actual)
            {
                try
                {
                    var dst = Path.Combine(destination, Path.GetFileName(src.TrimEnd('\\')));
                    bool itemCopy = ctrl || (!shift && !SameVolume(src, destination));
                    if (Directory.Exists(src))
                    {
                        if (itemCopy) CopyDirectory(src, dst);
                        else Directory.Move(src, dst);
                    }
                    else if (itemCopy) File.Copy(src, dst, false);
                    else File.Move(src, dst);
                    successes++;
                }
                catch (Exception ex) { failures.Add(Path.GetFileName(src) + ": " + ex.Message); }
            }
            if (failures.Count > 0)
                MessageBox(IntPtr.Zero, "Transferred " + successes + " item(s).\nFailed " +
                    failures.Count + " item(s):\n" + string.Join("\n", failures.ToArray()),
                    "File transfer partially completed", MB_OK | MB_ICONERROR | MB_TOPMOST);
        }

        private static bool SameVolume(string source, string target)
        {
            return string.Equals(Path.GetPathRoot(source), Path.GetPathRoot(target),
                StringComparison.OrdinalIgnoreCase);
        }

        private static void CopyDirectory(string source, string target)
        {
            Directory.CreateDirectory(target);
            foreach (var file in Directory.GetFiles(source))
                File.Copy(file, Path.Combine(target, Path.GetFileName(file)), false);
            foreach (var dir in Directory.GetDirectories(source))
            {
                if ((File.GetAttributes(dir) & FileAttributes.ReparsePoint) != 0)
                    throw new IOException("Directory junctions and symlink directories cannot be copied safely.");
                CopyDirectory(dir, Path.Combine(target, Path.GetFileName(dir)));
            }
        }
    }
}
