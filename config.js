window.CodexLBConfig = {
  storageKey: "codex-lb-config",
  secretName: "codex-lb-api-key",
  defaultBaseUrl: "http://127.0.0.1:2456",

  normalizeBaseUrl(value) {
    let url;
    try {
      url = new URL(value.trim());
    } catch {
      throw new Error("Введите полный базовый URL, например https://lb.example.com.");
    }
    if (url.username || url.password) {
      throw new Error("URL не должен содержать логин или пароль. Используйте поле API-ключа.");
    }
    if (url.search || url.hash || value.includes("?") || value.includes("#")) {
      throw new Error("Базовый URL не должен содержать query-параметры или фрагмент.");
    }
    if (url.protocol !== "https:" && !(url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname))) {
      throw new Error("Для удалённого сервера нужен HTTPS. HTTP разрешён только для localhost и 127.0.0.1.");
    }
    if (/\/api\/fleet\/summary\/*$/.test(url.pathname)) {
      throw new Error("Введите базовый URL без /api/fleet/summary; этот путь добавляется автоматически.");
    }
    return url.href.replace(/\/+$/, "");
  },

  baseUrlFromStorage(value) {
    if (value == null) return this.defaultBaseUrl;
    if (typeof value.baseUrl !== "string") {
      throw new Error("Сохранённая настройка URL повреждена. Сохраните базовый URL заново.");
    }
    return this.normalizeBaseUrl(value.baseUrl);
  },

  summaryEndpoint(baseUrl) {
    return `${this.normalizeBaseUrl(baseUrl)}/api/fleet/summary`;
  }
};
