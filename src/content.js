// State management
let currentSettings = null;
let processedPosts = new Set();
let feedObserver = null;

// CSS classes for our buttons
const BUTTON_CLASS = 'lps-action-button';
const SUMMARIZED_CLASS = 'lps-summarized';
const ORIGINAL_CLASS = 'lps-original';

// Initialize the extension
async function init() {
  currentSettings = await loadSettings();
  
  // Run on both individual post pages and feed pages
  if (isLinkedInPage()) {
    setupFeedProcessor();
  }
  
  // Listen for settings updates
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SETTINGS_UPDATED') {
      currentSettings = message.settings;
      // Re-process posts with new settings
      if (isLinkedInPage()) {
        setupFeedProcessor();
      }
    }
  });
}

function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get({
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      apiKey: '',
      ollamaUrl: 'http://localhost:11434',
      autoSummarize: false,
      maxTokens: 300,
      temperature: 0.3,
      theme: 'light',
      systemPrompt: 'You are a summariser model, your task is to summarise posts from the LinkedIn platform, you will be provided posts in the format <post> text </post> and should respond in the format <response> summaried version of original post text </response> Respond only in the format described, do not provide any additional response or commentary. Ensure any mentions of company or people names are retained in the summary.'
    }, (result) => {
      resolve(result);
    });
  });
}

function isLinkedInPage() {
  const url = window.location.href;
  return url.includes('linkedin.com') && (
    url.includes('/posts/') ||
    url.includes('/feed/update/') ||
    url.includes('/feed/') ||
    url.includes('/in/') ||
    url.includes('linkedin.com/feed')
  );
}

function isIndividualPostPage() {
  const url = window.location.href;
  return url.includes('/posts/') || url.includes('/feed/update/');
}

function setupFeedProcessor() {
  // Stop any existing observer
  if (feedObserver) {
    feedObserver.disconnect();
  }
  
  // Process existing posts
  processAllPosts();
  
  // Set up observer for new posts (as user scrolls)
  setupFeedObserver();
}

function processAllPosts() {
  const postElements = findAllPostElements();
  console.log(`Found ${postElements.length} posts to process`);
  
  postElements.forEach(postElement => {
    const postId = getPostId(postElement);
    if (!processedPosts.has(postId)) {
      processedPosts.add(postId);
      addActionButton(postElement);
      
      // Auto-summarize if enabled
      if (currentSettings?.autoSummarize) {
        setTimeout(() => summarizePost(postElement), 500);
      }
    }
  });
}

function setupFeedObserver() {
  const feedContainer = document.querySelector('main') || document.body;
  
  feedObserver = new MutationObserver((mutations) => {
    let newPostsFound = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the added node is a post or contains posts
            const posts = node.matches && node.matches(getPostSelectors().join(','))
              ? [node]
              : node.querySelectorAll ? node.querySelectorAll(getPostSelectors().join(','))
              : [];
            
            if (posts.length > 0) {
              newPostsFound = true;
            }
          }
        });
      }
    });
    
    if (newPostsFound) {
      // Debounce processing to avoid excessive calls
      setTimeout(processAllPosts, 300);
    }
  });
  
  feedObserver.observe(feedContainer, {
    childList: true,
    subtree: true
  });
}

function getPostSelectors() {
  // LinkedIn post selectors for finding individual posts in the feed
  return [
    '[data-urn*="activity:"]',
    '.feed-shared-update-v2',
    '.occludable-update',
    'div[data-id*="urn:li:activity:"]'
  ];
}

function findAllPostElements() {
  const selectors = getPostSelectors();
  const posts = [];
  
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
      // Make sure we don't add duplicates and that the post has content
      if (!posts.includes(element) && hasPostContent(element)) {
        posts.push(element);
      }
    });
  });
  
  return posts;
}

function findPostElement() {
  // For individual post pages, find the main post
  const selectors = getPostSelectors();
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && hasPostContent(element)) {
      return element;
    }
  }
  
  return null;
}

