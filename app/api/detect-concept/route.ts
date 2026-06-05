import { NextResponse } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';

type RequestBody = {
  userMessage: string;
};

type ExtractedConcept = {
  subject: string;
  concept: string;
};

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const anthropic = anthropicApiKey
  ? new Anthropic({ apiKey: anthropicApiKey })
  : null;

export async function POST(request: Request) {
  if (!anthropic) {
    return NextResponse.json(
      { error: 'Missing ANTHROPIC_API_KEY environment variable.' },
      { status: 500 },
    );
  }

  let body: RequestBody;

  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: 'Request body must be valid JSON.' },
      { status: 400 },
    );
  }

  const userMessage = String(body?.userMessage ?? '').trim();

  if (!userMessage) {
    return NextResponse.json(
      { error: 'Missing required field: userMessage.' },
      { status: 400 },
    );
  }

  try {
    const completion = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [
        {
          role: 'user',
          content: `Extract the subject and concept from the following message. If the message is not about studying a concept, return subject: '' and concept: ''. Return only a JSON object with the exact fields subject and concept.\n\nMessage: ${userMessage}\n\nOutput:`,
        },
      ],
    });

    const text = completion.content.length > 0 && completion.content[0].type === 'text'
      ? completion.content[0].text.trim()
      : '';
    const extracted = parseConceptJson(text);

    return NextResponse.json(extracted);
  } catch (error) {
    return NextResponse.json(
      { subject: '', concept: '' },
      { status: 200 },
    );
  }
}

function parseConceptJson(output: string): ExtractedConcept {
  const trimmed = output.trim();

  try {
    const jsonStart = trimmed.indexOf('{');
    const jsonEnd = trimmed.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      return { subject: '', concept: '' };
    }

    const jsonText = trimmed.slice(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(jsonText) as Partial<ExtractedConcept>;

    return {
      subject: typeof parsed?.subject === 'string' ? parsed.subject : '',
      concept: typeof parsed?.concept === 'string' ? parsed.concept : '',
    };
  } catch {
    return { subject: '', concept: '' };
  }
}
