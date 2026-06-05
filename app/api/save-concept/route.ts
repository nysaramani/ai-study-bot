import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

type RequestBody = {
  subject: string;
  concept: string;
  masteryLevel: string;
  overviewGist: string;
  deepDiveGist: string[];
  strongAreas: string[];
  weakAreas: string[];
  nextSteps: string[];
  notes: string;
};

async function upsertConcept(payload: Record<string, any>): Promise<{ error: any }> {
  const supabase = createClient();
  // @ts-expect-error - Supabase client types vary
  return supabase
    .from('concepts')
    .upsert(payload, { onConflict: 'subject,concept' });
}

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: 'Request body must be valid JSON.' },
      { status: 400 },
    );
  }

  const subject = String(body?.subject ?? '').trim();
  const concept = String(body?.concept ?? '').trim();
  const masteryLevel = String(body?.masteryLevel ?? '').trim();
  const overviewGist = String(body?.overviewGist ?? '').trim();
  const deepDiveGist = Array.isArray(body?.deepDiveGist) ? body.deepDiveGist : [];
  const strongAreas = Array.isArray(body?.strongAreas) ? body.strongAreas : [];
  const weakAreas = Array.isArray(body?.weakAreas) ? body.weakAreas : [];
  const nextSteps = Array.isArray(body?.nextSteps) ? body.nextSteps : [];
  const notes = String(body?.notes ?? '').trim();

  if (!subject || !concept) {
    return NextResponse.json(
      { error: 'Missing required fields: subject and concept are required.' },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const payload = {
    subject,
    concept,
    mastery_level: masteryLevel,
    overview_gist: overviewGist,
    deep_dive_gist: deepDiveGist,
    strong_areas: strongAreas,
    weak_areas: weakAreas,
    next_steps: nextSteps,
    notes,
    last_updated: new Date().toISOString(),
  };

  const { error } = await upsertConcept(payload);

  if (error) {
    return NextResponse.json(
      { error: 'Failed to save concept to Supabase.', details: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
