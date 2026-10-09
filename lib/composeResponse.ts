import { findKnowledge, type ConversationTurn, type KnowledgeResult } from './knowledgeIndex';

type QuestionIntent = 'duration' | 'list' | 'procedure' | 'detail' | 'definition';

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'to', 'for', 'with', 'about',
  'what', 'how', 'why', 'when', 'where', 'is', 'are', 'do', 'does', 'can', 'you',
  'i', 'we', 'it', 'me', 'my', 'your', 'our', 'that', 'this', 'those', 'them',
  'please', 'tell', 'explain', 'detail', 'details'
]);

export interface TailoredReply {
  response: string;
  source: string;
  category: string;
}

function questionIntent(question: string): QuestionIntent {
  const text = question.toLowerCase();
  if (/\b(tell me more|more detail|elaborate|in detail|walk me through|explain)\b/.test(text)) return 'detail';
  if (/\b(how long|how many|how much time|duration)\b/.test(text)) return 'duration';
  if (/\b(types of|kinds of|what are the|which are|list)\b/.test(text)) return 'list';
  if (/\b(how do|how to|steps|process|procedure)\b/.test(text)) return 'procedure';
  return 'definition';
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && !STOP_WORDS.has(token));
}

function plain(text: string): string {
  return text
    .replace(/[#*_>`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sentencesOf(text: string): string[] {
  return plain(text)
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 25);
}

interface Section {
  heading: string;
  body: string;
}

function splitSections(content: string): Section[] {
  const sections: Section[] = [];
  let heading = '';
  let body: string[] = [];

  const flush = () => {
    const text = body.join('\n').trim();
    if (heading || text) sections.push({ heading, body: text });
    body = [];
  };

  for (const line of content.split('\n')) {
    if (/^#{2,4}\s+/.test(line)) {
      flush();
      heading = line.replace(/^#{2,4}\s+/, '').replace(/\*\*/g, '').trim();
    } else {
      body.push(line);
    }
  }
  flush();

  return sections.filter(section => plain(`${section.heading} ${section.body}`).length > 20);
}

function scoreSection(section: Section, questionTokens: string[], intent: QuestionIntent): number {
  const haystack = `${section.heading} ${section.body}`.toLowerCase();
  let score = questionTokens.reduce((total, token) => total + (haystack.includes(token) ? 2 : 0), 0);
  if (section.heading && questionTokens.some(token => section.heading.toLowerCase().includes(token))) score += 3;
  if (intent === 'duration' && /\b(\d+|six|one|two|three)\b/.test(haystack) && /\b(day|week|month|year)s?\b/.test(haystack)) {
    score += 6;
  }
  if (intent === 'procedure' && /(^|\n)\s*(\d+\.|[-*])\s+/.test(section.body)) score += 3;
  return score;
}

function subjectOf(question: string): string {
  const cleaned = question
    .replace(/[?!.]+$/g, '')
    .replace(/^(how long is|how long are|how long does|what is|what are|who is|define|explain|tell me about|walk me through)\s+(the\s+|a\s+|an\s+)?/i, '')
    .trim();
  return cleaned;
}

function durationPhrase(text: string): string | null {
  const match = plain(text).match(/\b(\d+\s*(?:-|to)\s*\d+|\d+|six(?:\s*\(\s*\d+\s*\))?|one|two|three|four|five)\s+(day|week|month|year)s?\b/i);
  return match ? match[0].replace(/\s+/g, ' ').trim() : null;
}

function formatSection(section: Section, maxSentences: number, lead: string | null = null): string {
  const sentences = sentencesOf(section.body)
    .filter(sentence => !repeatsLead(sentence, lead))
    .slice(0, maxSentences);
  const body = sentences.length > 0 ? sentences.join(' ') : '';
  if (!body) return '';
  return section.heading && sentences.length > 1 ? `**${section.heading}**\n${body}` : body;
}

function repeatsLead(sentence: string, lead: string | null): boolean {
  if (!lead) return false;
  const left = plain(sentence).toLowerCase();
  const right = plain(lead).toLowerCase();
  if (left.includes(right.slice(0, 28)) || right.includes(left.slice(0, 28))) return true;
  const time = durationPhrase(lead);
  if (!time) return false;
  return left.includes(time.toLowerCase()) && tokens(lead).some(token => left.includes(token));
}

export function composeTailoredResponse(question: string, result: KnowledgeResult): string {
  const intent = questionIntent(question);
  const about = question.match(/^(?:what|how) about(?: the)?\s+(.+)/i)?.[1]?.replace(/[?.!]+$/g, '').trim();
  const focus = about || question;
  const questionTokens = tokens(focus);
  const sections = splitSections(result.content);
  const ranked = (sections.length > 0 ? sections : [{ heading: '', body: result.content }])
    .map(section => ({ section, score: scoreSection(section, questionTokens, intent) }))
    .sort((left, right) => right.score - left.score);

  const withBody = ranked.filter(item => plain(item.section.body).length > 40);
  const pool = withBody.length > 0 ? withBody : ranked;
  const headed = sections.filter(section => section.heading && plain(section.body).length > 40);
  const picked = intent === 'list' && headed.length >= 3
    ? headed.slice(0, 6)
    : (pool[0]?.score > 0 ? pool.filter(item => item.score > 0) : pool)
        .slice(0, intent === 'detail' ? 3 : intent === 'procedure' ? 2 : 1)
        .map(item => item.section);
  const sourceText = picked.map(section => `${section.heading}\n${section.body}`).join('\n');
  const subject = subjectOf(about || question);

  if (intent === 'list' && picked.length > 1) {
    const items = picked.map(section => {
      const summary = sentencesOf(section.body)[0] || plain(section.body).slice(0, 180);
      return section.heading ? `- **${section.heading}** — ${summary}` : `- ${summary}`;
    });
    const intro = subject ? `For ${subject}, these are the points that apply:` : 'These are the points that apply:';
    return `${intro}\n\n${items.join('\n')}`;
  }

  const time = intent === 'duration' ? durationPhrase(sourceText) : null;
  const namedSubject = subject ? (/^(the|a|an)\b/i.test(subject) ? capitalize(subject) : `The ${subject}`) : '';
  const lead = time && namedSubject
    ? `${namedSubject} is **${time}**.`
    : sentencesOf(sourceText)[0] || null;
  const supportCount = intent === 'detail' ? 4 : intent === 'procedure' ? 3 : 2;
  const support = picked
    .map(section => formatSection(section, supportCount, lead))
    .filter(Boolean)
    .join('\n\n');

  if (lead && support && !plain(support).toLowerCase().startsWith(plain(lead).toLowerCase().slice(0, 48))) {
    return `${lead}\n\n${support}`.trim();
  }
  return (support || result.content).trim();
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function splitQuestion(question: string): string[] {
  const words = question.trim().split(/\s+/);
  if (words.length < 10 || !/,|\band\b/i.test(question)) return [question];
  const parts = question
    .split(/,|\band\b/i)
    .map(part => part.replace(/^(explain|describe|tell me about|walk me through)\s+/i, '').replace(/[?.!]+$/g, '').trim())
    .filter(part => part.split(/\s+/).length >= 2);
  return parts.length > 1 ? parts : [question];
}

type Cue = 'yes' | 'no' | 'thanks' | 'example' | 'when';

function conversationCue(message: string): Cue | null {
  const text = message.trim().toLowerCase().replace(/[!?.]+/g, '').trim();
  if (/^(thanks|thank you|ty|thx)$/.test(text)) return 'thanks';
  if (/^(no|nope|nah|not really)$/.test(text)) return 'no';
  if (/^(since when|from when|how long ago|when|since|when was that|when was this|when did that start|when did this start|when did it start)$/.test(text)) return 'when';
  if (/^(yeah|yea|yep|yes|ok|okay|k|sure|right|got it|cool|nice|good|great|makes sense|i see|alright|exactly|true|interesting|uh huh|mhm)$/.test(text)) return 'yes';
  if (/\b(for example|do what|like what|such as|an example|give an example)\b/i.test(message)) return 'example';
  return null;
}

function statedDate(text: string): string | null {
  const match = plain(text).match(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\b|\b(?:19|20)\d{2}\b/i);
  return match ? match[0] : null;
}

function startFact(text: string): string | null {
  const cleaned = plain(text)
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1');
  const match = cleaned.match(/[^.!?]{0,40}\b(was founded|were founded|founded|started|began|launched|opened)\b[^.!?]{12,240}/i);
  if (!match) return null;
  let sentence = match[0].trim().replace(/^[^A-Za-z]+/, '');
  const afterColon = sentence.split(':').pop()?.trim() ?? sentence;
  if (afterColon.length > 40 && /\b(founded|started|began|launched|opened)\b/i.test(afterColon)) {
    sentence = afterColon;
  }
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

function lastTurn(history: ConversationTurn[], role: ConversationTurn['role']): string {
  return [...history].reverse().find(turn => turn.role === role && turn.content.trim())?.content.trim() ?? '';
}

function actionLines(content: string): string[] {
  return content
    .split('\n')
    .filter(line => /^\s*([-*•]|\d+[.)])\s+\S/.test(line))
    .map(line => plain(line.replace(/^\s*([-*•]|\d+[.)])\s+/, '')).replace(/\.$/, ''))
    .filter(line => line.length > 8 && line.length < 160);
}

function joinActions(lines: string[]): string {
  const actions = lines.map(line => line.charAt(0).toLowerCase() + line.slice(1));
  if (actions.length === 1) return actions[0];
  if (actions.length === 2) return `${actions[0]} and ${actions[1]}`;
  return `${actions.slice(0, -1).join(', ')}, and ${actions[actions.length - 1]}`;
}

function spokenExample(content: string, previousAnswer: string): string {
  const alreadySaid = plain(previousAnswer).toLowerCase();
  const fresh = actionLines(content).filter(line => !alreadySaid.includes(line.toLowerCase().slice(0, 36)));
  if (fresh.length >= 2) {
    return `that looks like ${joinActions(fresh.slice(0, 3))}.`;
  }
  const prose = content
    .split('\n')
    .filter(line => !/^\s*#{1,6}\s/.test(line))
    .join('\n');
  const extra = sentencesOf(prose).filter(sentence => !alreadySaid.includes(plain(sentence).toLowerCase().slice(0, 36)));
  if (!extra.length) return '';
  const sentence = extra[0];
  return sentence.charAt(0).toLowerCase() + sentence.slice(1);
}

function continueConversation(message: string, history: ConversationTurn[]): TailoredReply | null {
  const cue = conversationCue(message);
  if (!cue) return null;

  const previousUser = lastTurn(history, 'user');
  const previousAnswer = lastTurn(history, 'assistant');

  if (cue === 'when') {
    if (!previousAnswer && !previousUser) return null;
    const detailed = previousUser ? findKnowledge(previousUser, history) : null;
    const blob = `${previousAnswer}\n${detailed?.content || ''}`;
    const date = statedDate(blob);
    if (date) {
      return {
        response: `That's since **${date}**.`,
        source: detailed?.source || 'Conversation',
        category: detailed?.category || 'Chat'
      };
    }
    const time = durationPhrase(blob);
    if (time && previousUser && /\b(how long|training|probation|period|duration)\b/i.test(`${previousUser} ${previousAnswer}`)) {
      return {
        response: `That's **${time}**.`,
        source: detailed?.source || 'Conversation',
        category: detailed?.category || 'Chat'
      };
    }
    const started = startFact(blob);
    const fact = started ? (/\.$/.test(started) ? started : `${started}.`) : '';
    return {
      response: fact
        ? `The notes don't give a year. ${fact}`
        : "The notes don't say when that started.",
      source: detailed?.source || 'Conversation',
      category: detailed?.category || 'Chat'
    };
  }

  if (cue === 'thanks') {
    return {
      response: "You're welcome. I can give an example or go into the next step if you want.",
      source: 'Conversation',
      category: 'Chat'
    };
  }

  if (cue === 'no') {
    return {
      response: previousUser
        ? `Got it. We can leave that there. What part of "${plain(previousUser)}" should I cover instead?`
        : 'Got it. What should I cover instead?',
      source: 'Conversation',
      category: 'Chat'
    };
  }

  const topic = cue === 'yes'
    ? ([...history].reverse().find(turn => {
        if (turn.role !== 'user' || !turn.content.trim()) return false;
        const earlier = conversationCue(turn.content);
        return earlier !== 'yes' && earlier !== 'no' && earlier !== 'thanks' && earlier !== 'when';
      })?.content.trim() ?? '')
    : message;
  if (!topic) {
    return {
      response: 'Yeah. What do you want to go into?',
      source: 'Conversation',
      category: 'Chat'
    };
  }

  const detailed = findKnowledge(`${topic} explain the process`, history);
  const example = detailed ? spokenExample(detailed.content, previousAnswer) : '';
  if (!example) {
    return {
      response: cue === 'yes'
        ? 'Yeah. I can go further on that. Do you want a concrete example, or the next step?'
        : 'I can put that into a concrete example. Tell me which part you want to see.',
      source: 'Conversation',
      category: 'Chat'
    };
  }

  const opener = cue === 'yes' ? 'Yeah. For example,' : 'For example,';
  return {
    response: `${opener} ${example}`,
    source: detailed?.source || 'Conversation',
    category: detailed?.category || 'Chat'
  };
}

export function buildReply(message: string, history: ConversationTurn[] = []): TailoredReply | null {
  const conversational = continueConversation(message, history);
  if (conversational) return conversational;

  const parts = splitQuestion(message);
  const answers: string[] = [];
  let source = 'Knowledge';
  let category = 'General';

  parts.forEach((part, index) => {
    const result = findKnowledge(part, index === 0 ? history : []);
    if (!result) return;
    if (answers.length === 0) {
      source = result.source;
      category = result.category;
    }
    answers.push(composeTailoredResponse(part, result));
  });

  if (answers.length === 0) return null;
  if (answers.length > 1) source = 'Knowledge';
  return {
    response: answers.join('\n\n'),
    source,
    category
  };
}

export function composeNoMatch(question: string, history: ConversationTurn[] = []): string {
  const topic = question.replace(/[?!.]+$/g, '').trim();
  const previous = [...history].reverse().find(turn => turn.role === 'user' && turn.content.trim())?.content.trim();
  if (previous && /\b(tell me more|what about|how about|elaborate)\b/i.test(question)) {
    return `I don't have more stored detail on "${topic}" beyond the earlier question, "${previous}". Ask for a specific part, such as the deadline, the definition, or the next step.`;
  }
  return `I don't have a stored answer for "${topic}". I can answer from Ardent's material on case management, intake, insurance, medical records, HR, and company procedures when the question names one of those.`;
}
