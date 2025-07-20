# Klyro - AI-Powered LinkedIn Post Summarizer

<div align="center">
  <img src="linkedin_summarizer_logo.svg" alt="Klyro Logo" width="200">
</div>

This Chrome extension allows you to summarize LinkedIn posts using various AI providers including OpenAI, OpenRouter, and Ollama(Coming Soon...).

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `src` folder
4. The extension should now appear in your extensions list

## Setup

1. Click on the extension icon in the Chrome toolbar
2. Configure your preferred AI provider:
   - **OpenAI**: Enter your OpenAI API key and model (e.g., gpt-3.5-turbo)
   - **OpenRouter**: Enter your OpenRouter API key and model (e.g., openai/gpt-3.5-turbo)
   - **Ollama**: Set your Ollama server URL (default: http://localhost:11434) and model name
3. Choose whether to auto-summarize posts or manually trigger summarization
4. Save settings

## Usage

1. Navigate to a LinkedIn post (either an individual post page, or on the feed)
2. If auto-summarize is enabled, the post will be automatically summarized
3. If manual mode, click the "Summarize" button that appears below the post
4. Click "Show Original" to revert back to the original post content

## Features

- **Multiple AI Providers**: Support for OpenA and OpenRouter (Ollama coming soon)
- **Easy Configuration**: Simple popup interface for settings
- **Manual/Auto Mode**: Choose between automatic summarization or manual triggering
- **Reversible**: Easy toggle between summary and original content
- **Privacy Focused**: With manual mode you control what posts get sent to the model providers, only the content of the post gets sent
- **Extensible**: Easy to add new AI providers

## Adding New Providers

To add a new AI provider:

1. Create a new provider class in `providers.js` that extends `AIProvider`
2. Implement the `summarize(postText)` method
3. Add the provider option to the popup HTML
4. Update the `createProvider` factory function

## File Structure

- `manifest.json` – Extension configuration
- `popup.html` / `popup.js` – Settings interface and logic
- `content.js` – Main extension logic that runs on LinkedIn
- `providers.js` – AI provider implementations
- `styles.css` – Extension styling
- `assets/` – Images and icons (e.g., `linkedin_summarizer_logo.svg`)

## Security
- The extension makes calls directly to the respective provider's api key that you provide(BYOK), the key is stored in chrome.storage.local which means malicious extensions in your browser could gain access.
- There is zero input sanitisation/measures taken to prevent prompt injection from the post contents.
