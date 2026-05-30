/*
 * Wimcord — tiny Windows launcher (sets portable data dir, opens branded GUI installer)
 * Compile: node scripts/build-wimcord-installer-launcher.mjs
 */
using System;
using System.Collections;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;

internal static class Program
{
    private static int Main()
    {
        var root = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\', '/');
        var dataDir = Path.Combine(root, "wimcord");
        var gui = Path.Combine(root, "lib", "WimcordInstaller.Gui.exe");

        if (!File.Exists(gui))
        {
            ShowError(
                "Wimcord installer files are missing.\n\n" +
                "Expected:\n  " + gui + "\n\n" +
                "Re-download the release zip from GitHub.");
            return 1;
        }

        Directory.CreateDirectory(dataDir);

        try
        {
            var psi = new ProcessStartInfo();
            psi.FileName = gui;
            psi.WorkingDirectory = root;
            psi.UseShellExecute = false;

            foreach (DictionaryEntry entry in Environment.GetEnvironmentVariables())
            {
                var key = entry.Key as string;
                if (key == null) continue;
                var val = entry.Value;
                psi.EnvironmentVariables[key] = val != null ? val.ToString() : "";
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
        catch (Exception ex)
        {
            ShowError("Failed to start Wimcord Installer:\n\n" + ex.Message);
            return 1;
        }
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
