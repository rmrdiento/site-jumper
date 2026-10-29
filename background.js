const api = globalThis.browser ?? chrome;

// Клик по иконке расширения: просим страницу выполнить переход (подтверждение и логика — в content.js).
api.action.onClicked.addListener((tab) => {
  api.tabs.sendMessage(tab.id, { type: "jump" }).catch(() => {
    // Вкладка не из поддерживаемых сайтов — переносить нечего.
  });
});
