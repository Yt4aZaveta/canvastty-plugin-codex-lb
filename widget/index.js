const host = window.CanvasTTYPlugin;
const config = window.CodexLBConfig;
const accounts = document.querySelector("#accounts");
const message = document.querySelector("#message");
const updated = document.querySelector("#updated");
const refreshButton = document.querySelector("#refresh");
const configureButton = document.querySelector("#configure");
let apiKey = null;
let endpoint = null;
let configurationVersion = 0;
let activeRequest = null;

host.onContext(({ appearance }) => {
  document.documentElement.dataset.palette = appearance.palette;
});

function showMessage(text) {
  message.textContent = text;
  message.hidden = false;
}

function formatTime(value) {
  if (!value) return null;
  const time = new Date(value);
  return Number.isNaN(time.getTime())
    ? null
    : new Intl.DateTimeFormat("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(time);
}

function quota(label, window) {
  const column = document.createElement("div");
  column.className = "quota";
  const title = document.createElement("div");
  title.className = "quota-title";
  const name = document.createElement("span");
  name.textContent = label;
  const value = document.createElement("strong");
  const remaining = window?.remainingPercent;
  value.textContent = typeof remaining === "number" && Number.isFinite(remaining)
    ? `${Math.round(remaining)}%`
    : "—";
  title.append(name, value);

  const track = document.createElement("div");
  track.className = "track";
  const fill = document.createElement("div");
  fill.className = "fill";
  if (typeof remaining === "number" && Number.isFinite(remaining)) {
    fill.style.width = `${Math.max(0, Math.min(100, remaining))}%`;
    if (remaining < 20) fill.classList.add("low");
  }
  track.append(fill);

  const reset = document.createElement("div");
  reset.className = "reset";
  const resetTime = formatTime(window?.resetAt);
  reset.textContent = resetTime ? `Сброс ${resetTime}` : "Время сброса неизвестно";
  column.append(title, track, reset);
  return column;
}

function windowLabel(window, fallback) {
  const minutes = window?.windowMinutes;
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) return fallback;
  const hours = minutes / 60;
  return hours < 24 ? `${Math.round(hours)} ч` : `${Math.round(hours / 24)} д`;
}

function render(data) {
  accounts.replaceChildren();
  if (data.length === 0) {
    showMessage("Нет аккаунтов, доступных этому API-ключу.");
    updated.textContent = "";
    return;
  }
  message.hidden = true;
  for (const account of data) {
    const row = document.createElement("article");
    row.className = "account";
    const info = document.createElement("div");
    info.className = "account-info";
    const name = document.createElement("div");
    name.className = "account-name";
    name.textContent = account.displayName || account.email || account.accountId || "Аккаунт";
    const meta = document.createElement("div");
    meta.className = "account-meta";
    const refreshed = formatTime(account.usageRefreshedAt);
    meta.textContent = [account.planType, account.status, refreshed ? `данные ${refreshed}` : "нет данных о лимите"]
      .filter(Boolean).join(" · ");
    info.append(name, meta);
    row.append(
      info,
      quota(windowLabel(account.primary, "5 ч"), account.primary),
      quota(windowLabel(account.secondary, "Длинный"), account.secondary)
    );
    accounts.append(row);
  }
  updated.textContent = `Получено ${new Intl.DateTimeFormat("ru", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`;
}

async function refresh() {
  if (!apiKey || !endpoint || activeRequest) return;
  const request = { controller: new AbortController(), version: configurationVersion };
  activeRequest = request;
  refreshButton.disabled = true;
  if (!accounts.childElementCount) showMessage("Загрузка лимитов…");
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    request.controller.abort();
  }, 15_000);
  let failure = "Не удалось подключиться к выбранному серверу. Проверьте доступность, TLS, CORS и конечный URL без перенаправлений.";
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      signal: request.controller.signal
    });
    if (response.status === 401 || response.status === 403) {
      failure = `Сервер отклонил авторизацию (HTTP ${response.status}). Проверьте API-ключ и его права в настройках плагина.`;
      throw new Error();
    }
    if (!response.ok) {
      failure = `Не удалось получить лимиты от выбранного сервера: HTTP ${response.status}.`;
      throw new Error();
    }
    const body = await response.text();
    failure = "Ответ codex-lb имеет неверный формат: ожидается JSON с массивом accounts.";
    const payload = JSON.parse(body);
    if (!Array.isArray(payload?.accounts) || payload.accounts.some((account) =>
      !account || typeof account !== "object" || Array.isArray(account))) throw new Error();
    if (request.version !== configurationVersion) return;
    render(payload.accounts);
  } catch {
    if (request.version !== configurationVersion) return;
    showMessage(timedOut
      ? "Выбранный сервер не ответил за 15 секунд. Повторите обновление или проверьте подключение."
      : failure);
    if (accounts.childElementCount) updated.textContent = "Показаны последние полученные данные";
  } finally {
    clearTimeout(timeout);
    if (activeRequest === request) {
      activeRequest = null;
      refreshButton.disabled = false;
    }
  }
}

async function applyConfiguration(saved) {
  const version = ++configurationVersion;
  activeRequest?.controller.abort();
  activeRequest = null;
  apiKey = null;
  endpoint = null;
  refreshButton.disabled = true;
  accounts.replaceChildren();
  updated.textContent = "";
  showMessage("Читаю настройки подключения…");
  let failure = "Не удалось прочитать настройки из storage CanvasTTY.";
  try {
    const stored = saved === undefined ? await host.storage.get(config.storageKey) : saved;
    if (version !== configurationVersion) return;
    let baseUrl;
    try {
      baseUrl = config.baseUrlFromStorage(stored);
    } catch (error) {
      failure = error.message;
      throw error;
    }
    failure = "Защищённое хранилище CanvasTTY недоступно. Не удалось прочитать API-ключ.";
    const key = await host.secrets.get(config.secretName);
    if (version !== configurationVersion) return;
    endpoint = config.summaryEndpoint(baseUrl);
    apiKey = key;
    refreshButton.disabled = !apiKey;
    if (!apiKey) {
      showMessage("Откройте настройки плагина через ⚙ и сохраните API-ключ codex-lb, чтобы показать лимиты.");
      return;
    }
    await refresh();
  } catch {
    if (version === configurationVersion) showMessage(failure);
  }
}

configureButton.addEventListener("click", async () => {
  try {
    await host.canvas.open("settings");
  } catch {
    showMessage("Не удалось открыть настройки codex-lb в CanvasTTY.");
  }
});
refreshButton.addEventListener("click", () => { void refresh(); });
setInterval(() => { void refresh(); }, 60_000);

host.onStorageChange((key, value) => {
  if (key === config.storageKey) void applyConfiguration(value);
});
void applyConfiguration();
