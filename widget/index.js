const host = window.CanvasTTYPlugin;
const endpoint = "http://127.0.0.1:2456/api/fleet/summary";
const secretName = "codex-lb-api-key";
const accounts = document.querySelector("#accounts");
const message = document.querySelector("#message");
const updated = document.querySelector("#updated");
const setup = document.querySelector("#setup");
const keyInput = document.querySelector("#api-key");
const refreshButton = document.querySelector("#refresh");
const configureButton = document.querySelector("#configure");
let apiKey = null;
let loading = false;

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
  if (!apiKey || loading) return;
  loading = true;
  refreshButton.disabled = true;
  if (!accounts.childElementCount) showMessage("Загрузка лимитов…");
  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${apiKey}` },
      credentials: "omit",
      cache: "no-store"
    });
    if (response.status === 401) throw new Error("API-ключ отклонён. Проверьте ключ в настройках виджета.");
    if (!response.ok) throw new Error(`Не удалось получить лимиты: HTTP ${response.status}.`);
    const payload = await response.json();
    if (!Array.isArray(payload.accounts)) throw new Error("Ответ codex-lb имеет неожиданный формат.");
    render(payload.accounts);
  } catch (error) {
    showMessage(error instanceof TypeError
      ? "Не удалось получить ответ от Caddy на 127.0.0.1:2456 (соединение или CORS)."
      : error instanceof Error ? error.message : "Не удалось получить лимиты.");
    if (accounts.childElementCount) updated.textContent = "Показаны последние полученные данные";
  } finally {
    loading = false;
    refreshButton.disabled = false;
  }
}

setup.addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = keyInput.value.trim();
  if (!value) return;
  showMessage("Сохраняю API-ключ…");
  try {
    await host.secrets.set(secretName, value);
    apiKey = value;
    keyInput.value = "";
    setup.hidden = true;
    await refresh();
  } catch (error) {
    showMessage(error instanceof Error
      ? `Ключ не сохранён: ${error.message}`
      : "Ключ не сохранён в защищённом хранилище CanvasTTY.");
  }
});

configureButton.addEventListener("click", () => {
  setup.hidden = !setup.hidden;
  if (!setup.hidden) keyInput.focus();
});
refreshButton.addEventListener("click", () => { void refresh(); });
setInterval(() => { void refresh(); }, 60_000);

void (async () => {
  try {
    apiKey = await host.secrets.get(secretName);
    setup.hidden = Boolean(apiKey);
    if (apiKey) await refresh();
    else showMessage("Введите API-ключ codex-lb, чтобы показать лимиты.");
  } catch {
    showMessage("Защищённое хранилище CanvasTTY недоступно.");
  }
})();
