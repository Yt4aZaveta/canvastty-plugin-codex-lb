# Codex LB Limits for CanvasTTY

A CanvasTTY HOME widget that shows each codex-lb account's remaining 5-hour and longer quota windows. It uses codex-lb's [`GET /api/fleet/summary`](https://github.com/Soju06/codex-lb/blob/main/app/modules/fleet/api.py) endpoint.

## Requirements

- CanvasTTY with runtime plugin support.
- A local codex-lb instance at `http://127.0.0.1:2455`.
- Docker Compose with the included Caddy configuration.
- A codex-lb API key with `upstream_limits` and `account_pool_usage` usage sections. The server setting that hides upstream quota from API keys must be off.

## Run codex-lb and Caddy

```sh
docker compose up -d
```

Caddy listens only on `127.0.0.1:2456`. It forwards only `GET /api/fleet/summary` to local codex-lb and answers the CORS preflight from CanvasTTY's sandboxed widget. The API key is sent in the request header to codex-lb; Caddy does not store it. The Compose file uses the existing external `codex-lb-net` network and `codex-lb-data` volume.

## Install the widget

In CanvasTTY, open **Settings → Plugins**, check `https://github.com/Yt4aZaveta/canvastty-plugin-codex-lb`, then install it. Add **Codex LB limits** through **Settings → Appearance → HOME composition**. Enter the API key in the widget and click **Save**; CanvasTTY stores it through its `secrets` SDK. The key is sent only to the loopback Caddy endpoint, which forwards it to codex-lb.

The widget reads persisted quota snapshots once a minute. Its refresh button rereads those snapshots; it does not call codex-lb's upstream refresh route. Missing quota data is shown as unknown, not as 0%.

## Package layout

```text
canvastty.plugin.json   CanvasTTY manifest v1
widget/                 Static HTML, CSS and JavaScript
compose.yaml             codex-lb and Caddy services
Caddyfile                CORS for the fleet summary endpoint
bridge/bridge.py         Legacy standalone bridge
```

CanvasTTY installs the static package from the root of this public GitHub repository. Docker Compose starts the Caddy endpoint separately.
