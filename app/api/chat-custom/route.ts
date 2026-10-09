import { NextRequest, NextResponse } from 'next/server';
import { filterContent } from '../../../lib/contentFilter';
import { type ConversationTurn } from '../../../lib/knowledgeIndex';
import { buildReply, composeNoMatch } from '../../../lib/composeResponse';

import { customAIModel, isCustomAIModelReady, DEFAULT_AI_CONFIG } from '../../../lib/customAIModel';

/**
 * Custom AI Model Chat Endpoint
 * This endpoint is specifically designed for integration with your trained AI model
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, options = {} } = body;
    const history = sanitizeHistory(body?.history);

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    // Content safety check
    const contentCheck = filterContent(message);
    if (contentCheck.isInappropriate && contentCheck.suggestedResponse) {
      return NextResponse.json({
        response: contentCheck.suggestedResponse,
        source: 'Content Filter',
        category: 'Safety',
        isFiltered: true,
        severity: contentCheck.severity
      });
    }

    const tailored = buildReply(message, history);
    if (tailored) {
      return NextResponse.json({
        response: tailored.response,
        source: tailored.source,
        category: tailored.category,
        handledBy: 'tailored_knowledge',
        tailored: true
      });
    }

    // Custom AI Model Integration
    if (!isCustomAIModelReady()) {
      return NextResponse.json({
        response: composeNoMatch(message, history),
        source: 'Knowledge',
        category: 'No match',
        needsCustomAIIntegration: true,
        handledBy: 'tailored_knowledge'
      });
    }

    try {
      const aiConfig = {
        temperature: options.temperature || DEFAULT_AI_CONFIG.temperature,
        maxTokens: options.maxTokens || DEFAULT_AI_CONFIG.maxTokens,
        context: {
          ...DEFAULT_AI_CONFIG.context,
          ...(options.context || {})
        },
        ...options,
        history
      };

      const aiResponse = await customAIModel.generateResponse(message, aiConfig);
      
      return NextResponse.json({
        response: aiResponse.content,
        source: 'Custom AI Model',
        category: aiResponse.category || 'AI Generated',
        confidence: aiResponse.confidence,
        tokens_used: aiResponse.tokensUsed,
        processing_time: aiResponse.processingTime,
        handledBy: 'custom_ai_model',
        modelInfo: customAIModel.getModelInfo()
      });
      
    } catch (aiError) {
      console.error('Custom AI model error:', aiError);
      
      return NextResponse.json({
        response: "I apologize, but I'm experiencing technical difficulties with my AI processing. Please try again in a moment, or contact IT support if the issue persists.",
        source: 'Error Handler',
        category: 'System Error',
        error: true,
        errorMessage: aiError instanceof Error ? aiError.message : 'Unknown error',
        handledBy: 'error_fallback'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in custom AI chat API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to process request with custom AI model'
      },
      { status: 500 }
    );
  }
}

// Model configuration endpoint
function sanitizeHistory(value: unknown): ConversationTurn[] {
  if (!Array.isArray(value)) return [];
  const turns: ConversationTurn[] = [];
  for (const item of value.slice(-8)) {
    if (!item || typeof item !== 'object') continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') continue;
    const trimmed = content.trim().slice(0, 800);
    if (!trimmed) continue;
    turns.push({ role, content: trimmed });
  }
  return turns;
}

export async function GET() {
  return NextResponse.json({
    status: 'ready_for_integration',
    message: 'Custom AI model endpoint ready for integration',
    timestamp: new Date().toISOString(),
    configuration: {
      contentFiltering: 'enabled',
      basicKnowledgeFallback: 'enabled',
      customAIModel: isCustomAIModelReady() ? 'ready' : 'pending_integration',
      supportedFeatures: [
        'text_generation',
        'context_awareness',
        'legal_knowledge',
        'case_management_guidance',
        'document_assistance'
      ]
    },
    integrationSteps: [
      '1. Import your custom AI model',
      '2. Configure model parameters',
      '3. Implement response generation',
      '4. Add error handling',
      '5. Test with legal queries'
    ]
  });
}