function hasPostContent(postElement) {
  // Check if the post element actually contains text content worth summarizing
  const textContainer = findPostTextContainer(postElement);
  if (!textContainer) return false;
  
  const text = extractPostText(textContainer);
  return text.trim().length > 50; // Only process posts with substantial content
}

function getPostId(postElement) {
  // Try to get a unique identifier for the post
  
  // First try: data-urn attribute on the element itself
  if (postElement.hasAttribute('data-urn')) {
    return postElement.getAttribute('data-urn');
  }
  
  // Second try: data-urn attribute on child elements
  const urnElement = postElement.querySelector('[data-urn]');
  if (urnElement) {
    return urnElement.getAttribute('data-urn');
  }
  
  // Third try: data-id attribute
  if (postElement.hasAttribute('data-id')) {
    return postElement.getAttribute('data-id');
  }
  
  const dataIdElement = postElement.querySelector('[data-id*="urn:li:activity:"]');
  if (dataIdElement) {
    return dataIdElement.getAttribute('data-id');
  }
  
  // Fourth try: look for activity links
  const activityLink = postElement.querySelector('a[href*="/posts/"], a[href*="/feed/update/"]');
  if (activityLink) {
    return activityLink.href;
  }
  
  // Fallback: generate ID based on content hash and position
  const textContent = extractPostText(findPostTextContainer(postElement));
  const contentHash = btoa(textContent.substring(0, 100)).replace(/[^a-zA-Z0-9]/g, '');
  const position = Array.from(document.querySelectorAll(getPostSelectors().join(','))).indexOf(postElement);
  
  return `post-${contentHash}-${position}`;
}

