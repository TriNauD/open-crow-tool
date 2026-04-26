chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'explain-selection') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  chrome.tabs.sendMessage(tab.id, { type: 'CROW_EXPLAIN' });
});
