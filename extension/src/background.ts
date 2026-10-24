// clicking the toolbar icon opens the side panel
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => console.error(error));

// Ollama turns away requests that carry a browser extension's origin. Only this
// extension's own requests to Ollama have that header dropped; web pages are untouched.
chrome.declarativeNetRequest
  .updateDynamicRules({
    removeRuleIds: [1],
    addRules: [
      {
        id: 1,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [{ header: 'origin', operation: 'remove' }],
        },
        condition: {
          urlFilter: '||127.0.0.1:11434/',
          initiatorDomains: [chrome.runtime.id],
          resourceTypes: ['xmlhttprequest'],
        },
      },
    ],
  })
  .catch((error: unknown) => console.error(error));

export {};
