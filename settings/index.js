const host = window.CanvasTTYPlugin;
const config = window.CodexLBConfig;
const form = document.querySelector("#settings-form");
const urlInput = document.querySelector("#base-url");
const keyInput = document.querySelector("#api-key");
const keyHelp = document.querySelector("#key-help");
const saveButton = document.querySelector("#save");
const status = document.querySelector("#status");

host.onContext(({ appearance }) => {
  document.documentElement.dataset.palette = appearance.palette;
});

function showStatus(text, state = "pending") {
  status.textContent = text;
  status.dataset.state = state;
}

function setBusy(busy) {
  urlInput.disabled = busy;
  keyInput.disabled = busy;
  saveButton.disabled = busy;
}

function describeKey(hasKey) {
  keyHelp.textContent = hasKey
    ? "Ключ сохранён в защищённом хранилище CanvasTTY. Оставьте поле пустым, чтобы сохранить прежний ключ."
    : "При первой настройке API-ключ обязателен. Он хранится только в защищённом хранилище CanvasTTY.";
}

saveButton.addEventListener("click", () => {
  void save();
});

form.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.target.tagName !== "INPUT") return;
  event.preventDefault();
  void save();
});

async function save() {
  if (saveButton.disabled) return;
  let baseUrl;
  try {
    baseUrl = config.normalizeBaseUrl(urlInput.value);
  } catch (error) {
    showStatus(error.message, "error");
    urlInput.focus();
    return;
  }
  const newKey = keyInput.value.trim();
  setBusy(true);
  showStatus("Сохраняю настройки…");
  let oldKey;
  let keyWritten = false;
  let failure = "Не удалось прочитать API-ключ из защищённого хранилища CanvasTTY. Настройки не сохранены.";
  try {
    oldKey = await host.secrets.get(config.secretName);
    if (!newKey && !oldKey) {
      showStatus("Введите API-ключ: при первой настройке он обязателен.", "error");
      return;
    }
    if (newKey) {
      failure = "Не удалось сохранить API-ключ в защищённом хранилище CanvasTTY. Настройки не сохранены.";
      await host.secrets.set(config.secretName, newKey);
      keyWritten = true;
    }
    failure = "Не удалось сохранить URL и уведомить виджет через storage CanvasTTY. Повторите сохранение.";
    // A new revision notifies the widget even when only the secret changed.
    await host.storage.set(config.storageKey, {
      baseUrl,
      revision: `${Date.now()}-${Math.random().toString(36).slice(2)}`
    });
    urlInput.value = baseUrl;
    keyInput.value = "";
    describeKey(true);
    showStatus("Настройки сохранены. Открытый виджет применяет URL и ключ.", "success");
  } catch {
    if (keyWritten) {
      try {
        if (oldKey) await host.secrets.set(config.secretName, oldKey);
        else await host.secrets.delete(config.secretName);
      } catch {
        failure += " Не удалось восстановить прежний ключ; повторно сохраните нужный URL и ключ.";
      }
    }
    showStatus(failure, "error");
  } finally {
    setBusy(false);
  }
}

void (async () => {
  let failure = "Не удалось прочитать настройки из storage CanvasTTY. Можно повторно сохранить URL и ключ.";
  try {
    const saved = await host.storage.get(config.storageKey);
    urlInput.value = config.baseUrlFromStorage(saved);
    failure = "Не удалось прочитать API-ключ из защищённого хранилища CanvasTTY. Повторите сохранение.";
    describeKey(Boolean(await host.secrets.get(config.secretName)));
    showStatus("Изменения применяются только после нажатия «Сохранить».");
  } catch {
    showStatus(failure, "error");
  } finally {
    setBusy(false);
  }
})();
