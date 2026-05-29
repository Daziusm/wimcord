/*
 * Wimcord — diagnostic session id (shared to avoid circular imports)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

let sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function getDiagnosticSessionId() {
    return sessionId;
}

export function resetDiagnosticSessionId() {
    sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    return sessionId;
}
