# Codex LB Limits for CanvasTTY

A CanvasTTY HOME widget that shows each codex-lb account's remaining 5-hour and longer quota windows. It uses codex-lb's [`GET /api/fleet/summary`](https://github.com/Soju06/codex-lb/blob/main/app/modules/fleet/api.py) endpoint.

## Requirements

- CanvasTTY with runtime plugin support, running on the same computer as the local Caddy endpoint.
- Docker Compose for the included [compose.yaml](compose.yaml) example, or an equivalent local codex-lb and Caddy setup.
- A codex-lb API key with the `upstream_limits` and `account_pool_usage` usage sections. The codex-lb setting that hides upstream quota from API keys must be off.

## Start the local services (Docker Compose example)

The included [compose.yaml](compose.yaml) starts codex-lb and Caddy. It expects an external Docker network and volume named `codex-lb-net` and `codex-lb-data`, so an existing codex-lb data volume can be reused. Clone this repository, create the network and volume only if they do not already exist, then start the stack:

```sh
git clone https://github.com/Yt4aZaveta/canvastty-plugin-codex-lb.git
cd canvastty-plugin-codex-lb
docker network create codex-lb-net
docker volume create codex-lb-data
docker compose up -d
```

If the network or volume already exists, skip its `create` command. The example publishes codex-lb's ports `2455` and `1455` on the host; Caddy listens only on `127.0.0.1:2456`. Caddy forwards `GET /api/fleet/summary` to `codex-lb:2455` on the Docker network and answers the CORS preflight from CanvasTTY's sandboxed widget. The API key passes through Caddy in the request header and is not stored there.

## Install in CanvasTTY

1. Open **Settings → Plugins**.
2. Paste `https://github.com/Yt4aZaveta/canvastty-plugin-codex-lb`, click **Check**, review the `network` and `secrets` permissions, then click **Install**. CanvasTTY installs the ready-to-run files from this public repository; Docker Compose is started separately.
3. The HOME widget is added automatically when there is room. If it is not visible, add **Codex LB limits** under **Settings → Appearance → HOME composition**.
4. Enter the codex-lb API key in the widget and click **Save** (or press Enter). CanvasTTY stores it through its `secrets` SDK. The widget shows save progress or errors above the key field.

To update, use **Settings → Plugins → Check updates → Update**. If the HOME widget was already open, **Disable** and then **Enable** this plugin in the same section to reload its iframe with the new files. This keeps the plugin installed and its saved key.

The widget follows CanvasTTY's selected `sage`, `lilac`, or `night` palette through the plugin context, including changes while it is open. CanvasTTY's plugin context does not expose the separate HOME accent preset.

The widget reads persisted quota snapshots on opening and once a minute. Its refresh button rereads those snapshots; it does not call codex-lb's upstream refresh route. Missing quota data is shown as unknown, not as 0%.

## Package layout

```text
canvastty.plugin.json   CanvasTTY manifest v1
widget/                 Static HTML, CSS and JavaScript
compose.yaml             codex-lb and Caddy services
Caddyfile                CORS for the fleet summary endpoint
bridge/bridge.py         Legacy standalone bridge
```

The manifest stays at the repository root, as supported by CanvasTTY's [runtime plugin format](https://github.com/howdeploy/CanvasTTY/blob/main/docs/plugins.md). No build step is required.
