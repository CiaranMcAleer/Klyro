// Load providers
const script = document.createElement('script');
script.src = chrome.runtime.getURL('providers.js');
document.documentElement.appendChild(script);

// State management
let currentSettings = null;
let processedPosts = new Set();

// CSS classes for our buttons
const BUTTON_CLASS = 'lps-action-button';
const SUMMARIZED_CLASS = 'lps-summarized';
const ORIGINAL_CLASS = 'lps-original';

// Initialize the extension
async function init() {
  currentSettings = await loadSettings();
  
  // Only run on individual post pages
  if (isPostPage()) {
    setupPostProcessor();
  }
  
  // Listen for settings updates
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SETTINGS_UPDATED') {
      currentSettings = message.settings;
      // Re-process posts with new settings
      if (isPostPage()) {
        setupPostProcessor();
      }
    }
  });
}

function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      apiKey: '',
      ollamaUrl: 'http://localhost:11434',
      autoSummarize: false
    }, (result) => {
      resolve(result);
    });
  });
}

function isPostPage() {
  const url = window.location.href;
  return url.includes('/posts/') || url.includes('/feed/update/');
}

function setupPostProcessor() {
  // Find the main post content
  const postElement = findPostElement();
  if (!postElement) {
    // Try again after a short delay (LinkedIn loads content dynamically)
    setTimeout(setupPostProcessor, 1000);
    return;
  }
  
  const postId = getPostId(postElement);
  if (processedPosts.has(postId)) {
    return; // Already processed
  }
  
  processedPosts.add(postId);
  addActionButton(postElement);
  
  // Auto-summarize if enabled
  if (currentSettings.autoSummarize) {
    setTimeout(() => summarizePost(postElement), 500);
  }
}

function findPostElement() {
  // LinkedIn post selectors (may need adjustment based on LinkedIn's current structure)
  const selectors = [
    '[data-urn*="activity:"]',
    '.feed-shared-update-v2',
    '.occludable-update',
    '.feed-shared-update-v2__description-wrapper'
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
  }
  
  return null;
}

function getPostId(postElement) {
  // Try to get a unique identifier for the post
  const urnElement = postElement.querySelector('[data-urn]');
  if (urnElement) {
    return urnElement.getAttribute('data-urn');
  }
  
  // Fallback to URL-based ID
  return window.location.pathname;
}

function addActionButton(postElement) {
  // Find the post text container
  const textContainer = findPostTextContainer(postElement);
  if (!textContainer) {
    return;
  }
  
  // Check if button already exists
  if (textContainer.querySelector(`.${BUTTON_CLASS}`)) {
    return;
  }
  
  // Create action button
  const button = document.createElement('button');
  button.className = BUTTON_CLASS;
  button.textContent = 'Summarize';
  button.style.cssText = `
    margin: 10px 0;
    padding: 8px 16px;
    background-color: #0077b5;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-weight: bold;
  `;
  
  button.addEventListener('click', () => toggleSummary(postElement));
  button.addEventListener('mouseover', () => {
    button.style.backgroundColor = '#005582';
  });
  button.addEventListener('mouseout', () => {
    button.style.backgroundColor = '#0077b5';
  });
  
  // Insert button after the post text
  textContainer.appendChild(button);
}

function findPostTextContainer(postElement) {
  // LinkedIn post text selectors
  const selectors = [
    '.feed-shared-update-v2__description',
    '.feed-shared-text',
    '.update-components-text',
    '.feed-shared-update-v2__commentary'
  ];
  
  for (const selector of selectors) {
    const element = postElement.querySelector(selector);
    if (element) {
      return element;
    }
  }
  
  return postElement;
}

async function toggleSummary(postElement) {
  const button = postElement.querySelector(`.${BUTTON_CLASS}`);
  const textContainer = findPostTextContainer(postElement);
  
  if (textContainer.classList.contains(SUMMARIZED_CLASS)) {
    // Revert to original
    revertToOriginal(textContainer, button);
  } else {
    // Summarize
    await summarizePost(postElement);
  }
}

async function summarizePost(postElement) {
  const button = postElement.querySelector(`.${BUTTON_CLASS}`);
  const textContainer = findPostTextContainer(postElement);
  
  if (!button || !textContainer) {
    return;
  }
  
  try {
    // Show loading state
    button.textContent = 'Summarizing...';
    button.disabled = true;
    
    // Extract post text
    const postText = extractPostText(textContainer);
    if (!postText.trim()) {
      throw new Error('No post text found');
    }
    
    // Get summary from AI provider
    const provider = createProvider(currentSettings);
    const summary = await provider.summarize(postText);
    
    // Store original content and replace with summary
    if (!textContainer.dataset.originalContent) {
      textContainer.dataset.originalContent = textContainer.innerHTML;
    }
    
    // Create summary element
    const summaryElement = document.createElement('div');
    summaryElement.className = 'lps-summary';
    summaryElement.innerHTML = `
      <div style="background-color: #f3f6f8; padding: 12px; border-radius: 8px; border-left: 4px solid #0077b5; margin-bottom: 10px;">
        <div style="font-size: 12px; color: #666; margin-bottom: 8px;">📄 AI Summary</div>
        <div>${summary}</div>
      </div>
    `;
    
    // Replace content
    textContainer.innerHTML = '';
    textContainer.appendChild(summaryElement);
    textContainer.appendChild(button);
    
    // Update state
    textContainer.classList.add(SUMMARIZED_CLASS);
    button.textContent = 'Show Original';
    button.disabled = false;
    
  } catch (error) {
    console.error('Error summarizing post:', error);
    button.textContent = 'Error - Try Again';
    button.disabled = false;
    
    // Show error message
    showErrorMessage(textContainer, error.message);
  }
}

function revertToOriginal(textContainer, button) {
  if (textContainer.dataset.originalContent) {
    textContainer.innerHTML = textContainer.dataset.originalContent;
    
    // Re-add the button
    textContainer.appendChild(button);
    
    // Update state
    textContainer.classList.remove(SUMMARIZED_CLASS);
    button.textContent = 'Summarize';
    button.disabled = false;
  }
}

function extractPostText(textContainer) {
  // Create a copy to extract text from
  const clone = textContainer.cloneNode(true);
  
  // Remove any existing buttons or summary elements
  const buttons = clone.querySelectorAll(`.${BUTTON_CLASS}`);
  const summaries = clone.querySelectorAll('.lps-summary');
  
  buttons.forEach(btn => btn.remove());
  summaries.forEach(summary => summary.remove());
  
  // Get text content, preserving line breaks
  return clone.innerText || clone.textContent || '';
}

function showErrorMessage(container, message) {
  const errorElement = document.createElement('div');
  errorElement.style.cssText = `
    background-color: #ffe6e6;
    color: #d32f2f;
    padding: 8px 12px;
    border-radius: 4px;
    margin: 10px 0;
    font-size: 12px;
    border-left: 4px solid #d32f2f;
  `;
  errorElement.textContent = `Error: ${message}`;
  
  container.appendChild(errorElement);
  
  // Remove error message after 5 seconds
  setTimeout(() => {
    if (errorElement.parentNode) {
      errorElement.remove();
    }
  }, 5000);
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Handle navigation changes (LinkedIn is a SPA)
let currentUrl = window.location.href;
new MutationObserver(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    processedPosts.clear();
    if (isPostPage()) {
      setTimeout(setupPostProcessor, 1000); // Delay to allow content to load
    }
  }
}).observe(document.body, { childList: true, subtree: true });
