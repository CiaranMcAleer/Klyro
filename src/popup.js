// Default settings
const DEFAULT_SETTINGS = {
  provider: 'openai',
  model: 'gpt-3.5-turbo',
  apiKey: '',
  ollamaUrl: 'http://localhost:11434',
  autoSummarize: false,
  maxTokens: 300,
  temperature: 0.3,
  theme: 'light'
};

// Global variables for OpenRouter models
let allModels = [];
let filteredModels = [];
let selectedModel = null;

// Load settings when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const settings = await loadSettings();
    populateForm(settings);
    
    // Set up event listeners
    const saveButton = document.getElementById('saveSettings');
    const providerSelect = document.getElementById('provider');
    const testButton = document.getElementById('testConnection');
    
    if (saveButton) {
      saveButton.addEventListener('click', saveSettings);
    }
    
    if (providerSelect) {
      providerSelect.addEventListener('change', updateModelPlaceholder);
    }
    
    if (testButton) {
      testButton.addEventListener('click', testConnection);
    }
    
    // Set up theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Set up searchable dropdown for OpenRouter
    setupSearchableDropdown();
    
    // Set up token slider
    setupTokenSlider();
    
    // Apply saved theme
    applyTheme(settings.theme || 'light');
    
    updateModelPlaceholder();
  } catch (error) {
    console.error('Error initializing popup:', error);
    showStatus('Error loading extension', 'error');
  }
});

async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error loading settings:', chrome.runtime.lastError);
        resolve(DEFAULT_SETTINGS);
      } else {
        resolve(result);
      }
    });
  });
}

function populateForm(settings) {
  // If Ollama was previously selected, default to OpenAI since Ollama is disabled
  const provider = settings.provider === 'ollama' ? 'openai' : settings.provider;
  
  document.getElementById('provider').value = provider;
  document.getElementById('model').value = settings.model;
  document.getElementById('apiKey').value = settings.apiKey;
  document.getElementById('ollamaUrl').value = settings.ollamaUrl;
  document.getElementById('autoSummarize').checked = settings.autoSummarize;
  document.getElementById('maxTokens').value = settings.maxTokens;
  document.getElementById('temperature').value = settings.temperature;
  
  // Set the search input for OpenRouter models
  if (provider === 'openrouter' && settings.model) {
    document.getElementById('modelSearch').value = settings.model;
  }
  
  // If we changed from Ollama to OpenAI, show a notice
  if (settings.provider === 'ollama') {
    showStatus('Ollama support is coming soon. Switched to OpenAI.', 'info');
  }
}

async function updateModelPlaceholder() {
  const provider = document.getElementById('provider').value;
  const modelInput = document.getElementById('model');
  const apiKeyInput = document.getElementById('apiKey');
  const ollamaUrlInput = document.getElementById('ollamaUrl');
  const modelDropdown = document.getElementById('modelDropdown');
  
  // Clear selected model when switching providers
  selectedModel = null;
  
  switch (provider) {
    case 'openai':
      modelInput.placeholder = 'e.g., gpt-3.5-turbo, gpt-4';
      modelInput.style.display = 'block';
      modelDropdown.style.display = 'none';
      apiKeyInput.style.display = 'block';
      ollamaUrlInput.style.display = 'none';
      break;
    case 'openrouter':
      modelInput.style.display = 'none';
      modelDropdown.style.display = 'block';
      apiKeyInput.style.display = 'block';
      ollamaUrlInput.style.display = 'none';
      
      // Load OpenRouter models if not already loaded
      if (allModels.length === 0) {
        await loadOpenRouterModels();
      }
      break;
    default:
      // Fallback to OpenAI for any unhandled cases (like Ollama)
      modelInput.placeholder = 'e.g., gpt-3.5-turbo, gpt-4';
      modelInput.style.display = 'block';
      modelDropdown.style.display = 'none';
      apiKeyInput.style.display = 'block';
      ollamaUrlInput.style.display = 'none';
      break;
  }
  
  // Update token slider for the new provider
  updateTokenSlider();
}

