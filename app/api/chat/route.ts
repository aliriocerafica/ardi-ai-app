import { NextRequest, NextResponse } from 'next/server';
import { type ConversationTurn } from '../../../lib/knowledgeIndex';
import { buildReply, composeNoMatch } from '../../../lib/composeResponse';
import { filterContent } from '../../../lib/contentFilter';

import { customAIModel, isCustomAIModelReady } from '../../../lib/customAIModel';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = body?.message;
    const history = sanitizeHistory(body?.history);

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    // Content filtering first
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
        isBasicKnowledge: true,
        tailored: true
      });
    }

    // Use custom AI model if available, otherwise fallback
    if (isCustomAIModelReady()) {
      try {
        const aiResponse = await customAIModel.generateResponse(message, {
          temperature: 0.7,
          maxTokens: 1000,
          history
        });
        
        return NextResponse.json({
          response: aiResponse.content,
          source: 'Google Gemini',
          category: aiResponse.category || 'AI Generated',
          confidence: aiResponse.confidence,
          tokens_used: aiResponse.tokensUsed,
          processing_time: aiResponse.processingTime
        });
      } catch (aiError) {
        console.error('Custom AI model error:', aiError);
        // Continue to fallback response
      }
    }

    // Fallback response when custom AI model is not ready or failed
    return NextResponse.json({
      response: composeNoMatch(message, history),
      source: 'Knowledge',
      category: 'No match',
      needsAIModelIntegration: !isCustomAIModelReady(),
      modelStatus: isCustomAIModelReady() ? 'failed' : 'not_configured'
    });

  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ready_for_ai_integration',
    message: 'Chat API is ready for custom AI model integration',
    timestamp: new Date().toISOString(),
    features: {
      contentFiltering: 'active',
      basicKnowledge: 'active',
      customAIModel: isCustomAIModelReady() ? 'active' : 'pending_integration'
    },
    modelInfo: isCustomAIModelReady() ? customAIModel.getModelInfo() : null
  });
}