"use client";

import { useRef, useState } from 'react';
import NavBar from './components/NavBar';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  canSave?: boolean;
  saved?: boolean;
  saving?: boolean;
  detectedSubject?: string;
  detectedConcept?: string;
};

type DetectResponse = {
  subject: string;
  concept: string;
};

type SaveConceptPayload = {
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

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setError('');
    setInput('');

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    scrollToBottom();

    const detection = await detectConcept(trimmed);
    const assistantId = `assistant-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      text: '',
      canSave: Boolean(detection.subject && detection.concept),
      detectedSubject: detection.subject,
      detectedConcept: detection.concept,
    };

    setMessages((prev) => [...prev, assistantMessage]);
    setLoading(true);

    try {
      await streamChatResponse(trimmed, detection.subject, detection.concept, (delta) => {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, text: message.text + delta }
              : message,
          ),
        );
      });
    } catch (sendError) {
      const messageText =
        sendError instanceof Error
          ? sendError.message
          : 'Unable to get a response from the assistant.';
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId ? { ...message, text: messageText } : message,
        ),
      );
      setError('Failed to get a response. Try again.');
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const detectConcept = async (userMessage: string): Promise<DetectResponse> => {
    try {
      const res = await fetch('/api/detect-concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage }),
      });
      if (!res.ok) return { subject: '', concept: '' };
      const data = (await res.json()) as DetectResponse;
      return {
        subject: typeof data.subject === 'string' ? data.subject : '',
        concept: typeof data.concept === 'string' ? data.concept : '',
      };
    } catch {
      return { subject: '', concept: '' };
    }
  };

  const streamChatResponse = async (
    userMessage: string,
    subject: string,
    concept: string,
    onDelta: (chunk: string) => void,
  ) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userMessage, subject, concept }),
    });

    if (!res.ok || !res.body) {
      throw new Error('Chat API request failed.');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        onDelta(chunk);
        scrollToBottom();
      }
    }
  };

  const handleSave = async (message: Message) => {
    if (!message.detectedSubject || !message.detectedConcept) return;
    setMessages((prev) =>
      prev.map((item) =>
        item.id === message.id ? { ...item, saving: true } : item,
      ),
    );

    const payload = parseSavePayload(message.text, message.detectedSubject, message.detectedConcept);

    try {
      const res = await fetch('/api/save-concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Save failed');

      setMessages((prev) =>
        prev.map((item) =>
          item.id === message.id ? { ...item, saved: true, saving: false } : item,
        ),
      );
    } catch {
      setMessages((prev) =>
        prev.map((item) =>
          item.id === message.id ? { ...item, saving: false } : item,
        ),
      );
      setError('Unable to save progress.');
    }
  };

  const parseSavePayload = (
    assistantText: string,
    subject: string,
    concept: string,
  ): SaveConceptPayload => {
    const normalized = assistantText.replace(/\r/g, '');

    const tryJson = (): Partial<SaveConceptPayload> | null => {
      const start = normalized.indexOf('{');
      const end = normalized.lastIndexOf('}');
      if (start === -1 || end === -1 || end <= start) return null;
      try {
        const parsed = JSON.parse(normalized.slice(start, end + 1));
        return parsed;
      } catch {
        return null;
      }
    };

    type ParsedSavePayload = Partial<SaveConceptPayload> & {
      mastery_level?: string;
      overview_gist?: string;
      deep_dive_gist?: string[];
      strong_areas?: string[];
      weak_areas?: string[];
      next_steps?: string[];
    };

    const parsedJson = tryJson() as ParsedSavePayload;
    const listFromText = (label: string) => {
      const regex = new RegExp(`${label}\\s*[:\\-]?\\s*\\n([\\s\\S]*?)(?:\\n\\n|$)`, 'i');
      const match = normalized.match(regex);
      if (!match || !match[1]) return [];
      return match[1]
        .split(/\n|\r\n/)
        .map((line) => line.replace(/^\s*[-*\d\.\)\s]+/, '').trim())
        .filter(Boolean);
    };

    const firstParagraph = normalized.split(/\n\n/)[0]?.trim() ?? '';

    return {
      subject,
      concept,
      masteryLevel:
        parsedJson?.masteryLevel || parsedJson?.mastery_level || 'Developing',
      overviewGist: parsedJson?.overviewGist || parsedJson?.overview_gist || firstParagraph,
      deepDiveGist: parsedJson?.deepDiveGist || parsedJson?.deep_dive_gist || listFromText('Deep dive') || [],
      strongAreas: parsedJson?.strongAreas || parsedJson?.strong_areas || listFromText('Strong areas') || [],
      weakAreas: parsedJson?.weakAreas || parsedJson?.weak_areas || listFromText('Weak areas') || [],
      nextSteps: parsedJson?.nextSteps || parsedJson?.next_steps || listFromText('Next steps') || [],
      notes: assistantText,
    };
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <NavBar />
      <main className="mx-auto flex h-screen max-w-5xl flex-col px-4 py-6">
        <header className="mb-6 rounded-[2rem] border border-white/10 bg-slate-900/75 px-6 py-6 shadow-xl shadow-black/20 backdrop-blur-sm">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-500">AI Study Bot</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">Concept Chat</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Ask a study question, let the assistant respond, and save progress when the concept is detected.
          </p>
        </header>

        <section className="flex flex-1 flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 shadow-inner shadow-black/20">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
            {messages.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/60 p-10 text-center text-slate-500">
                Start the conversation by typing a study question below.
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[82%] rounded-3xl border px-5 py-4 text-sm leading-6 shadow-sm ${
                      message.role === 'user'
                        ? 'border-slate-700 bg-slate-800 text-slate-100'
                        : 'border-slate-800 bg-slate-950 text-slate-200'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <div className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                        Assistant
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{message.text || 'Thinking...'}</p>
                    {message.role === 'assistant' && message.canSave && (
                      <div className="mt-4 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => handleSave(message)}
                          disabled={message.saving || message.saved}
                          className="inline-flex items-center justify-center rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700"
                        >
                          {message.saved ? 'Saved' : message.saving ? 'Saving...' : 'Save progress'}
                        </button>
                        {message.detectedSubject && message.detectedConcept ? (
                          <span className="text-xs text-slate-500">
                            Detected: {message.detectedSubject} / {message.detectedConcept}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-white/10 bg-slate-950/90 px-6 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label htmlFor="user-input" className="sr-only">
                Type your question
              </label>
              <textarea
                id="user-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={2}
                placeholder="Ask a study question..."
                className="min-h-[88px] flex-1 resize-none rounded-3xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-100 shadow-inner shadow-black/20 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={loading}
                className="inline-flex h-12 shrink-0 items-center justify-center rounded-3xl bg-sky-500 px-6 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
            {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
          </div>
        </section>
      </main>
    </div>
  );
}
