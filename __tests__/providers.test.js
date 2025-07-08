const { OpenAIProvider } = require('../src/providers.js');

describe('OpenAIProvider', () => {
  it('should use the systemPrompt from settings', async () => {
    const provider = new OpenAIProvider({
      apiKey: 'sk-test',
      model: 'gpt-3.5-turbo',
      systemPrompt: 'Test prompt',
      maxTokens: 100,
      temperature: 0.3,
    });
    // Mock fetch
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: '<response>summary</response>' } }],
      }),
    }));
    const summary = await provider.summarize('post text');
    expect(summary).toBe('summary');
    expect(global.fetch).toHaveBeenCalled();
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.messages[0].content).toBe('Test prompt');
  });
});
