import NavBar from '../components/NavBar';
import { createClient } from '@/lib/supabase';
import Link from 'next/link';

const masteryScore: Record<string, number> = {
  Strong: 4,
  Proficient: 3,
  Developing: 2,
  Introduced: 1,
  'In Progress': 0,
};

const subjectClasses: Record<string, string> = {
  Physics: 'bg-blue-600/15 text-blue-200 ring-blue-500/30',
  Biology: 'bg-emerald-600/15 text-emerald-200 ring-emerald-500/30',
  Mathematics: 'bg-violet-600/15 text-violet-200 ring-violet-500/30',
  'Computer Science': 'bg-orange-600/15 text-orange-200 ring-orange-500/30',
  Chemistry: 'bg-red-600/15 text-red-200 ring-red-500/30',
};

const masteryBadgeClasses: Record<string, string> = {
  Strong: 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/20',
  Proficient: 'bg-sky-500/15 text-sky-200 ring-sky-500/20',
  Developing: 'bg-amber-500/15 text-amber-200 ring-amber-500/20',
  Introduced: 'bg-violet-500/15 text-violet-200 ring-violet-500/20',
  'In Progress': 'bg-slate-500/15 text-slate-200 ring-slate-500/20',
};

const formatArray = (value: unknown) => {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string') {
    return value
      .split(/,|\n|;/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const getSubjectPillClass = (subject: string) => {
  return subjectClasses[subject] || 'bg-slate-600/15 text-slate-200 ring-slate-500/20';
};

const getMasteryBadgeClass = (mastery: string) => {
  return masteryBadgeClasses[mastery] || masteryBadgeClasses['In Progress'];
};

export default async function DashboardPage() {
  const supabase = createClient();
  const { data, error } = await supabase.from('concepts').select('*');

  const concepts = Array.isArray(data) ? data : [];

  const totalConcepts = concepts.length;
  const uniqueSubjects = new Set(concepts.map((item) => String(item.subject || '')).filter(Boolean)).size;
  const totalScore = concepts.reduce((sum, item) => {
    const score = masteryScore[String(item.masteryLevel || item.mastery || 'In Progress')] ?? 0;
    return sum + score;
  }, 0);
  const averagePercent = totalConcepts ? Math.round((totalScore / (totalConcepts * 4)) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6 rounded-[2rem] border border-white/10 bg-slate-900/75 px-6 py-6 shadow-xl shadow-black/20 backdrop-blur-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Study Dashboard</p>
              <h1 className="mt-3 text-3xl font-semibold text-white">Your Concept Progress</h1>
            </div>
            <Link
              href="/"
              className="inline-flex items-center rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-700"
            >
              Back to Chat
            </Link>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Review your studied concepts, check your mastery metrics, and inspect strong and weak areas for every topic.
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-3 mb-8">
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-sm shadow-black/10">
            <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Total concepts</p>
            <p className="mt-4 text-4xl font-semibold text-white">{totalConcepts}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-sm shadow-black/10">
            <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Unique subjects</p>
            <p className="mt-4 text-4xl font-semibold text-white">{uniqueSubjects}</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-sm shadow-black/10">
            <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Average mastery</p>
            <p className="mt-4 text-4xl font-semibold text-white">{averagePercent}%</p>
          </div>
        </section>

        {error ? (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-100">
            Failed to load concepts: {error.message}
          </div>
        ) : null}

        <section className="grid gap-4">
          {concepts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/60 p-10 text-center text-slate-500">
              No concepts found yet. Use the chat page to save new concepts as you study.
            </div>
          ) : (
            concepts.map((concept, index) => {
              const subject = String(concept.subject || 'Unknown');
              const mastery = String(concept.masteryLevel || concept.mastery || 'In Progress');
              const score = masteryScore[mastery] ?? 0;
              const progress = Math.round((score / 4) * 100);
              const strongAreas = formatArray(concept.strongAreas || concept.strong_areas);
              const weakAreas = formatArray(concept.weakAreas || concept.weak_areas);
              const nextSteps = formatArray(concept.nextSteps || concept.next_steps);
              const updatedAt = formatDate(concept.updated_at || concept.updatedAt || concept.created_at || concept.createdAt);

              return (
                <details
                  key={`${subject}-${concept.concept}-${index}`}
                  className="group overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-900/80 shadow-sm shadow-black/20"
                >
                  <summary className="cursor-pointer px-6 py-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ring-1 ${getSubjectPillClass(subject)}`}>
                            {subject}
                          </span>
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ring-1 ${getMasteryBadgeClass(mastery)}`}>
                            {mastery}
                          </span>
                        </div>
                        <h2 className="text-xl font-semibold text-white">{concept.concept}</h2>
                        <div className="text-sm text-slate-400">Last updated: {updatedAt}</div>
                      </div>
                      <div className="flex min-w-[220px] flex-col gap-3 sm:items-end">
                        <div className="w-full space-y-2">
                          <div className="flex items-center justify-between text-sm text-slate-300">
                            <span>Progress</span>
                            <span>{progress}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white/5">
                            <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                        <div className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                          Expand for details
                        </div>
                      </div>
                    </div>
                  </summary>

                  <div className="border-t border-white/10 bg-slate-950/90 px-6 pb-6 pt-4">
                    <div className="grid gap-4 lg:grid-cols-3">
                      <div className="rounded-3xl bg-slate-900/80 p-4">
                        <p className="text-sm font-semibold text-white">Strong Areas</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {strongAreas.length > 0 ? (
                            strongAreas.map((area) => (
                              <span key={area} className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200 ring-1 ring-emerald-500/20">
                                {area}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-slate-500">No strong areas available</span>
                          )}
                        </div>
                      </div>
                      <div className="rounded-3xl bg-slate-900/80 p-4">
                        <p className="text-sm font-semibold text-white">Weak Areas</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {weakAreas.length > 0 ? (
                            weakAreas.map((area) => (
                              <span key={area} className="rounded-full bg-rose-500/10 px-3 py-1 text-xs text-rose-200 ring-1 ring-rose-500/20">
                                {area}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-slate-500">No weak areas available</span>
                          )}
                        </div>
                      </div>
                      <div className="rounded-3xl bg-slate-900/80 p-4">
                        <p className="text-sm font-semibold text-white">Next Steps</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {nextSteps.length > 0 ? (
                            nextSteps.map((step) => (
                              <span key={step} className="rounded-full bg-sky-500/10 px-3 py-1 text-xs text-sky-200 ring-1 ring-sky-500/20">
                                {step}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-slate-500">No next steps added</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </details>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}