async function saveSettings() {
  const provider = document.getElementById('provider').value;
  let model;
  
  if (provider === 'openrouter') {
    model = document.getElementById('modelSearch').value;
  } else {
    model = document.getElementById('model').value;
  }
  
  const settings = {
    provider: provider,
    model: model,
    apiKey: document.getElementById('apiKey').value,
    ollamaUrl: document.getElementById('ollamaUrl').value,
    autoSummarize: document.getElementById('autoSummarize').checked,
    maxTokens: parseInt(document.getElementById('maxTokens').value) || DEFAULT_SETTINGS.maxTokens,
    temperature: parseFloat(document.getElementById('temperature').value) || DEFAULT_SETTINGS.temperature,
    theme: getCurrentTheme()
  };
  
  // Validate settings
  if (!settings.model) {
    showStatus('Please enter a model name', 'error');
    return;
  }
  
  if (settings.provider === 'ollama') {
    showStatus('Ollama support is coming soon. Please select OpenAI or OpenRouter.', 'error');
    return;
  }
  
  if ((settings.provider === 'openai' || settings.provider === 'openrouter') && !settings.apiKey) {
    showStatus('Please enter an API key', 'error');
    return;
  }
  
  // Validate maxTokens and temperature
  if (settings.maxTokens < 50 || settings.maxTokens > 2000) {
    showStatus('Max tokens must be between 50 and 2000', 'error');
    return;
  }
  
  if (settings.temperature < 0 || settings.temperature > 1) {
    showStatus('Temperature must be between 0 and 1', 'error');
    return;
  }
  
  // Additional validation for OpenRouter
  if (settings.provider === 'openrouter') {
    if (!settings.model.includes('/')) {
      showStatus('OpenRouter models should be in format "provider/model" (e.g., "openai/gpt-3.5-turbo" or "openrouter/cypher-alpha:free")', 'error');
      return;
    }
    
    if (!settings.apiKey.startsWith('sk-or-')) {
      showStatus('Warning: OpenRouter API keys typically start with "sk-or-"', 'warning');
    }
  }
  
  chrome.storage.sync.set(settings, () => {
    if (chrome.runtime.lastError) {
      console.error('Error saving settings:', chrome.runtime.lastError);
      showStatus('Error saving settings', 'error');
      return;
    }
    
    showStatus('Settings saved successfully!', 'success');
    
    // Notify content script about settings change (with error handling)
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Error querying tabs:', chrome.runtime.lastError);
        return;
      }
      
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('linkedin.com')) {
        chrome.tabs.sendMessage(tabs[0].id, {type: 'SETTINGS_UPDATED', settings}, (response) => {
          if (chrome.runtime.lastError) {
            // Content script not available (page not loaded or not LinkedIn), ignore silently
            console.log('Content script not available:', chrome.runtime.lastError.message);
          }
        });
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

async function testConnection() {
  const provider = document.getElementById('provider').value;
  let model;
  
  if (provider === 'openrouter') {
    model = document.getElementById('modelSearch').value;
  } else {
    model = document.getElementById('model').value;
  }
  
  const settings = {
    provider: provider,
    model: model,
    apiKey: document.getElementById('apiKey').value,
    ollamaUrl: document.getElementById('ollamaUrl').value,
    maxTokens: parseInt(document.getElementById('maxTokens').value) || DEFAULT_SETTINGS.maxTokens,
    temperature: parseFloat(document.getElementById('temperature').value) || DEFAULT_SETTINGS.temperature
  };

  showStatus('Testing connection...', 'info');

  try {
    // Create a provider instance to test
    const provider = createProvider(settings);
    
    // Test with a simple message
    const testResult = await provider.summarize('This is a test post to verify the API connection is working correctly.');
    
    showStatus('Connection successful! ✓', 'success');
    console.log('Test result:', testResult);
  } catch (error) {
    showStatus(`Connection failed: ${error.message}`, 'error');
    console.error('Connection test failed:', error);
  }
}

// OpenRouter models functions
async function loadOpenRouterModels() {
  try {
    showModelDropdownLoading();
    
    const response = await fetch('https://openrouter.ai/api/v1/models');
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    
    const data = await response.json();
    allModels = data.data || [];
    filteredModels = [...allModels];
    
    console.log(`Loaded ${allModels.length} OpenRouter models`);
    renderModelDropdown();
  } catch (error) {
    console.error('Failed to load OpenRouter models:', error);
    showModelDropdownError(error.message);
  }
}

function setupSearchableDropdown() {
  const searchInput = document.getElementById('modelSearch');
  const dropdownOptions = document.getElementById('dropdownOptions');
  
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    filterModels(searchTerm);
    renderModelDropdown();
    showDropdown();
  });
  
  searchInput.addEventListener('focus', () => {
    if (filteredModels.length > 0) {
      showDropdown();
    }
  });
  
  // Hide dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.searchable-dropdown')) {
      hideDropdown();
    }
  });
}

