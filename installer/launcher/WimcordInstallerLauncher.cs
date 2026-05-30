/*
 * Wimcord — Windows installer launcher
 * - Folder layout: WimcordInstaller.exe + lib/ + wimcord/ (dev / advanced)
 * - Single-file: payload appended after WIMCORDPK1 marker → extracts to %LocalAppData%\Wimcord
 */
using System;
using System.Collections;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Runtime.InteropServices;
using System.Text;

internal static class Program
{
    private static readonly byte[] PayloadMarker = Encoding.ASCII.GetBytes("WIMCORDPK1");

    private static int Main()
    {
        try
        {
            var exePath = Process.GetCurrentProcess().MainModule.FileName;
            var exeDir = Path.GetDirectoryName(exePath) ?? "";

            string root;
            string dataDir;
            string gui;

            var portableGui = Path.Combine(exeDir, "lib", "WimcordInstaller.Gui.exe");
            var portableData = Path.Combine(exeDir, "wimcord");

            if (File.Exists(portableGui))
            {
                root = exeDir;
                dataDir = portableData;
                gui = portableGui;
            }
            else
            {
                root = EnsureExtractedPayload(exePath);
                dataDir = Path.Combine(root, "wimcord");
                gui = Path.Combine(root, "lib", "WimcordInstaller.Gui.exe");
            }

            if (!File.Exists(gui))
            {
                ShowError(
                    "Wimcord installer files are missing.\n\n" +
                    "Expected:\n  " + gui + "\n\n" +
                    "Re-download WimcordInstaller.exe from GitHub.");
                return 1;
            }

            Directory.CreateDirectory(dataDir);
            return RunGui(gui, root, dataDir);
        }
        catch (Exception ex)
        {
            ShowError("Wimcord Installer failed:\n\n" + ex.Message);
            return 1;
        }
    }

    private static string EnsureExtractedPayload(string exePath)
    {
        var zipBytes = ReadEmbeddedZip(exePath);
        if (zipBytes == null || zipBytes.Length == 0)
        {
            throw new InvalidOperationException(
                "This installer is not a complete package. Download WimcordInstaller.exe from GitHub releases.");
        }

        string embeddedVersion;
        using (var ms = new MemoryStream(zipBytes))
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Read))
        {
            var verEntry = zip.GetEntry("version.txt");
            if (verEntry == null) throw new InvalidOperationException("Installer package is corrupt (version.txt missing).");
            using (var reader = new StreamReader(verEntry.Open()))
                embeddedVersion = reader.ReadToEnd().Trim();
        }

        var installRoot = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Wimcord");

        var stampFile = Path.Combine(installRoot, "package-version.txt");
        var installedVersion = File.Exists(stampFile) ? File.ReadAllText(stampFile).Trim() : "";
        var patcher = Path.Combine(installRoot, "wimcord", "dist", "patcher.js");

        if (installedVersion == embeddedVersion && File.Exists(patcher))
            return installRoot;

        if (Directory.Exists(installRoot))
        {
            try { Directory.Delete(installRoot, true); }
            catch
            {
                /* partial update — overwrite below */
            }
        }

        Directory.CreateDirectory(installRoot);

        using (var ms = new MemoryStream(zipBytes))
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Read))
        {
            foreach (var entry in zip.Entries)
            {
                if (string.IsNullOrEmpty(entry.Name)) continue;
                var dest = Path.Combine(installRoot, entry.FullName.Replace('/', Path.DirectorySeparatorChar));
                var dir = Path.GetDirectoryName(dest);
                if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
                entry.ExtractToFile(dest, true);
            }
        }

        File.WriteAllText(stampFile, embeddedVersion);
        return installRoot;
    }

    private static byte[] ReadEmbeddedZip(string exePath)
    {
        var data = File.ReadAllBytes(exePath);
        var markerLen = PayloadMarker.Length;

        for (var i = data.Length - markerLen - 8; i >= 0; i--)
        {
            var match = true;
            for (var m = 0; m < markerLen; m++)
            {
                if (data[i + m] != PayloadMarker[m]) { match = false; break; }
            }
            if (!match) continue;

            var zipLen = BitConverter.ToInt64(data, i + markerLen);
            if (zipLen <= 0 || zipLen > data.Length) continue;

            var zipStart = i + markerLen + 8;
            if (zipStart + zipLen > data.Length) continue;

            var zip = new byte[zipLen];
            Buffer.BlockCopy(data, zipStart, zip, 0, (int)zipLen);
            return zip;
        }

        return null;
    }

    private static int RunGui(string gui, string root, string dataDir)
    {
        var psi = new ProcessStartInfo();
        psi.FileName = gui;
        psi.WorkingDirectory = root;
        psi.UseShellExecute = false;

        foreach (DictionaryEntry entry in Environment.GetEnvironmentVariables())
        {
            var key = entry.Key as string;
            if (key == null) continue;
            psi.EnvironmentVariables[key] = entry.Value != null ? entry.Value.ToString() : "";
        }

        psi.EnvironmentVariables["VENCORD_USER_DATA_DIR"] = dataDir;
        psi.EnvironmentVariables["VENCORD_DEV_INSTALL"] = "1";
        psi.EnvironmentVariables["WIMCORD_ROOT"] = dataDir;

        var proc = Process.Start(psi);
        if (proc == null)
        {
            ShowError("Could not start Wimcord Installer.");
            return 1;
        }

        proc.WaitForExit();
        return proc.ExitCode;
    }

    private static void ShowError(string message)
    {
        try
        {
            MessageBox(IntPtr.Zero, message, "Wimcord Installer", 0x10);
        }
        catch
        {
            Console.Error.WriteLine(message);
        }
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int MessageBox(IntPtr hWnd, string text, string caption, uint type);
}
