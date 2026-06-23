import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';

const QUICK_TIPS = [
  "What's my biggest risk?",
  'Debt vs investing',
  'How to hit my goals faster',
  'Review my budget',
];

export default function AIAdvisor() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hello! I'm your **FinanceIQ** AI advisor. I can help you understand your finances, analyse your spending, and provide personalised advice. Ask me anything about your financial situation!" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [financialContext, setFinancialContext] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { loadFinancialContext(); }, []);

  useEffect(() => { scrollToBottom(); }, [messages, streamingMessage]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function loadFinancialContext() {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const [txRes, budgetRes, goalRes, assetRes] = await Promise.all([
        api.get(`/transactions?month=${currentMonth}`),
        api.get('/budgets'),
        api.get('/goals'),
        api.get('/networth')
      ]);
      setFinancialContext({ transactions: txRes.data, budgets: budgetRes.data, goals: goalRes.data, assets: assetRes.data });
    } catch (err) {
      console.error('Failed to load financial context:', err);
    }
  }

  async function handleSend(message) {
    const userMessage = message || input;
    if (!userMessage.trim() || loading) return;

    setInput('');
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setLoading(true);
    setStreamingMessage('');

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          financialContext
        })
      });

      if (!res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.content || "Sorry, I couldn't process that request." }]);
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) {
              setMessages(prev => [...prev, { role: 'assistant', content: fullContent }]);
              setStreamingMessage('');
            } else if (data.text) {
              fullContent += data.text;
              setStreamingMessage(fullContent);
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      console.error('AI chat error:', err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Simple markdown rendering
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8 h-[calc(100vh-80px)] lg:h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 animate-on-mount flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-purple)]/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-[var(--accent-purple)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-[var(--text-primary)]">FinanceIQ AI</h1>
            <Badge variant="purple" size="sm">Powered by Claude</Badge>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">Your personal financial intelligence assistant</p>
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-on-mount`}>
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
              {renderMessage(msg.content)}
            </div>
          </div>
        ))}

        {streamingMessage && (
          <div className="flex justify-start animate-on-mount">
            <div className="w-8 h-8 rounded-full bg-[var(--accent-purple)]/20 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
              <svg className="w-4 h-4 text-[var(--accent-purple)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm leading-relaxed rounded-tl-sm">
              {renderMessage(streamingMessage)}
            </div>
          </div>
        )}

        {loading && !streamingMessage && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full bg-[var(--accent-purple)]/20 flex items-center justify-center mr-2 flex-shrink-0">
              <svg className="w-4 h-4 text-[var(--accent-purple)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl px-4 py-3 rounded-tl-sm">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[var(--accent-purple)]" style={{ animation: 'dotPulse 1.4s infinite ease-in-out both', animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-[var(--accent-purple)]" style={{ animation: 'dotPulse 1.4s infinite ease-in-out both', animationDelay: '160ms' }} />
                <div className="w-2 h-2 rounded-full bg-[var(--accent-purple)]" style={{ animation: 'dotPulse 1.4s infinite ease-in-out both', animationDelay: '320ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick suggestions */}
      {messages.length <= 1 && (
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

      {/* Input */}
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
    </div>
  );
}