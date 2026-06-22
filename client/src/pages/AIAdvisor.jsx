import React, { useState, useEffect, useRef } from 'react';
import api from '../api';

const QUICK_TIPS = [
  'What is my biggest financial risk?',
  'Should I pay off debt or invest?',
  'How can I reach financial independence?',
  'Review my budget',
  'How am I doing this month compared to last?',
  'What can I cut back on?',
];

export default function AIAdvisor() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I\'m your FinanceIQ AI advisor. I can help you understand your finances, analyse your spending, and provide personalised advice. Ask me anything about your financial situation!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [financialContext, setFinancialContext] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadFinancialContext();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

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
      setFinancialContext({
        transactions: txRes.data,
        budgets: budgetRes.data,
        goals: goalRes.data,
        assets: assetRes.data
      });
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
        // Non-streaming fallback
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.content || 'Sorry, I couldn\'t process that request.' }]);
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
          } catch {
            // Skip invalid JSON
          }
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center space-x-2 mb-6">
        <span className="text-2xl">🤖</span>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Advisor</h1>
          <p className="text-sm text-gray-500">Your personal financial intelligence assistant</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Chat Messages */}
        <div className="h-[500px] overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {streamingMessage && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-gray-100 text-gray-800 rounded-bl-sm">
                <p className="text-sm whitespace-pre-wrap">{streamingMessage}</p>
              </div>
            </div>
          )}

          {loading && !streamingMessage && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-4 py-3 rounded-bl-sm">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Tips */}
        {messages.length <= 1 && (
          <div className="px-4 pb-4">
            <p className="text-xs text-gray-500 mb-2">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_TIPS.map((tip, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(tip)}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                >
                  {tip}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex space-x-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your finances..."
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              disabled={loading}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}