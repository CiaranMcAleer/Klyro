# Klyro - AI-Powered LinkedIn Post Summarizer

<div align="center">
  <img src="linkedin_summarizer_logo.svg" alt="Klyro Logo" width="200">
</div>

This Chrome extension allows you to summarize LinkedIn posts using various AI providers including OpenAI, OpenRouter, Transformers.js (local), and Ollama (Coming Soon).

## Installation

1. Clone this repository
2. Install dependencies: `npm install` or `bun install`
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" in the top right
5. Click "Load unpacked" and select the `src` folder
6. The extension should now appear in your extensions list

## Setup

1. Click on the extension icon in the Chrome toolbar
2. Configure your preferred AI provider:
   - **OpenAI**: Enter your OpenAI API key and model (e.g., gpt-3.5-turbo, gpt-4)
   - **OpenRouter**: Enter your OpenRouter API key and select a model from the searchable dropdown
   - **Transformers.js (Local)**: No API key needed! Select a model (e.g., Xenova/distilbart-cnn-6-6) for local inference
   - **Ollama**: Coming soon - Set your Ollama server URL and model name
3. Choose whether to auto-summarize posts or manually trigger summarization
4. Customize the system prompt if needed
5. Save settings

## Usage

1. Navigate to a LinkedIn post (either an individual post page, or on the feed)
2. If auto-summarize is enabled, the post will be automatically summarized
3. If manual mode, click the "Summarize" button that appears below the post
4. Click "Show Original" to revert back to the original post content

## Features

- **Multiple AI Providers**: Support for OpenAI, OpenRouter, and Transformers.js (local)
- **Tool Calling Support**: Modern tool calling API for OpenAI and OpenRouter providers (better accuracy and performance)
- **Local Inference**: Run models directly in your browser with Transformers.js - no API key or internet required!
- **Easy Configuration**: Simple popup interface with searchable model selection
- **Manual/Auto Mode**: Choose between automatic summarization or manual triggering
- **Reversible**: Easy toggle between summary and original content
- **Privacy Focused**: With manual mode you control what posts get sent to model providers. With Transformers.js, everything stays local!
- **Extensible**: Easy to add new AI providers

## Providers

### OpenAI
- Supports GPT-3.5 and GPT-4 models
- Uses tool calling for improved accuracy
- Requires OpenAI API key

### OpenRouter
- Access to 100+ models from various providers
- Searchable dropdown with pricing and context length info
- Supports tool calling for compatible models
- Requires OpenRouter API key (get one at [openrouter.ai](https://openrouter.ai))

### Transformers.js (Local)
- Run models locally in your browser - **no API key needed**
- Models are cached in browser storage
- Recommended models:
  - `Xenova/distilbart-cnn-6-6` - Fast and lightweight (default)
  - `Xenova/bart-large-cnn` - Better quality, slower
- First run downloads the model (may take a minute)
- Subsequent runs use cached model (instant)

### Ollama (Coming Soon)
- Self-hosted local models
- Full control over your data
- Support for custom models

## Tool Calling vs XML Tags

This extension now uses **tool calling** for supported models (OpenAI GPT-3.5/4, OpenRouter compatible models), which provides:
- Better structured outputs
- More reliable parsing
- Improved accuracy
- Lower latency

For models that don't support tool calling (like reasoning models), the extension falls back to XML tag-based prompts.

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
- `icons/` – Extension icons

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run specific test
npm test -- __tests__/providers.test.js
```

## Security
- The extension makes calls directly to the respective provider's API using your key (BYOK)
- API keys are stored in `chrome.storage.local` which means malicious extensions in your browser could gain access
- There is no input sanitization to prevent prompt injection from post contents
- Transformers.js runs entirely locally - no data leaves your browser

## License
MIT
