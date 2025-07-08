const { DEFAULT_SETTINGS } = require('../src/popup.js');

describe('Default Settings', () => {
  test('should have a systemPrompt', () => {
    expect(DEFAULT_SETTINGS.systemPrompt).toBeDefined();
    expect(typeof DEFAULT_SETTINGS.systemPrompt).toBe('string');
  });
});

// Example: test popup logic (mock DOM as needed)
test('System prompt textarea should be prepopulated', () => {
  document.body.innerHTML = `
    <textarea id="systemPrompt"></textarea>
  `;
  const populateForm = require('../src/popup.js').populateForm;
  populateForm({ systemPrompt: 'test prompt' });
  expect(document.getElementById('systemPrompt').value).toBe('test prompt');
});