function addActionButton(postElement) {
  // Find the post text container
  const textContainer = findPostTextContainer(postElement);
  if (!textContainer) {
    console.log('No text container found for post');
    return;
  }
  
  // Check if button already exists
  if (textContainer.querySelector(`.${BUTTON_CLASS}`) || postElement.querySelector(`.${BUTTON_CLASS}`)) {
    return;
  }
  
  // Ensure we have enough content to summarize
  const postText = extractPostText(textContainer);
  if (postText.trim().length < 100) {
    console.log('Post too short to summarize:', postText.length, 'characters');
    return;
  }
  
  // Create action button
  const button = document.createElement('button');
  button.className = BUTTON_CLASS;
  button.textContent = 'Summarize';
  
  // Check if we're on the feed or individual post page for styling
  const isInFeed = !isIndividualPostPage();
  
  button.style.cssText = `
    margin: 8px 0 4px 0;
    padding: ${isInFeed ? '4px 8px' : '8px 16px'};
    background-color: #0077b5;
    color: white;
    border: none;
    border-radius: 16px;
    cursor: pointer;
    font-size: ${isInFeed ? '11px' : '12px'};
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: background-color 0.2s ease;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
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
  // LinkedIn post text selectors (expanded for better feed coverage)
  const selectors = [
    '.feed-shared-update-v2__description',
    '.feed-shared-text',
    '.update-components-text',
    '.feed-shared-update-v2__commentary',
    '.feed-shared-update-v2__description-wrapper',
    '.update-components-text__text-view',
    '.attributed-text-segment-list__content',
    '.break-words',
    '.update-components-article__description',
    '.update-components-article__content'
  ];
  
  for (const selector of selectors) {
    const element = postElement.querySelector(selector);
    if (element && element.textContent.trim().length > 20) {
      return element;
    }
  }
  
  // If no specific text container found, look for the largest text block
  const allTextElements = postElement.querySelectorAll('div, span, p');
  let bestElement = null;
  let maxLength = 0;
  
  allTextElements.forEach(el => {
    const text = el.textContent.trim();
    if (text.length > maxLength && text.length > 50 && !el.querySelector('button')) {
      maxLength = text.length;
      bestElement = el;
    }
  });
  
  return bestElement || postElement;
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
    console.error('Button or text container not found');
    return;
  }
  
  try {
    // Show loading state
    button.textContent = 'Summarizing...';
    button.disabled = true;
    
    // Extract post text
    const postText = extractPostText(textContainer);
    console.log('Extracted post text:', postText.substring(0, 100) + '...');
    
    if (!postText.trim()) {
      throw new Error('No post text found');
    }
    
    // Validate settings
    if (!currentSettings) {
      throw new Error('Settings not loaded');
    }
    
    if (!currentSettings.provider) {
      throw new Error('No provider selected');
    }
    
    if ((currentSettings.provider === 'openai' || currentSettings.provider === 'openrouter') && !currentSettings.apiKey) {
      throw new Error('API key is required for ' + currentSettings.provider);
    }
    
    console.log('Using provider:', currentSettings.provider);
    console.log('Using model:', currentSettings.model);
    
    // Get summary from AI provider
    const provider = createProvider(currentSettings);
    const summary = await provider.summarize(postText);
    
    if (!summary || summary.trim() === '') {
      throw new Error('Empty summary received from AI provider');
    }
    
    console.log('Summary received:', summary.substring(0, 100) + '...');
    
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
    console.error('Error stack:', error.stack);
    console.error('Current settings:', currentSettings);
    
    button.textContent = 'Error - Try Again';
    button.disabled = false;
    
    // Show error message with more details
    let errorMessage = error.message;
    if (error.message.includes('Failed to fetch')) {
      errorMessage = 'Network error: Please check your internet connection and API settings';
    } else if (error.message.includes('401')) {
      errorMessage = 'Authentication error: Please check your API key';
    } else if (error.message.includes('429')) {
      errorMessage = 'Rate limit exceeded: Please try again later';
    }
    
    showErrorMessage(textContainer, errorMessage);
  }
}

function revertToOriginal(textContainer, button) {
  if (textContainer.dataset.originalContent) {
    textContainer.innerHTML = textContainer.dataset.originalContent;
    
    // Remove any duplicate buttons that might have been restored
    const existingButtons = textContainer.querySelectorAll(`.${BUTTON_CLASS}`);
    existingButtons.forEach(btn => btn.remove());
    
    // Re-add the button
    textContainer.appendChild(button);
    
    // Update state
    textContainer.classList.remove(SUMMARIZED_CLASS);
    button.textContent = 'Summarize';
    button.disabled = false;
  }
}

function extractPostText(textContainer) {
  if (!textContainer) return '';
  
  // Create a copy to extract text from
  const clone = textContainer.cloneNode(true);
  
  // Remove any existing buttons, summary elements, and UI elements
  const elementsToRemove = clone.querySelectorAll(`
    .${BUTTON_CLASS},
    .lps-summary,
    .feed-shared-social-action-bar,
    .social-action-bar,
    .feed-shared-social-counts-bar,
    .feed-shared-actor,
    .feed-shared-header,
    button,
    .like-button,
    .comment-button,
    .share-button,
    .social-counts-reactions,
    time,
    [role="button"],
    .visually-hidden
  `);
  
  elementsToRemove.forEach(el => el.remove());
  
  // Get text content, preserving line breaks
  let text = clone.innerText || clone.textContent || '';
  
  // Clean up the text
  text = text
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .replace(/\n\s*\n/g, '\n') // Clean up multiple line breaks
    .trim();
  
  return text;
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
const navigationObserver = new MutationObserver(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    console.log('Navigation detected, new URL:', currentUrl);
    
    // Clear processed posts when navigating
    processedPosts.clear();
    
    // Stop current feed observer
    if (feedObserver) {
      feedObserver.disconnect();
      feedObserver = null;
    }
    
    // Restart processing for the new page
    if (isLinkedInPage()) {
      setTimeout(setupFeedProcessor, 1500); // Increased delay for feed content to load
    }
  }
});

navigationObserver.observe(document.body, { childList: true, subtree: true });

// Also listen for popstate events (back/forward navigation)
window.addEventListener('popstate', () => {
  setTimeout(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      processedPosts.clear();
      if (feedObserver) {
        feedObserver.disconnect();
        feedObserver = null;
      }
      if (isLinkedInPage()) {
        setupFeedProcessor();
      }
    }
  }, 1000);
});
