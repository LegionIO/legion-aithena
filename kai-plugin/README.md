# kai-plugin-legion

Legion daemon integration plugin for [Kai desktop](https://github.com/anthropics/kai-desktop). Provides daemon health monitoring, event streaming, proactive GAIA threads, workflow routing, knowledge panels, marketplace tooling, GitHub views, sub-agent management, and an optional daemon inference backend.

## Quick Start

```bash
# Clone (or navigate to the directory if already in legion-interlink)
cd kai-plugin

# Install dependencies
pnpm install

# Build both main + renderer bundles
pnpm run build

# Symlink the dist/ output into Kai's plugin directory
mkdir -p ~/.kai/plugins
ln -s "$(pwd)/dist" ~/.kai/plugins/legion
```

Launch (or restart) Kai desktop — it will discover the plugin and prompt you to approve its permissions.

## Development

```bash
# Watch mode — rebuilds on file changes
pnpm run dev

# Type-check without emitting
pnpm run check

# Clean build output
pnpm run clean
```

After rebuilding, restart Kai desktop to pick up changes (the host hashes plugin files on load).

## Project Structure

```
kai-plugin/
├── plugin.json                  # Plugin manifest (name, permissions, config schema)
├── esbuild.config.mjs           # Build script: main → dist/main.mjs, renderer → dist/renderer.mjs
├── tsconfig.json                # TypeScript config (noEmit, strict)
├── src/
│   ├── main/                    # Main process (19 modules → bundled to dist/main.mjs)
│   │   ├── index.ts             # activate() / deactivate() entry point
│   │   ├── daemon-client.ts     # HTTP client with circuit breaker + JWT auth
│   │   ├── events.ts            # SSE event stream with auto-reconnect
│   │   ├── backend.ts           # Agent backend registration
│   │   ├── backend-stream.ts    # Streaming inference from daemon
│   │   ├── tools.ts             # 8 registered tools
│   │   ├── actions.ts           # Action handler dispatcher
│   │   ├── actions-daemon.ts    # 65+ daemon CRUD action handlers
│   │   ├── workflows.ts         # Trigger dispatch + triage routing
│   │   ├── conversations.ts     # Managed conversations + proactive GAIA thread
│   │   ├── knowledge.ts         # Apollo query, ingest, monitors
│   │   └── ...                  # config, constants, state, ui, utils, types, doctor
│   └── renderer/                # Renderer (53 modules → bundled to dist/renderer.mjs)
│       ├── index.ts             # register() entry point
│       ├── lib/                 # React shim, hooks, utils, bridge
│       ├── components/          # 14 shared UI primitives
│       ├── panels/              # 9 panel views (Dashboard, Knowledge, GitHub, etc.)
│       └── settings/            # 25 settings tabs (LLM, Tasks, GAIA, Extensions, etc.)
└── dist/                        # Build output (gitignored)
    ├── plugin.json              # Copied from root
    ├── main.mjs                 # Bundled main process
    └── renderer.mjs             # Bundled renderer
```

## Installing Without Symlink

If you prefer to copy instead of symlink:

```bash
pnpm run build
mkdir -p ~/.kai/plugins/legion
cp dist/plugin.json dist/main.mjs dist/renderer.mjs ~/.kai/plugins/legion/
```

## Configuration

After loading, open **Settings → Legion** in Kai desktop. The plugin exposes 28 config fields under the Connection, Behavior, and Threads & Rules tabs. At minimum you need:

- **Daemon URL** — e.g. `http://127.0.0.1:4567`
- **Config Dir** — path containing `crypt.json` for JWT auth (auto-detected from `~/.kai/settings`, `~/.legion/settings`, or `~/.config/legion/settings`)

## Permissions

The plugin requests these host permissions on first load:

| Permission | Purpose |
|---|---|
| `config:read/write` | Read and persist plugin settings |
| `tools:register` | Register 8 conversation tools |
| `ui:banner/modal/settings/panel/navigation` | Status banner, settings section, 8 panels, sidebar nav items |
| `messages:hook` | Pre/post message processing |
| `network:fetch` | HTTP requests to daemon |
| `notifications:send` | Toast and native OS notifications |
| `conversations:read/write` | Manage Legion/GAIA threads |
| `navigation:open` | Open panels and conversations programmatically |
| `state:publish` | Publish plugin state to renderer |
| `agent:backend` | Register Legion as an inference backend |

## License

MIT