function filterModels(searchTerm) {
  if (!searchTerm) {
    filteredModels = [...allModels];
    // Sort by free models first, then by context length
    sortFilteredModels();
    return;
  }
  
  const term = searchTerm.toLowerCase();
  
  filteredModels = allModels.filter(model => {
    // Basic text search
    const modelId = (model.id || '').toLowerCase();
    const modelName = (model.name || '').toLowerCase();
    const description = (model.description || '').toLowerCase();
    
    // Check for special filter keywords
    if (term.includes('free')) {
      const promptPrice = parseFloat(model.pricing?.prompt || 0);
      const completionPrice = parseFloat(model.pricing?.completion || 0);
      const isFree = promptPrice === 0 && completionPrice === 0;
      if (!isFree) return false;
    }
    
    if (term.includes('vision') || term.includes('image') || term.includes('multimodal')) {
      const modality = model.architecture?.modality || 'text->text';
      const isMultimodal = modality.includes('image') || modality.includes('vision');
      if (!isMultimodal) return false;
    }
    
    if (term.includes('claude')) {
      if (!modelId.includes('claude') && !modelName.includes('claude')) return false;
    }
    
    if (term.includes('gpt')) {
      if (!modelId.includes('gpt') && !modelName.includes('gpt')) return false;
    }
    
    if (term.includes('llama')) {
      if (!modelId.includes('llama') && !modelName.includes('llama')) return false;
    }
    
    if (term.includes('gemini')) {
      if (!modelId.includes('gemini') && !modelName.includes('gemini')) return false;
    }
    
    // Default text search - remove filter keywords for general search
    const searchText = term.replace(/\b(free|vision|image|multimodal|claude|gpt|llama|gemini)\b/g, '').trim();
    if (searchText) {
      return modelId.includes(searchText) ||
             modelName.includes(searchText) ||
             description.includes(searchText);
    }
    
    return true;
  });
  
  sortFilteredModels();
}

function sortFilteredModels() {
  // Sort models: free first, then by context length descending
  filteredModels.sort((a, b) => {
    const aFree = parseFloat(a.pricing?.prompt || 0) === 0 && parseFloat(a.pricing?.completion || 0) === 0;
    const bFree = parseFloat(b.pricing?.prompt || 0) === 0 && parseFloat(b.pricing?.completion || 0) === 0;
    
    if (aFree && !bFree) return -1;
    if (!aFree && bFree) return 1;
    
    // Then by context length (higher first)
    const aContext = a.context_length || 0;
    const bContext = b.context_length || 0;
    return bContext - aContext;
  });
}

function renderModelDropdown() {
  const dropdownOptions = document.getElementById('dropdownOptions');
  
  if (filteredModels.length === 0) {
    dropdownOptions.innerHTML = '<div class="loading">No models found</div>';
    return;
  }
  
  dropdownOptions.innerHTML = filteredModels.slice(0, 50).map(model => {
    const contextLength = model.context_length ? `${model.context_length.toLocaleString()}` : 'Unknown';
    const promptPrice = parseFloat(model.pricing?.prompt || 0);
    const completionPrice = parseFloat(model.pricing?.completion || 0);
    const isFree = promptPrice === 0 && completionPrice === 0;
    
    let pricingText;
    if (isFree) {
      pricingText = 'FREE';
    } else {
      const promptCost = (promptPrice * 1000000).toFixed(2);
      const completionCost = (completionPrice * 1000000).toFixed(2);
      pricingText = `$${promptCost}/$${completionCost}/1M`;
    }
    
    // Get modality info
    const modality = model.architecture?.modality || 'text->text';
    const isMultimodal = modality.includes('image') || modality.includes('vision');
    const modalityIcon = isMultimodal ? '🖼️' : '💬';
    
    // Format context length
    const contextText = contextLength === 'Unknown' ? 'Unknown context' : `${contextLength} tokens`;
    
    return `
      <div class="dropdown-option" data-model-id="${model.id}">
        <div class="model-header">
          <span class="model-name">${model.name || model.id}</span>
          <span class="model-modality">${modalityIcon}</span>
        </div>
        <div class="model-id">${model.id}</div>
        <div class="model-details">
          <span class="model-context">${contextText}</span>
          <span class="model-pricing ${isFree ? 'free' : ''}">${pricingText}</span>
        </div>
      </div>
    `;
  }).join('');
  
  // Add click handlers
  dropdownOptions.querySelectorAll('.dropdown-option').forEach(option => {
    option.addEventListener('click', () => {
      const modelId = option.dataset.modelId;
      selectModel(modelId);
    });
  });
}

