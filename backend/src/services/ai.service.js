import { GoogleGenAI, FunctionCallingConfigMode } from '@google/genai';
import { env, isAiEnabled } from '../config/env.js';
import { db } from '../db/connection.js';
import { TONE_GUIDELINES, getKnowledgeBaseExcerpt } from './knowledgeBase.js';
import { CATEGORIES, PRIORITIES } from '../constants.js';

const client = isAiEnabled ? new GoogleGenAI({ apiKey: env.geminiApiKey }) : null;

const MAX_DESCRIPTION_CHARS = 2000; // caps worst-case input tokens from an unusually long query

let logInvocationStatement = null;

function recordInvocation(fields) {
  try {
    // Prepared lazily (on first use) rather than at module load time, since
    // this module is imported before server.js applies the schema on a
    // fresh/empty database (e.g. right after a free-tier host wipes local
    // disk on restart) - preparing it eagerly would fail with "no such
    // table" before the bootstrap ever gets a chance to create it.
    logInvocationStatement ??= db.prepare(`
      INSERT INTO ai_invocations (ticket_id, invocation_type, model, status, input_tokens, output_tokens, latency_ms, error_message)
      VALUES (@ticket_id, @invocation_type, @model, @status, @input_tokens, @output_tokens, @latency_ms, @error_message)
    `);
    logInvocationStatement.run({
      model: null,
      input_tokens: null,
      output_tokens: null,
      latency_ms: null,
      error_message: null,
      ...fields,
    });
  } catch (err) {
    console.error('Failed to record AI invocation log:', err);
  }
}

const CLASSIFY_FUNCTION = {
  name: 'classify_ticket',
  description: 'Classify a BookLeaf author support ticket into a category and a priority.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      category: { type: 'string', enum: CATEGORIES },
      priority: { type: 'string', enum: PRIORITIES },
      reasoning: { type: 'string', description: 'One short sentence explaining the priority call.' },
    },
    required: ['category', 'priority', 'reasoning'],
  },
};

const CLASSIFY_SYSTEM_PROMPT = `
You triage incoming support tickets for BookLeaf Publishing, a self-publishing company.
Pick exactly one category from the enum provided, and a priority:
- Critical: money the author is owed appears to be missing/overdue, or a production-blocking data error (e.g. wrong ISBN linked).
- High: a clear service failure affecting one book (bad print quality, long unexplained delay).
- Medium: a real issue but not urgent or not yet overdue (e.g. "royalty seems low", status check within normal timelines).
- Low: account/informational questions with no urgency (e.g. "can I update my bio").
Call the classify_ticket function with your answer. Do not respond with plain text.
`.trim();

/**
 * Classifies a ticket's category + priority in a single model call (not two),
 * which halves the per-ticket classification cost versus calling the model
 * once per field.
 */
export async function classifyTicket({ ticketId, subject, description, bookTitle }) {
  if (!isAiEnabled) {
    recordInvocation({ ticket_id: ticketId, invocation_type: 'classification', status: 'skipped_no_key' });
    return fallbackClassification();
  }

  const truncatedDescription = description.slice(0, MAX_DESCRIPTION_CHARS);
  const userMessage = [
    bookTitle ? `Book: ${bookTitle}` : 'Book: General / Account Level',
    `Subject: ${subject}`,
    `Description: ${truncatedDescription}`,
  ].join('\n');

  const startedAt = Date.now();
  try {
    const response = await client.models.generateContent({
      model: env.geminiModel,
      contents: userMessage,
      config: {
        systemInstruction: CLASSIFY_SYSTEM_PROMPT,
        maxOutputTokens: 200,
        thinkingConfig: { thinkingBudget: 0 },
        tools: [{ functionDeclarations: [CLASSIFY_FUNCTION] }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: ['classify_ticket'],
          },
        },
      },
    });

    const call = response.functionCalls?.[0];
    if (!call) throw new Error('Model did not return a function call');

    recordInvocation({
      ticket_id: ticketId,
      invocation_type: 'classification',
      model: env.geminiModel,
      status: 'success',
      input_tokens: response.usageMetadata?.promptTokenCount ?? null,
      output_tokens: response.usageMetadata?.candidatesTokenCount ?? null,
      latency_ms: Date.now() - startedAt,
    });

    return {
      category: call.args.category,
      priority: call.args.priority,
      source: 'ai',
    };
  } catch (err) {
    console.error('Gemini classification failed:', err);
    recordInvocation({
      ticket_id: ticketId,
      invocation_type: 'classification',
      model: env.geminiModel,
      status: 'error',
      latency_ms: Date.now() - startedAt,
      error_message: err.message,
    });
    return fallbackClassification();
  }
}

function fallbackClassification() {
  // Graceful degradation: the ticket still gets created with sane defaults,
  // and an admin can re-classify by hand from the queue.
  return { category: 'General Inquiry', priority: 'Medium', source: 'fallback' };
}

const DRAFT_SYSTEM_PROMPT_TEMPLATE = (kbExcerpt) => `
You are a BookLeaf Publishing support representative replying to an author's support ticket.
Write the reply itself, no greeting like "Dear X" headers, no sign-off block, just the message body.
Keep it to 3-6 short sentences.

Tone rules:
${TONE_GUIDELINES}

Facts you may rely on:
${kbExcerpt}

Only state facts you were given above or in the ticket. Do not invent dates, amounts, or statuses
that were not provided. If a specific figure is needed and not available, say the team will confirm it.
When you cite a date that was given to you, copy it exactly, character for character, including the
year - never retype it from memory or guess the year.
`.trim();

/**
 * Drafts a reply for an admin to review/edit. Only the ticket's own subject +
 * description + resolved book context are sent, not the full prior message
 * thread, to keep the prompt small regardless of how old/long the ticket is.
 * The result is cached on the ticket (ai_draft_response) by the caller so
 * reopening the ticket doesn't trigger a second paid call.
 */
export async function generateDraftResponse({ ticketId, subject, description, category, authorName, bookContext }) {
  if (!isAiEnabled) {
    recordInvocation({ ticket_id: ticketId, invocation_type: 'draft_response', status: 'skipped_no_key' });
    return null;
  }

  const truncatedDescription = description.slice(0, MAX_DESCRIPTION_CHARS);
  const userMessage = [
    `Author: ${authorName}`,
    bookContext ? `Book context: ${bookContext}` : 'Book context: none (general / account-level query)',
    `Subject: ${subject}`,
    `Description: ${truncatedDescription}`,
  ].join('\n');

  const startedAt = Date.now();
  try {
    const response = await client.models.generateContent({
      model: env.geminiModel,
      contents: userMessage,
      config: {
        systemInstruction: DRAFT_SYSTEM_PROMPT_TEMPLATE(getKnowledgeBaseExcerpt(category)),
        maxOutputTokens: 600,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    recordInvocation({
      ticket_id: ticketId,
      invocation_type: 'draft_response',
      model: env.geminiModel,
      status: 'success',
      input_tokens: response.usageMetadata?.promptTokenCount ?? null,
      output_tokens: response.usageMetadata?.candidatesTokenCount ?? null,
      latency_ms: Date.now() - startedAt,
    });

    return response.text?.trim() ?? null;
  } catch (err) {
    console.error('Gemini draft generation failed:', err);
    recordInvocation({
      ticket_id: ticketId,
      invocation_type: 'draft_response',
      model: env.geminiModel,
      status: 'error',
      latency_ms: Date.now() - startedAt,
      error_message: err.message,
    });
    return null; // admin writes the response manually; ticket flow is never blocked by AI downtime
  }
}
