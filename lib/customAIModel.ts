// Custom AI Model Interface
// This file provides the structure for integrating your trained AI model

export interface AIModelConfig {
  temperature?: number;
  maxTokens?: number;
  history?: { role: 'user' | 'assistant'; content: string }[];
  context?: {
    role: string;
    company: string;
    capabilities: string[];
  };
  model?: string;
  apiKey?: string;
  endpoint?: string;
}

export interface AIResponse {
  content: string;
  confidence?: number;
  tokensUsed?: number;
  processingTime?: number;
  category?: string;
  metadata?: Record<string, any>;
}

export interface CustomAIModel {
  generateResponse(message: string, config?: AIModelConfig): Promise<AIResponse>;
  isAvailable(): boolean;
  getModelInfo(): {
    name: string;
    version: string;
    capabilities: string[];
  };
}

/**
 * Default configuration for your AI model
 */
export const DEFAULT_AI_CONFIG: AIModelConfig = {
  temperature: 0.7,
  maxTokens: 1000,
  context: {
    role: 'legal_assistant',
    company: 'Ardent Paralegal Business Solutions',
    capabilities: [
      'case_management',
      'legal_research', 
      'document_organization',
      'client_communication',
      'paralegal_services',
      'intake_processing',
      'insurance_guidance',
      'treatment_planning'
    ]
  }
};

/**
 * Example implementation structure for your custom AI model
 * Replace this with your actual AI model integration
 */
export class CustomAIModelImplementation implements CustomAIModel {
  private config: AIModelConfig;

  constructor(config: Partial<AIModelConfig> = {}) {
    this.config = { ...DEFAULT_AI_CONFIG, ...config };
  }

  async generateResponse(message: string, config?: AIModelConfig): Promise<AIResponse> {
    const finalConfig = { ...this.config, ...config };
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    const started = Date.now();
    const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash';
    const history = (finalConfig.history || []).slice(-8).map(turn => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content.slice(0, 2000) }]
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: this.buildPrompt(message, finalConfig) }]
          },
          contents: [
            ...history,
            { role: 'user', parts: [{ text: message }] }
          ],
          generationConfig: {
            temperature: finalConfig.temperature ?? 0.7,
            maxOutputTokens: finalConfig.maxTokens ?? 1000
          }
        }),
        signal: AbortSignal.timeout(20000)
      }
    );

    if (!response.ok) {
      console.error('Gemini request failed', response.status);
      throw new Error(`Gemini request failed (${response.status})`);
    }

    const result = await response.json();
    const content = result?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || '')
      .join('')
      .trim();

    if (!content) {
      throw new Error('Gemini returned an empty response');
    }

    return {
      content,
      confidence: 0.8,
      tokensUsed: result?.usageMetadata?.totalTokenCount || 0,
      processingTime: Date.now() - started,
      category: this.categorizeResponse(message),
      metadata: { model }
    };
  }

  isAvailable(): boolean {
    return getGeminiApiKey() !== null;
  }

  getModelInfo() {
    return {
      name: 'Google Gemini',
      version: process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash',
      capabilities: this.config.context?.capabilities || []
    };
  }

  private buildPrompt(_message: string, config: AIModelConfig): string {
    return `You are Ardi, the assistant for ${config.context?.company || 'Ardent Paralegal Business Solutions'}.
Answer the user's latest message directly and conversationally.
Use earlier messages in the chat as context for follow-ups like "yeah", "for example", or "what about".
When the question is about Ardent policy, training length, or an internal procedure and you were not given that fact, say you don't have that company detail instead of inventing it.
For general questions, answer from general knowledge in a few short paragraphs or a short list.`;
  }

  private categorizeResponse(message: string): string {
    // TODO: Implement response categorization logic
    const messageLower = message.toLowerCase();
    
    if (messageLower.includes('case') || messageLower.includes('legal')) {
      return 'Legal';
    } else if (messageLower.includes('document') || messageLower.includes('file')) {
      return 'Documentation';
    } else if (messageLower.includes('client') || messageLower.includes('contact')) {
      return 'Client Relations';
    } else if (messageLower.includes('intake') || messageLower.includes('process')) {
      return 'Process Management';
    }
    
    return 'General';
  }
}

function getGeminiApiKey(): string | null {
  if (typeof window !== 'undefined') return null;
  if (process.env.NEXT_PUBLIC_GEMINI_API_KEY) return null;

  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === 'your_api_key_here' || key.startsWith('your_')) return null;
  return key;
}

// Export singleton instance
export const customAIModel = new CustomAIModelImplementation();

// Utility function to check if custom AI model is ready
export const isCustomAIModelReady = (): boolean => {
  return customAIModel.isAvailable();
};
