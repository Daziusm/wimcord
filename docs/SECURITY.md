# Security

Wimcord is a local Discord client modification. It does not run a central account service for your Discord login.

## What we do not collect or store

- Discord passwords or account tokens
- Message content, DMs, or server data
- Voice or screen capture

Optional **Wimcord badges** use a small public registry. If you enable auto-register, only your **Discord user id** is sent to the badge server so the client can show the Wimcord User badge. No token is transmitted for that feature.

## Local data

Settings, plugin toggles, and diagnostic logs stay on your machine under the Vencord/Wimcord data directory unless you export them yourself.

## Bundled plugins

Some optional plugins (for example account tools from upstream Nightcord) interact with Discord authentication. They are **off by default** and are your responsibility to use only on accounts you own. Using them may violate Discord’s Terms of Service.

## Reporting issues

Open a GitHub issue with steps to reproduce. Do not paste tokens, admin keys, or full diagnostic dumps in public tickets.
