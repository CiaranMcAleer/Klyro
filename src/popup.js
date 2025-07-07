// Default settings
const DEFAULT_SETTINGS = {
  provider: 'openai',
  model: 'gpt-3.5-turbo',
  apiKey: '',
  ollamaUrl: 'http://localhost:11434',
  autoSummarize: false
};

// Load settings when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  const settings = await loadSettings();
  populateForm(settings);
  
  // Set up event listeners
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('provider').addEventListener('change', updateModelPlaceholder);
  
  updateModelPlaceholder();
});

async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
      resolve(result);
    });
  });
}

function populateForm(settings) {
  document.getElementById('provider').value = settings.provider;
  document.getElementById('model').value = settings.model;
  document.getElementById('apiKey').value = settings.apiKey;
  document.getElementById('ollamaUrl').value = settings.ollamaUrl;
  document.getElementById('autoSummarize').checked = settings.autoSummarize;
}

function updateModelPlaceholder() {
  const provider = document.getElementById('provider').value;
  const modelInput = document.getElementById('model');
  const apiKeyInput = document.getElementById('apiKey');
  const ollamaUrlInput = document.getElementById('ollamaUrl');
  
  switch (provider) {
    case 'openai'://TODO replace this with a fetch of openai models
      modelInput.placeholder = 'e.g., gpt-3.5-turbo, gpt-4';
      apiKeyInput.style.display = 'block';
      ollamaUrlInput.style.display = 'none';
      break;
    case 'openrouter'://TODO replace this with a fetch of openrouter.ai/api/v1/models
      modelInput.placeholder = 'e.g., openai/gpt-3.5-turbo';
      apiKeyInput.style.display = 'block';
      ollamaUrlInput.style.display = 'none';
      break;
    case 'ollama': //TODO replace with a dynamic fetch of available models from Ollama
      modelInput.placeholder = 'e.g., llama2, mistral';
      apiKeyInput.style.display = 'none';
      ollamaUrlInput.style.display = 'block';
      break;
  }
}

async function saveSettings() {
  const settings = {
    provider: document.getElementById('provider').value,
    model: document.getElementById('model').value,
    apiKey: document.getElementById('apiKey').value,
    ollamaUrl: document.getElementById('ollamaUrl').value,
    autoSummarize: document.getElementById('autoSummarize').checked
  };
  
  // Validate settings
  if (!settings.model) {
    showStatus('Please enter a model name', 'error');
    return;
  }
  
  if ((settings.provider === 'openai' || settings.provider === 'openrouter') && !settings.apiKey) {
    showStatus('Please enter an API key', 'error');
    return;
  }
  
  if (settings.provider === 'ollama' && !settings.ollamaUrl) {
    showStatus('Please enter Ollama URL', 'error');
    return;
  }
  
  chrome.storage.sync.set(settings, () => {
    showStatus('Settings saved successfully!', 'success');
    
    // Notify content script about settings change
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0] && tabs[0].url.includes('linkedin.com')) {
        chrome.tabs.sendMessage(tabs[0].id, {type: 'SETTINGS_UPDATED', settings});
      }
    });
  });
}

function showStatus(message, type) {
  const statusElement = document.getElementById('status');
  statusElement.textContent = message;
  statusElement.className = `status ${type}`;
  
  setTimeout(() => {
    statusElement.textContent = '';
    statusElement.className = 'status';
  }, 3000);
}
