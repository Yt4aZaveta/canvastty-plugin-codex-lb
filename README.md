# Codex LB Limits for CanvasTTY

A CanvasTTY HOME widget that shows each codex-lb account's remaining 5-hour and longer quota windows. It uses codex-lb's [`GET /api/fleet/summary`](https://github.com/Soju06/codex-lb/blob/main/app/modules/fleet/api.py) endpoint.

## Requirements

- CanvasTTY with runtime plugin support.
- A local codex-lb instance at `http://127.0.0.1:2455`.
- Python 3 for the small local bridge. No Python packages are required.
- A codex-lb API key with `upstream_limits` and `account_pool_usage` usage sections. The server setting that hides upstream quota from API keys must be off.

## Start the bridge

```sh
python3 bridge/bridge.py
```

The bridge listens only on `127.0.0.1:2456`. It forwards only `GET /api/fleet/summary` to local codex-lb and answers the CORS preflight from CanvasTTY's sandboxed widget. It does not store, log, or return the API key. Keep the terminal open while using the widget; stop it with Ctrl+C.

## Install the widget

In CanvasTTY, open **Settings → Plugins**, check `https://github.com/Yt4aZaveta/canvastty-plugin-codex-lb`, then install it. Add **Codex LB limits** through **Settings → Appearance → HOME composition**. Enter the API key in the widget; CanvasTTY stores it through its `secrets` SDK. The key is sent only to the loopback bridge, which forwards it to codex-lb.

The widget reads persisted quota snapshots once a minute. Its refresh button rereads those snapshots; it does not call codex-lb's upstream refresh route. Missing quota data is shown as unknown, not as 0%.

## Package layout

```text
canvastty.plugin.json   CanvasTTY manifest v1
widget/                 Static HTML, CSS and JavaScript
bridge/bridge.py        Optional local companion for browser CORS
```

CanvasTTY installs the static package from the root of this public GitHub repository. It does not execute the bridge automatically.
