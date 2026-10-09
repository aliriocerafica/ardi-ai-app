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
const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
const FALLBACK_GEMINI_MODELS = ['gemini-3.6-flash'];
const TRANSIENT_GEMINI_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export const DEFAULT_AI_CONFIG: AIModelConfig = {
  temperature: 0.7,
  maxTokens: 2048,
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
    const history = (finalConfig.history || []).slice(-8).map(turn => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content.slice(0, 2000) }]
    }));
    const payload = {
      systemInstruction: {
        parts: [{ text: this.buildPrompt(message, finalConfig) }]
      },
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      generationConfig: {
        maxOutputTokens: Math.max(finalConfig.maxTokens ?? 2048, 2048),
        thinkingConfig: {
          thinkingLevel: 'low'
        }
      }
    };

    let lastError: Error | null = null;
    for (const model of geminiModelCandidates()) {
      let response: Response;
      try {
        response = await requestGemini(apiKey, model, payload);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Gemini request failed');
        console.warn(`Gemini ${model} failed:`, lastError.message);
        continue;
      }
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 500);
        console.error('Gemini request failed', response.status, detail);
        lastError = new Error(`Gemini request failed (${response.status})`);
        if (!TRANSIENT_GEMINI_STATUS.has(response.status)) {
          throw lastError;
        }
        continue;
      }

      const result = await response.json();
      const content = result?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text || '')
        .join('')
        .trim();

      if (!content) {
        lastError = new Error('Gemini returned an empty response');
        continue;
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

    throw lastError || new Error('Gemini request failed');
  }

  isAvailable(): boolean {
    return getGeminiApiKey() !== null;
  }

  getModelInfo() {
    return {
      name: 'Google Gemini',
      version: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
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

function geminiModelCandidates(): string[] {
  const primary = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const seen = new Set<string>();
  const models: string[] = [];
  for (const model of [primary, ...FALLBACK_GEMINI_MODELS]) {
    if (!model || seen.has(model)) continue;
    seen.add(model);
    models.push(model);
  }
  return models;
}

async function requestGemini(
  apiKey: string,
  model: string,
  payload: object
): Promise<Response> {
  const attempts = 2;
  let lastResponse: Response | null = null;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(20000)
        }
      );
      lastResponse = response;
      if (response.ok || !TRANSIENT_GEMINI_STATUS.has(response.status) || attempt === attempts) {
        return response;
      }

      await response.text().catch(() => undefined);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Gemini request failed');
      if (attempt === attempts) throw lastError;
    }

    const waitMs = 600 * attempt;
    console.warn(`Gemini ${model} attempt ${attempt} failed; retrying in ${waitMs}ms`);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }

  if (lastResponse) return lastResponse;
  throw lastError || new Error('Gemini request failed');
}

// Export singleton instance
export const customAIModel = new CustomAIModelImplementation();

// Utility function to check if custom AI model is ready
export const isCustomAIModelReady = (): boolean => {
  return customAIModel.isAvailable();
};
