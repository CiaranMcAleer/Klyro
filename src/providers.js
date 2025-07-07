// AI Provider configurations
class AIProvider {
  constructor(settings) {
    this.settings = settings;
  }
  
  async summarize(postText) {
    throw new Error('Summarize method must be implemented by provider');
  }
}

class OpenAIProvider extends AIProvider {
  async summarize(postText) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.settings.apiKey}`
      },
      body: JSON.stringify({
        model: this.settings.model,
        messages: [
          {
            role: 'system',
            content: `You are a summariser model, your task is to summarise posts from the LinkedIn platform, you will be provided posts in the format <post> text </post> and should respond in the format <response> summaried version of original post text </response> Respond only in the format described, do not provide any additional response or commentary. Ensure any mentions of company or people names are retained in the summary.`
          },
          {
            role: 'user',
            content: `<post>${postText}</post>`
          }
        ],
        max_tokens: 150,
        temperature: 0.3
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return this.extractResponse(data.choices[0].message.content);
  }
  
  extractResponse(text) {
    const match = text.match(/<response>(.*?)<\/response>/s);
    return match ? match[1].trim() : text.trim();
  }
}

class OpenRouterProvider extends AIProvider {
  async summarize(postText) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.settings.apiKey}`,
        'HTTP-Referer': window.location.href,
        'X-Title': 'LinkedIn Post Summarizer'
      },
      body: JSON.stringify({
        model: this.settings.model,
        messages: [
          {
            role: 'system',
            content: `You are a summariser model, your task is to summarise posts from the LinkedIn platform, you will be provided posts in the format <post> text </post> and should respond in the format <response> summaried version of original post text </response> Respond only in the format described, do not provide any additional response or commentary. Ensure any mentions of company or people names are retained in the summary.`
          },
          {
            role: 'user',
            content: `<post>${postText}</post>`
          }
        ],
        max_tokens: 150,
        temperature: 0.3
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return this.extractResponse(data.choices[0].message.content);
  }
  
  extractResponse(text) {
    const match = text.match(/<response>(.*?)<\/response>/s);
    return match ? match[1].trim() : text.trim();
  }
}

class OllamaProvider extends AIProvider {
  async summarize(postText) {
    const response = await fetch(`${this.settings.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.settings.model,
        prompt: `You are a summariser model, your task is to summarise posts from the LinkedIn platform, you will be provided posts in the format <post> text </post> and should respond in the format <response> summaried version of original post text </response> Respond only in the format described, do not provide any additional response or commentary. Ensure any mentions of company or people names are retained in the summary.\n\n<post>${postText}</post>`,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 150
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return this.extractResponse(data.response);
  }
  
  extractResponse(text) {
    const match = text.match(/<response>(.*?)<\/response>/s);
    return match ? match[1].trim() : text.trim();
  }
}

// Factory function to create appropriate provider
function createProvider(settings) {
  switch (settings.provider) {
    case 'openai':
      return new OpenAIProvider(settings);
    case 'openrouter':
      return new OpenRouterProvider(settings);
    case 'ollama':
      return new OllamaProvider(settings);
    default:
      throw new Error(`Unknown provider: ${settings.provider}`);
  }
}
