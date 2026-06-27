import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';
import Badge from '../components/ui/Badge';

// ─── Quick suggestion chips ──────────────────────────────────────────────────
const QUICK_TIPS = [
  "What's my biggest risk?",
  'Debt vs investing',
  'How to hit my goals faster',
  'Review my budget',
];

// ─── Simple markdown renderer (bold only) ────────────────────────────────────
function renderMessage(content) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    return part.split('\n').map((line, j) => (
      <React.Fragment key={`${i}-${j}`}>
        {j > 0 && <br />}
        {line}
      </React.Fragment>
    ));
  });
}

// ─── Typing indicator dots ───────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex gap-1.5 px-1 py-2">
      {[0, 160, 320].map(delay => (
        <div
          key={delay}
          className="w-2 h-2 rounded-full bg-[var(--accent-purple)]"
          style={{
            animation: 'bounceDot 1.4s infinite ease-in-out both',
            animationDelay: `${delay}ms`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AIAdvisor() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        "Hello! I'm your **FinanceIQ** AI advisor. I can help you understand your finances, analyse your spending, and provide personalised advice. Ask me anything about your financial situation!",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [financialContext, setFinancialContext] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load financial context once on mount
  useEffect(() => {
    loadFinancialContext();
  }, []);

  // Auto-scroll whenever messages or the streaming content changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadFinancialContext() {
    try {
      const month = new Date().toISOString().slice(0, 7);
      const [txRes, budgetRes, goalRes, assetRes] = await Promise.all([
        api.get(`/transactions?month=${month}`),
        api.get('/budgets'),
        api.get('/goals'),
        api.get('/networth'),
      ]);
      setFinancialContext({
        transactions: txRes.data,
        budgets: budgetRes.data,
        goals: goalRes.data,
        assets: assetRes.data,
      });
    } catch (err) {
      console.error('Failed to load financial context:', err);
    }
  }

  // ── handleSend — streaming SSE fetch ────────────────────────────────────────
  const handleSend = useCallback(
    async (message) => {
      const userMessage = message || input;
      if (!userMessage.trim() || loading) return;

      setInput('');

      // Append the user message immediately, then insert a placeholder
      // assistant message that will later be filled in with streamed text.
      const userTurn = { role: 'user', content: userMessage };
      const placeholder = { role: 'assistant', content: '', streaming: true };

      setMessages((prev) => [...prev, userTurn, placeholder]);
      setLoading(true);

      // Build the message array for the API (exclude the placeholder)
      const apiMessages = [...messages, userTurn].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            messages: apiMessages,
            financialContext,
          }),
        });

        // Non-2xx responses — read the JSON error body
        if (!res.ok) {
          let errorMsg = "Sorry, I couldn't process that request.";
          try {
            const data = await res.json();
            if (data.error) errorMsg = data.error;
          } catch { /* ignore parse failure */ }

          // Replace placeholder with the error message
          setMessages((prev) => {
            const copy = [...prev];
            const idx = copy.length - 1;
            if (idx >= 0) copy[idx] = { role: 'assistant', content: errorMsg, streaming: false };
            return copy;
          });
          setLoading(false);
          return;
        }

        // ── Stream the response body ──────────────────────────────────────────
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          // Keep the (potentially incomplete) last line in the buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;

            try {
              const data = JSON.parse(trimmed.slice(6));

              if (data.error) {
                // Server-side error event during streaming
                setMessages((prev) => {
                  const copy = [...prev];
                  const idx = copy.length - 1;
                  if (idx >= 0)
                    copy[idx] = {
                      role: 'assistant',
                      content: data.error,
                      streaming: false,
                    };
                  return copy;
                });
                setLoading(false);
                return;
              }

              if (data.done) {
                // Mark the placeholder as complete
                setMessages((prev) => {
                  const copy = [...prev];
                  const idx = copy.length - 1;
                  if (idx >= 0)
                    copy[idx] = {
                      role: 'assistant',
                      content: fullContent,
                      streaming: false,
                    };
                  return copy;
                });
              } else if (data.text) {
                fullContent += data.text;
                // Update placeholder progressively
                setMessages((prev) => {
                  const copy = [...prev];
                  const idx = copy.length - 1;
                  if (idx >= 0)
                    copy[idx] = {
                      role: 'assistant',
                      content: fullContent,
                      streaming: true,
                    };
                  return copy;
                });
              }
            } catch {
              // JSON parse failure — skip malformed line
            }
          }
        }

        // Ensure the placeholder is finalised even if no done event arrived
        setMessages((prev) => {
          const copy = [...prev];
          const idx = copy.length - 1;
          if (idx >= 0 && copy[idx]?.streaming) {
            copy[idx] = { role: 'assistant', content: fullContent, streaming: false };
          }
          return copy;
        });
      } catch (err) {
        console.error('AI chat error:', err);
        setMessages((prev) => {
          const copy = [...prev];
          const idx = copy.length - 1;
          if (idx >= 0)
            copy[idx] = {
              role: 'assistant',
              content: 'Sorry, I encountered a network error. Please try again.',
              streaming: false,
            };
          return copy;
        });
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, financialContext]
  );

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const hasUserSentMessage = messages.length > 1;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8 h-[calc(100vh-80px)] lg:h-screen flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4 animate-on-mount flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-purple)]/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-[var(--accent-purple)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-[var(--text-primary)]">FinanceIQ AI</h1>
            <Badge variant="purple" size="sm">Powered by Groq</Badge>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">Your personal financial intelligence assistant</p>
        </div>
      </div>

      {/* ── Chat messages ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-on-mount`}>
            {/* AI avatar */}
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-[var(--accent-purple)]/20 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                <svg className="w-4 h-4 text-[var(--accent-purple)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[var(--accent-blue)] text-white rounded-tr-sm'
                  : 'bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] rounded-tl-sm'
              }`}
            >
              {/* Show typing dots while the assistant response is still empty and streaming */}
              {msg.role === 'assistant' && msg.streaming && msg.content === '' ? (
                <TypingDots />
              ) : (
                renderMessage(msg.content)
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Quick suggestion chips — hide after first message ────────────── */}
      {!hasUserSentMessage && (
        <div className="mb-3 flex-shrink-0">
          <p className="text-xs text-[var(--text-secondary)] mb-2">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_TIPS.map((tip, i) => (
              <button
                key={i}
                onClick={() => handleSend(tip)}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)] transition-all"
              >
                {tip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input bar ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 safe-bottom">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your finances..."
            disabled={loading}
            className="w-full pl-5 pr-14 py-3.5 rounded-2xl bg-[var(--bg-tertiary)] border-2 border-transparent focus:border-[var(--accent-purple)] text-[var(--text-primary)] text-sm outline-none transition-all duration-200 placeholder:text-[var(--text-secondary)] placeholder:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-[var(--accent-purple)] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all"
            aria-label="Send message"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Keyframe for bouncing dots ──────────────────────────────────── */}
      <style>{`
        @keyframes bounceDot {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}