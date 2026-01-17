const { OpenAIProvider, OpenRouterProvider, TransformersProvider, createProvider } = require('../src/providers.js');

describe('OpenAIProvider', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('should use tool calling when supported', async () => {
    const provider = new OpenAIProvider({
      apiKey: 'sk-test',
      model: 'gpt-3.5-turbo',
      maxTokens: 100,
      temperature: 0.3,
    });
    
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                arguments: JSON.stringify({ summary: 'Tool-based summary' })
              }
            }]
          }
        }]
      })
    });
    
    const summary = await provider.summarize('post text');
    expect(summary).toBe('Tool-based summary');
    
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.tools).toBeDefined();
    expect(body.tools[0].function.name).toBe('summarize_post');
  });

  it('should fall back to XML tags when tool calling is disabled', async () => {
    const provider = new OpenAIProvider({
      apiKey: 'sk-test',
      model: 'gpt-3.5-turbo',
      systemPrompt: 'Test prompt',
      maxTokens: 100,
      temperature: 0.3,
      useToolCalling: false,
    });
    
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '<response>summary</response>' } }]
      })
    });
    
    const summary = await provider.summarize('post text');
    expect(summary).toBe('summary');
    expect(global.fetch).toHaveBeenCalled();
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.messages[0].content).toBe('Test prompt');
    expect(body.tools).toBeUndefined();
  });

  it('should use the systemPrompt from settings with XML tags', async () => {
    const provider = new OpenAIProvider({
      apiKey: 'sk-test',
      model: 'gpt-3.5-turbo',
      systemPrompt: 'Test prompt',
      maxTokens: 100,
      temperature: 0.3,
      useToolCalling: false,
    });
    
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '<response>summary</response>' } }]
      })
    });
    
    const summary = await provider.summarize('post text');
    expect(summary).toBe('summary');
    expect(global.fetch).toHaveBeenCalled();
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.messages[0].content).toBe('Test prompt');
  });
});

describe('OpenRouterProvider', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    global.chrome = {
      runtime: {
        getURL: jest.fn(() => 'chrome-extension://test')
      }
    };
  });

  it('should support tool calling for compatible models', async () => {
    const provider = new OpenRouterProvider({
      apiKey: 'sk-or-test',
      model: 'openai/gpt-4',
      maxTokens: 100,
      temperature: 0.3,
    });
    
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({
        choices: [{
          message: {
            tool_calls: [{
              function: {
                arguments: JSON.stringify({ summary: 'Tool-based summary' })
              }
            }]
          }
        }]
      })
    });
    
    const summary = await provider.summarize('post text');
    expect(summary).toBe('Tool-based summary');
    
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.tools).toBeDefined();
  });

  it('should not use tool calling for reasoning models', async () => {
    const provider = new OpenRouterProvider({
      apiKey: 'sk-or-test',
      model: 'deepseek/deepseek-r1',
      maxTokens: 100,
      temperature: 0.3,
    });
    
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => ({
        choices: [{ message: { content: '<response>summary</response>' } }]
      })
    });
    
    const summary = await provider.summarize('post text');
    expect(summary).toBe('summary');
    
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.tools).toBeUndefined();
  });
});

describe('TransformersProvider', () => {
  it('should be created by the factory', () => {
    const provider = createProvider({
      provider: 'transformers',
      model: 'Xenova/distilbart-cnn-6-6',
    });
    
    expect(provider).toBeInstanceOf(TransformersProvider);
  });
});

describe('createProvider', () => {
  it('should create the correct provider based on settings', () => {
    expect(createProvider({ provider: 'openai' })).toBeInstanceOf(OpenAIProvider);
    expect(createProvider({ provider: 'openrouter' })).toBeInstanceOf(OpenRouterProvider);
    expect(createProvider({ provider: 'transformers' })).toBeInstanceOf(TransformersProvider);
  });

  it('should throw error for unknown provider', () => {
    expect(() => createProvider({ provider: 'unknown' })).toThrow('Unknown provider: unknown');
  });
});
