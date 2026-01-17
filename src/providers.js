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
    // Use tool calling if supported by the model, otherwise fall back to XML tags
    const useToolCalling = this.settings.useToolCalling !== false && this.supportsToolCalling();
    
    const requestBody = {
      model: this.settings.model,
      messages: [
        {
          role: 'system',
          content: useToolCalling 
            ? 'You are a LinkedIn post summarizer. Use the summarize_post function to create concise summaries that preserve company and people names.'
            : (this.settings.systemPrompt || 'You are a summariser model, your task is to summarise posts from the LinkedIn platform, you will be provided posts in the format <post> text </post> and should respond in the format <response> summaried version of original post text </response> Respond only in the format described, do not provide any additional response or commentary. Ensure any mentions of company or people names are retained in the summary.')
        },
        {
          role: 'user',
          content: useToolCalling ? postText : `<post>${postText}</post>`
        }
      ],
      max_tokens: this.settings.maxTokens || 150,
      temperature: this.settings.temperature || 0.3
    };
    
    if (useToolCalling) {
      requestBody.tools = [
        {
          type: 'function',
          function: {
            name: 'summarize_post',
            description: 'Summarize a LinkedIn post while preserving key information like company and people names',
            parameters: {
              type: 'object',
              properties: {
                summary: {
                  type: 'string',
                  description: 'A concise summary of the LinkedIn post that preserves important names and key points'
                }
              },
              required: ['summary']
            }
          }
        }
      ];
      requestBody.tool_choice = { type: 'function', function: { name: 'summarize_post' } };
    }
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.settings.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (useToolCalling && data.choices[0].message.tool_calls) {
      const toolCall = data.choices[0].message.tool_calls[0];
      const args = JSON.parse(toolCall.function.arguments);
      return args.summary;
    }
    
    return this.extractResponse(data.choices[0].message.content);
  }
  
  supportsToolCalling() {
    // OpenAI models that support tool calling
    const model = this.settings.model.toLowerCase();
    return model.includes('gpt-4') || model.includes('gpt-3.5-turbo');
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
      // Use tool calling if supported by the model and not a reasoning model
      const useToolCalling = this.settings.useToolCalling !== false && !isReasoningModel && this.supportsToolCalling();
      
      const requestBody = {
        model: this.settings.model,
        messages: [
          {
            role: 'system',
            content: useToolCalling
              ? 'You are a LinkedIn post summarizer. Use the summarize_post function to create concise summaries that preserve company and people names.'
              : `You are a summariser model, your task is to summarise posts from the LinkedIn platform, you will be provided posts in the format <post> text </post> and should respond in the format <response> summaried version of original post text </response> Respond only in the format described, do not provide any additional response or commentary. Ensure any mentions of company or people names are retained in the summary.`
          },
          {
            role: 'user',
            content: useToolCalling ? postText : `<post>${postText}</post>`
          }
        ],
        max_tokens: this.settings.maxTokens || 300,
        temperature: this.settings.temperature || 0.3
      };

      // Add tool calling configuration if supported
      if (useToolCalling) {
        requestBody.tools = [
          {
            type: 'function',
            function: {
              name: 'summarize_post',
              description: 'Summarize a LinkedIn post while preserving key information like company and people names',
              parameters: {
                type: 'object',
                properties: {
                  summary: {
                    type: 'string',
                    description: 'A concise summary of the LinkedIn post that preserves important names and key points'
                  }
                },
                required: ['summary']
              }
            }
          }
        ];
        requestBody.tool_choice = { type: 'function', function: { name: 'summarize_post' } };
      }

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

      // Check if tool calling was used and extract the response
      if (useToolCalling && data.choices[0].message.tool_calls) {
        const toolCall = data.choices[0].message.tool_calls[0];
        const args = JSON.parse(toolCall.function.arguments);
        return args.summary;
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
  
  supportsToolCalling() {
    // OpenRouter models that support tool calling (OpenAI-compatible models)
    const model = this.settings.model.toLowerCase();
    return model.includes('gpt-4') || 
           model.includes('gpt-3.5') ||
           model.includes('claude') ||
           model.includes('gemini');
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

// TransformersProvider for local inference using Transformers.js
class TransformersProvider extends AIProvider {
  constructor(settings) {
    super(settings);
    this.pipeline = null;
    this.modelLoading = null;
  }
  
  async loadModel() {
    // Avoid loading the model multiple times
    if (this.pipeline) {
      return this.pipeline;
    }
    
    // If already loading, wait for it
    if (this.modelLoading) {
      return this.modelLoading;
    }
    
    try {
      // Dynamic import of transformers.js
      this.modelLoading = (async () => {
        const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
        
        // Configure to use IndexedDB for model caching
        env.allowLocalModels = false;
        env.useBrowserCache = true;
        
        // Use a lightweight summarization model
        const modelName = this.settings.model || 'Xenova/distilbart-cnn-6-6';
        
        console.log('TransformersProvider: Loading model:', modelName);
        const pipe = await pipeline('summarization', modelName);
        console.log('TransformersProvider: Model loaded successfully');
        
        return pipe;
      })();
      
      this.pipeline = await this.modelLoading;
      this.modelLoading = null;
      return this.pipeline;
    } catch (error) {
      this.modelLoading = null;
      throw new Error(`Failed to load transformers.js model: ${error.message}`);
    }
  }
  
  async summarize(postText) {
    try {
      console.log('TransformersProvider: Starting summarization');
      
      const pipe = await this.loadModel();
      
      // Truncate if text is too long (transformers.js models have token limits)
      const maxInputLength = 1000; // characters
      const truncatedText = postText.length > maxInputLength 
        ? postText.substring(0, maxInputLength) + '...'
        : postText;
      
      // Generate summary
      const result = await pipe(truncatedText, {
        max_length: this.settings.maxTokens || 150,
        min_length: 30,
        do_sample: false
      });
      
      console.log('TransformersProvider: Summarization complete');
      
      return result[0].summary_text;
    } catch (error) {
      console.error('TransformersProvider: Error during summarization:', error);
      throw new Error(`Transformers.js error: ${error.message}`);
    }
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
    case 'transformers':
      return new TransformersProvider(settings);
    default:
      throw new Error(`Unknown provider: ${settings.provider}`);
  }
}

// Export for Node.js (tests)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AIProvider,
    OpenAIProvider,
    OpenRouterProvider,
    OllamaProvider,
    TransformersProvider,
    createProvider
  };
}