function selectModel(modelId) {
  document.getElementById('modelSearch').value = modelId;
  
  // Find and store the selected model data
  selectedModel = allModels.find(model => model.id === modelId);
  updateTokenSlider();
  
  hideDropdown();
}

function showDropdown() {
  document.getElementById('dropdownOptions').style.display = 'block';
}

function hideDropdown() {
  document.getElementById('dropdownOptions').style.display = 'none';
}

function showModelDropdownLoading() {
  const dropdownOptions = document.getElementById('dropdownOptions');
  dropdownOptions.innerHTML = '<div class="loading">Loading models...</div>';
  dropdownOptions.style.display = 'block';
}

function showModelDropdownError(message) {
  const dropdownOptions = document.getElementById('dropdownOptions');
  dropdownOptions.innerHTML = `<div class="loading">Error: ${message}</div>`;
}

// Token slider functions
function setupTokenSlider() {
  const tokenSlider = document.getElementById('maxTokens');
  const tokenValue = document.getElementById('maxTokensValue');
  
  tokenSlider.addEventListener('input', (e) => {
    const value = e.target.value;
    tokenValue.textContent = value;
    updateTokenHelp(parseInt(value));
  });
  
  // Initialize the display
  tokenValue.textContent = tokenSlider.value;
  updateTokenHelp(parseInt(tokenSlider.value));
}

function updateTokenSlider() {
  const tokenSlider = document.getElementById('maxTokens');
  const provider = document.getElementById('provider').value;
  
  if (provider === 'openrouter' && selectedModel) {
    // Use model-specific limits
    const maxCompletion = selectedModel.top_provider?.max_completion_tokens || selectedModel.context_length || 2000;
    const contextLength = selectedModel.context_length || 2000;
    
    // Set reasonable max (either max_completion_tokens or 1/4 of context length, whichever is smaller)
    const maxTokens = Math.min(maxCompletion, Math.floor(contextLength / 4), 4000);
    
    tokenSlider.max = maxTokens;
    
    // Adjust current value if it exceeds the new max
    if (parseInt(tokenSlider.value) > maxTokens) {
      tokenSlider.value = Math.min(maxTokens, 1000);
      document.getElementById('maxTokensValue').textContent = tokenSlider.value;
    }
    
    updateTokenHelp(parseInt(tokenSlider.value));
  } else {
    // Default limits for other providers
    tokenSlider.max = 2000;
    updateTokenHelp(parseInt(tokenSlider.value));
  }
}

function updateTokenHelp(tokenCount) {
  const tokenHelp = document.getElementById('tokenHelp');
  const provider = document.getElementById('provider').value;
  
  let helpText = 'Higher values allow longer responses but cost more';
  
  if (provider === 'openrouter' && selectedModel) {
    const maxCompletion = selectedModel.top_provider?.max_completion_tokens;
    const contextLength = selectedModel.context_length;
    const pricing = selectedModel.pricing;
    
    if (maxCompletion) {
      helpText = `Max completion: ${maxCompletion.toLocaleString()} tokens`;
    } else if (contextLength) {
      helpText = `Context window: ${contextLength.toLocaleString()} tokens`;
    }
    
    // Add pricing info for paid models
    if (pricing && parseFloat(pricing.completion) > 0) {
      const cost = (parseFloat(pricing.completion) * tokenCount).toFixed(6);
      helpText += ` • ~$${cost} for ${tokenCount} tokens`;
    }
  }
  
  tokenHelp.textContent = helpText;
}

// Theme functions
function toggleTheme() {
  const currentTheme = getCurrentTheme();
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme(newTheme);
  
  // Save theme preference
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    settings.theme = newTheme;
    chrome.storage.sync.set(settings);
  });
}

function getCurrentTheme() {
  return document.body.getAttribute('data-theme') || 'light';
}

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  
  const themeIcon = document.querySelector('.theme-icon');
  if (themeIcon) {
    themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
  }
  
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.title = `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`;
  }
}
