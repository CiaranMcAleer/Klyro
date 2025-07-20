// AI Provider configurations
class AIProvider {
  constructor(settings) {
    this.settings = settings;
  }
  
  async summarize(postText) {  //TODO Sanitize postText to ensure it doesn't exceed lenth limits of model(shouldn't really be an issue)
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
            content: this.settings.systemPrompt || 'You are a summariser model, your task is to summarise posts from the LinkedIn platform, you will be provided posts in the format <post> text </post> and should respond in the format <response> summaried version of original post text </response> Respond only in the format described, do not provide any additional response or commentary. Ensure any mentions of company or people names are retained in the summary.'
          },
          {
            role: 'user',
            content: `<post>${postText}</post>`
          }
        ],
        max_tokens: this.settings.maxTokens || 150,// Default to 150 tokens if not set
        temperature: this.settings.temperature || 0.3// Default to 0.3 temperature if not set
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
    console.log('OpenRouter: Starting summarization with model:', this.settings.model);
    console.log('OpenRouter: API Key present:', !!this.settings.apiKey);
    
    // Check if this is a reasoning model (like DeepSeek R1)
    const isReasoningModel = this.isReasoningModel(this.settings.model);
    console.log('OpenRouter: Is reasoning model:', isReasoningModel);
    
    try {
      const requestBody = {
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
        max_tokens: this.settings.maxTokens || 300,
        temperature: this.settings.temperature || 0.3
      };

      // For reasoning models, we might need different parameters if not explicitly set
      if (isReasoningModel && !this.settings.maxTokens) {
        requestBody.max_tokens = 500; // Reasoning models may need more tokens
      }
      if (isReasoningModel && !this.settings.temperature) {
        requestBody.temperature = 0.1; // Lower temperature for more focused reasoning
      }

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.settings.apiKey}`,
          'HTTP-Referer': chrome.runtime.getURL(''),
          'X-Title': 'Klyro'
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('OpenRouter: Response status:', response.status);
      console.log('OpenRouter: Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorBody = await response.text();
        console.error('OpenRouter API error:', response.status, errorBody);
        
        let errorMessage = `OpenRouter API error: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorBody);
          errorMessage += ` - ${errorJson.error?.message || errorJson.message || 'Unknown error'}`;
          
          // Handle specific OpenRouter error codes
          if (response.status === 402) {
            errorMessage = 'Insufficient credits or rate limit exceeded. Please check your OpenRouter account.';
          } else if (response.status === 400 && errorJson.error?.message?.includes('model')) {
            errorMessage = `Model "${this.settings.model}" not found or not available. Please check the model name.`;
          }
        } catch {
          errorMessage += ` - ${errorBody}`;
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log('OpenRouter: Response data:', data);
      console.log('OpenRouter: Choices array:', data.choices);
      console.log('OpenRouter: First choice:', data.choices?.[0]);
      console.log('OpenRouter: Message:', data.choices?.[0]?.message);
      console.log('OpenRouter: Content:', data.choices?.[0]?.message?.content);
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('OpenRouter: Invalid response structure');
        throw new Error('Invalid response structure from OpenRouter API');
      }

      // Check if the content is empty or null
      const messageContent = data.choices[0].message.content;
      const hasReasoning = data.choices[0].message.reasoning;
      
      if (!messageContent || messageContent.trim() === '') {
        console.error('OpenRouter: Empty content received from API');
        console.error('OpenRouter: Full response for debugging:', JSON.stringify(data, null, 2));
        
        // Check if there's an error in the response
        if (data.error) {
          throw new Error(`OpenRouter API returned error: ${data.error.message || 'Unknown error'}`);
        }
        
        // If we have reasoning content, don't throw an error - let extractMessageContent handle it
        if (hasReasoning && hasReasoning.trim() !== '') {
          console.log('OpenRouter: Content is empty but reasoning field contains data, proceeding...');
        } else {
          // Check if the model might not be available
          if (data.choices[0].finish_reason === 'length') {
            throw new Error('Response was cut off due to length limits. Try increasing max_tokens or using a different model.');
          }
          
          throw new Error(`Model "${this.settings.model}" returned empty response. The model may be unavailable or not responding properly. Try a different model.`);
        }
      }
      
      // Handle reasoning models that might have structured responses
      const extractedContent = this.extractMessageContent(data.choices[0].message, isReasoningModel);
      console.log('OpenRouter: Extracted message content:', extractedContent);
      
      const summary = this.extractResponse(extractedContent);
      console.log('OpenRouter: Final extracted summary:', summary);
      
      return summary;
    } catch (error) {
      console.error('OpenRouter: Error in summarize method:', error);
      throw error;
    }
  }
  
  isReasoningModel(modelName) {
    const reasoningModels = [
      'deepseek/deepseek-r1',
      'deepseek/deepseek-r1-distill-llama-70b',
      'qwen/qwen2.5-32b-instruct',
      'meta-llama/llama-3.1-405b-instruct',
      // Add other reasoning models as needed
    ];
    
    return reasoningModels.some(model => modelName.toLowerCase().includes(model.toLowerCase())) ||
           modelName.toLowerCase().includes('reasoning') ||
           modelName.toLowerCase().includes('-r1');
  }
  
  extractMessageContent(message, isReasoningModel) {
    console.log('OpenRouter: extractMessageContent called with message:', message);
    console.log('OpenRouter: isReasoningModel:', isReasoningModel);
    
    // Check if content is empty or whitespace-only
    const hasValidContent = message.content && message.content.trim() !== '';
    
    // If content is empty but reasoning exists, use reasoning regardless of model type(Workaround)
    if (!hasValidContent && message.reasoning) {
      console.log('OpenRouter: Content is empty, using reasoning field:', message.reasoning);
      return message.reasoning;
    }
    
    // For reasoning models, check if the response has a specific structure
    if (isReasoningModel && message.reasoning) {
      console.log('OpenRouter: Reasoning found:', message.reasoning);
      // Use the final answer after reasoning, but prefer content if it has actual content
      return hasValidContent ? message.content : message.reasoning;
    }
    
    // For regular models or if no reasoning structure
    const content = message.content;
    console.log('OpenRouter: Using message.content:', content);
    return content;
  }
  
  extractResponse(text) {
    console.log('OpenRouter: extractResponse called with:', text);
    
    if (!text) {
      console.log('OpenRouter: No text provided to extractResponse');
      return 'No response received';
    }
    
    // Try to extract from our specific format first
    const match = text.match(/<response>(.*?)<\/response>/s);
    if (match) {
      console.log('OpenRouter: Found response tags, content:', match[1].trim());
      return match[1].trim();
    }
    
    // If this looks like reasoning text (model thinking process), extract the actual summary
    if (text.includes("let's tackle this summary") || text.includes("I need to understand the main points")) {
      console.log('OpenRouter: Detected reasoning text, extracting summary...');
      
      // Look for patterns that indicate the actual summary content
      const summaryPatterns = [
        // Look for text after "The post starts by talking about" or similar
        /(?:The post (?:starts by talking about|discusses|mentions)|The main (?:points|ideas?) (?:are|is)|Key (?:points|ideas?))\s*:?\s*(.*?)(?=\n\n|I need to|The conclusion|$)/is,
        // Look for sentences that seem to be actual summary content
        /([A-Z][^.!?]*(?:Cursor|LinkedIn|developers?|CEO|trust|switching)[^.!?]*[.!?](?:\s+[A-Z][^.!?]*[.!?])*)/is
      ];
      
      for (const pattern of summaryPatterns) {
        const summaryMatch = text.match(pattern);
        if (summaryMatch && summaryMatch[1] && summaryMatch[1].trim().length > 50) {
          const extractedSummary = summaryMatch[1].trim();
          console.log('OpenRouter: Extracted summary from reasoning:', extractedSummary);
          return extractedSummary;
        }
      }
      
      // If patterns don't work, try to extract the middle portion that looks like summary
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
      const summaryLines = sentences.slice(1, -1).join('. ').trim();
      if (summaryLines.length > 50) {
        console.log('OpenRouter: Using middle sentences as summary:', summaryLines);
        return summaryLines + '.';
      }
    }
    
    // If no specific format, clean up the raw response
    let cleanText = text.trim();
    console.log('OpenRouter: No response tags found, using raw text:', cleanText);
    
    // Remove common prefixes that reasoning models might add
    cleanText = cleanText.replace(/^(Summary:|Here's a summary:|The summary is:|Okay, let's tackle this summary\.|.*?First, I need to understand the main points\.?\s*)/is, '');
    
    // For reasoning models, try to extract the final conclusion
    const conclusionMatch = cleanText.match(/(?:conclusion|summary|final answer):\s*(.*?)$/is);
    if (conclusionMatch) {
      console.log('OpenRouter: Found conclusion pattern:', conclusionMatch[1].trim());
      return conclusionMatch[1].trim();
    }
    
    // Take the first meaningful paragraph if it's a long response
    const paragraphs = cleanText.split('\n\n').filter(p => p.trim().length > 30);
    const result = paragraphs[0]?.trim() || cleanText.split('\n')[0]?.trim() || cleanText;
    console.log('OpenRouter: Final result:', result);
    return result;
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
          temperature: this.settings.temperature || 0.3,
          num_predict: this.settings.maxTokens || 150
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
