import { NextResponse } from 'next/server';
import { Anthropic } from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase';

type ConceptRow = {
  mastery_level: string | null;
  weak_areas: string | null;
  strong_areas: string | null;
};

type RequestBody = {
  userMessage: string;
  subject: string;
  concept: string;
};

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const anthropic = anthropicApiKey
  ? new Anthropic({ apiKey: anthropicApiKey })
  : null;

async function queryConceptRow(
  subject: string,
  concept: string,
): Promise<{ data: ConceptRow | null; error: any }> {
  const supabase = createClient();
  // @ts-expect-error - Supabase client types vary
  return supabase
    .from('concepts')
    .select('mastery_level, weak_areas, strong_areas')
    .eq('subject', subject)
    .eq('concept', concept)
    .limit(1)
    .maybeSingle();
}

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
  const subject = String(body?.subject ?? '').trim();
  const concept = String(body?.concept ?? '').trim();

  if (!userMessage) {
    return NextResponse.json(
      { error: 'Missing required field: userMessage.' },
      { status: 400 },
    );
  }

  let conceptRow: ConceptRow | null = null;

  if (subject && concept) {
    const { data, error } = await queryConceptRow(subject, concept);

    if (error) {
      return NextResponse.json(
        { error: 'Failed to query Supabase concepts table.', details: error.message },
        { status: 500 },
      );
    }

    conceptRow = data ?? null;
  }

  const systemPrompt = buildSystemPrompt(conceptRow, subject, concept);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const responseStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 800,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userMessage,
            },
          ],
        });

        for await (const event of responseStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(event.delta.text);
          }
        }

        controller.close();
      } catch (error) {
        controller.error(error instanceof Error ? error : new Error('Unknown streaming error'));
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

function buildSystemPrompt(row: ConceptRow | null, subject: string, concept: string) {
  const subjectContext = subject ? `Subject: ${subject}.` : '';
  const conceptContext = concept ? `Concept: ${concept}.` : '';

  if (!row) {
    return `You are a supportive educational tutor.
${subjectContext} ${conceptContext}
Mode A: beginner friendly, analogy-first, define all terms.
Explain concepts clearly, using everyday examples and simple comparisons.
When teaching, assume the learner is encountering this idea for the first time and define any technical vocabulary before using it.`.trim();
  }

  const weakAreas = row.weak_areas
    ? `Weak areas: ${row.weak_areas}.`
    : 'No weak areas were provided.';
  const strongAreas = row.strong_areas
    ? `Strong areas: ${row.strong_areas}.`
    : 'No strong areas were provided.';

  const modeB = `Mode B: reference prior knowledge, mention weak areas, moderate pace.
Use the learner's existing strengths while calling out the weak areas to help them build confidence.
Maintain an approachable tone and avoid rushing the explanation.`;
  const modeC = `Mode C: technical, skip basics, focus on nuance.
Present the content in a precise and advanced way while still being clear.
Assume the learner already understands foundational ideas and concentrate on subtle details.`;

  const masteryLevel = String(row.mastery_level ?? '').trim();
  const selectedMode =
    masteryLevel === 'Introduced' || masteryLevel === 'Developing'
      ? modeB
      : masteryLevel === 'Proficient' || masteryLevel === 'Strong'
      ? modeC
      : modeB;

  return `You are a subject-matter tutor.
${subjectContext} ${conceptContext}
Mastery level: ${masteryLevel || 'unknown'}.
${weakAreas}
${strongAreas}
${selectedMode}`.trim();
}
