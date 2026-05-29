# Wimcord badge server

Wimcord clients:

1. **POST** their Discord user id to register (optional, user-controlled).
2. **GET** a public JSON registry of who should show badges.

No Discord tokens are sent to this service.

## Public URLs

| URL | Purpose |
|-----|---------|
| `https://wim.wimdium.com/wimcord/badges.json` | Public registry |
| `https://wim.wimdium.com/api/wimcord/register` | Enrollment (POST) |

Copy [`docs/examples/wimcord-badges.example.json`](examples/wimcord-badges.example.json) to `badges.json` on your host.

## Registry format

```json
{
  "version": 1,
  "badges": [
    {
      "id": "user",
      "description": "Wimcord User",
      "iconSrc": "https://example.com/wimcord-user.png"
    }
  ],
  "grants": {
    "123456789012345678": ["user"]
  }
}
```

## Self-hosting

Run a small Node service that serves `badges.json` and the register/admin routes, then reverse-proxy `/wimcord/*` and `/api/wimcord/*` on your domain. Implementation is operator-specific and not shipped in this repository.

Environment (never commit real values):

| Variable | Purpose |
|----------|---------|
| `PORT` | Listen port (default 3001) |
| `WIMCORD_BADGE_ADMIN_KEY` | Admin API bearer secret (server only) |

## Admin API (operators)

Requires `Authorization: Bearer <WIMCORD_BADGE_ADMIN_KEY>`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/wimcord/admin/registry` | Full registry |
| PUT | `/api/wimcord/admin/badges/:id` | Create/update badge |
| DELETE | `/api/wimcord/admin/badges/:id` | Delete badge |
| POST | `/api/wimcord/admin/grant` | Grant or revoke badge for a user id |

Manage badges with curl or your own tooling — not from the public Wimcord client build.

## Client defaults

- `badgeRegistryUrl`: `https://wim.wimdium.com/wimcord/badges.json`
- `badgeRegisterUrl`: `https://wim.wimdium.com/api/wimcord/register`
- `badgeAutoRegister`: `true` (sends **user id only**)
