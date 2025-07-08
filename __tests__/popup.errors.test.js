const { saveSettings, showStatus } = require('../src/popup.js');

describe('Popup error and edge cases', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input id="provider" value="openai">
      <input id="model">
      <input id="apiKey">
      <input id="ollamaUrl">
      <input id="autoSummarize" type="checkbox">
      <input id="maxTokens">
      <input id="temperature">
      <textarea id="systemPrompt"></textarea>
      <div id="status"></div>
    `;
  });

  test('shows error if model is missing', async () => {
    document.getElementById('model').value = '';
    await saveSettings();
    expect(document.getElementById('status').textContent).toMatch(/enter a model/i);
  });

  test('shows error if API key is missing for OpenAI', async () => {
    document.getElementById('model').value = 'gpt-3.5-turbo';
    document.getElementById('apiKey').value = '';
    await saveSettings();
    expect(document.getElementById('status').textContent).toMatch(/enter an API key/i);
  });

  test('shows error if maxTokens is out of range', async () => {
    document.getElementById('model').value = 'gpt-3.5-turbo';
    document.getElementById('apiKey').value = 'sk-test';
    document.getElementById('maxTokens').value = '10';
    await saveSettings();
    expect(document.getElementById('status').textContent).toMatch(/max tokens/i);
  });

  test('shows error if temperature is out of range', async () => {
    document.getElementById('model').value = 'gpt-3.5-turbo';
    document.getElementById('apiKey').value = 'sk-test';
    document.getElementById('maxTokens').value = '300';
    document.getElementById('temperature').value = '2';
    await saveSettings();
    expect(document.getElementById('status').textContent).toMatch(/temperature/i);
  });

  test('shows warning for OpenRouter API key format', async () => {
    document.getElementById('provider').value = 'openrouter';
    document.getElementById('model').value = 'openrouter/gpt-3.5-turbo';
    document.getElementById('apiKey').value = 'not-sk-or';
    document.getElementById('maxTokens').value = '300';
    document.getElementById('temperature').value = '0.3';
    await saveSettings();
    expect(document.getElementById('status').textContent).toMatch(/openrouter api keys/i);
  });
});
