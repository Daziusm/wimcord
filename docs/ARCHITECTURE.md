# Wimcord architecture

## Principles

1. **Extension over modification** — prefer `wimcord-plugins` and `userplugins` over editing Vencord core.
2. **Patches are last resort** — `wimcord-patches` only for branding/compatibility; every patch has a predicate and must not contain plugin business logic.
3. **Plugins are the product surface** — features ship as plugins with metadata, settings, and isolated lifecycle.
4. **Performance first** — lazy plugin start, module resolution cache, no always-on observers unless required.
5. **Upstream-friendly** — minimize diffs in `src/Vencord.ts`, `scripts/build/`, and `_core` plugins.

## Boot sequence

```
initWimcordCore()
  → registerWimcordPatches()      // push to webpack patches[]
  → loadWimcordConfig()
  → syncWimcordPluginEnables()    // feature toggles → Settings.plugins
  → installWimcordDevApi()        // window.Wimcord in dev
  → checkCompatibility()
initPluginManager()
startAllPlugins(StartAt.Init)
…
```

## Module map

### `wimcord-core`

- `branding.ts` — product name and settings copy
- `config.ts` — persisted feature toggles (DataStore)
- `logger.ts` — structured log buffer + scoped loggers
- `compat.ts` — Discord build validation warnings
- `lifecycle.ts` — phase hooks (`pre-init`, `init`, `webpack-ready`, `dom-ready`)
- `moduleCache.ts` — memoize webpack lookups
- `pluginSync.ts` — maps toggles to Vencord plugin enabled flags
- `dev.ts` — `window.Wimcord` dev API

### `wimcord-patches`

Registered before plugins load. Patches use `plugin: "WimcordCore"` for traceability.

### `wimcord-plugins`

Bundled via the same esbuild `~plugins` glob as Vencord plugins (`wimcord-plugins` added in `scripts/build/common.mjs`).

Folders prefixed with `_` (e.g. `_shared`) are excluded by the glob rules.

## Adding a feature

1. Create `src/wimcord-plugins/myFeature/index.ts`
2. Use `definePlugin` from `@utils/types`
3. Add a feature toggle in `wimcord-core/config.ts` if it should be gated
4. Map the toggle in `wimcord-core/pluginSync.ts`
5. **Do not** add Discord internals patches in the plugin — put guards in `wimcord-patches` if unavoidable

## Patch checklist

- [ ] Predicate / build range guard
- [ ] Fallback or no-op when `find` fails
- [ ] Debug log in dev builds
- [ ] No auth/token/session code
- [ ] Documented in patch file header

## CLI

`scripts/wimcord-cli.mjs` wraps:

- `build` → `pnpm build`
- `dev` → `pnpm dev` (watch)
- `inject` → `pnpm inject`
- `clean` → remove `dist/`, `browser/`
