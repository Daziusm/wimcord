/*
 * Wimcord — media permission helpers for multi-instance Discord windows
 * Adapted from Nightcord (GPL-3.0-or-later)
 */

import { Session, session, systemPreferences } from "electron";

export function registerMediaPermissionsForSession(ses: Session) {
    ses.setPermissionCheckHandler((_webContents, permission) => {
        if (permission === "media") return true;
        return true;
    });

    ses.setPermissionRequestHandler(async (_webContents, permission, callback, details) => {
        if (permission === "media") {
            let granted = true;

            if (process.platform === "darwin" && "mediaTypes" in details) {
                if (details.mediaTypes?.includes("audio")) {
                    granted &&= await systemPreferences.askForMediaAccess("microphone");
                }
                if (details.mediaTypes?.includes("video")) {
                    granted &&= await systemPreferences.askForMediaAccess("camera");
                }
            }

            return callback(granted);
        }

        callback(true);
    });
}

export function registerMediaPermissionsHandler() {
    registerMediaPermissionsForSession(session.defaultSession);
}
