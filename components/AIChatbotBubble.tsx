import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/dbService';
import { chatPropertyManagement } from '../services/geminiService';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface AIChatbotBubbleProps {
  owner1Name?: string;
  owner2Name?: string;
}

export const AIChatbotBubble: React.FC<AIChatbotBubbleProps> = ({
  owner1Name = 'Giuseppe',
  owner2Name = 'Claudia'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: `Ciao ${owner1Name} e ${owner2Name}! Sono il vostro assistente ImmoPlan. Posso aiutarvi a gestire i vostri immobili, analizzare la sostenibilità finanziaria dei vostri progetti o consigliarvi materiali e tecniche per le ristrutturazioni. Di cosa vogliamo parlare?`
    }
  ]);

  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 1 && prev[0].role === 'model') {
        return [{
          role: 'model',
          text: `Ciao ${owner1Name} e ${owner2Name}! Sono il vostro assistente ImmoPlan. Posso aiutarvi a gestire i vostri immobili, analizzare la sostenibilità finanziaria dei vostri progetti o consigliarvi materiali e tecniche per le ristrutturazioni. Di cosa vogliamo parlare?`
        }];
      }
      return prev;
    });
  }, [owner1Name, owner2Name]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickActions = [
    { label: "📊 Analisi Finanziaria", prompt: "Analizza la sostenibilità finanziaria del mio progetto e dammi consigli di ottimizzazione." },
    { label: "🛠️ Idee Ristrutturazione", prompt: "Quali sono le migliori idee di design e scelta materiali premium per la ristrutturazione del Loft?" },
    { label: "🏠 Rendimento Affitti", prompt: "Suggerimenti per massimizzare il rendimento del mio patrimonio e dei contratti attivi." }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', text: textToSend };
    setMessages(prev => [...prev, userMessage]);
    setInputVal('');
    setIsLoading(true);

    try {
      // 1. Fetch entire database state for AI Context
      await db.init();
      const [config, properties, scenarios, records, tenants, landlords] = await Promise.all([
        db.getAppData(),
        db.getProperties(),
        db.getScenarios(),
        db.getRentalRecords(),
        db.getTenants(),
        db.getLandlords()
      ]);

      const dbContent = {
        appConfig: config,
        properties: properties,
        scenarios: scenarios ? scenarios.map(s => ({ id: s.id, name: s.name, date: s.date })) : [],
        rentalRecords: records,
        tenants: tenants,
        landlords: landlords
      };

      // 2. Prepare message history for Gemini (excluding the initial welcome message if it's the model's first prompt or mapping properly)
      // Gemini expects role: 'user' | 'model' and parts: [{ text: string }]
      const updatedMessages = [...messages, userMessage];
      const apiHistory = updatedMessages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));

      // 3. Call AI API
      const reply = await chatPropertyManagement(apiHistory, dbContent);

      setMessages(prev => [...prev, { role: 'model', text: reply }]);
    } catch (e: any) {
      console.error("Chatbot Error:", e);
      setMessages(prev => [
        ...prev,
        { role: 'model', text: "Scusami, si è verificato un errore durante la connessione con l'AI. Verifica la connessione o l'API Key." }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatMessageText = (text: string) => {
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    
    // Parse bold text **word**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-800 dark:text-white">$1</strong>');
    
    // Parse bullet points
    html = html.replace(/^\s*-\s+(.*?)$/gm, '<li class="ml-4 list-disc my-1">$1</li>');
    
    // Parse line breaks
    html = html.replace(/\n/g, '<br/>');
    
    return html;
  };

  return (
    <div className="fixed z-[999] bottom-20 right-4 lg:bottom-8 lg:right-8 no-print">
      {/* Chat Window Panel */}
      {isOpen && (
        <div className="w-[360px] sm:w-[400px] h-[550px] bg-white border border-slate-200 shadow-2xl rounded-[2rem] flex flex-col mb-4 overflow-hidden animate-slide-in relative select-none">
          {/* Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#007cff] to-[#a855f7] flex items-center justify-center font-heading font-black text-xs shadow-md">AI</div>
              <div>
                <h4 className="font-heading font-extrabold text-xs">Assistente ImmoPlan</h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Online</span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"></line><line x1="6" x2="18" y1="6" y2="18"></line></svg>
            </button>
          </div>

          {/* Chat Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#f8fafc] dark:bg-slate-950/20 custom-scrollbar text-xs">
            {messages.map((msg, i) => {
              const isModel = msg.role === 'model';
              return (
                <div key={i} className={`flex ${isModel ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] p-3.5 rounded-2xl ${
                    isModel 
                      ? 'bg-white text-slate-700 shadow-sm border border-slate-100' 
                      : 'bg-brand-500 text-white shadow-soft-card'
                  }`}>
                    <div 
                      className="leading-relaxed whitespace-pre-line"
                      dangerouslySetInnerHTML={{ __html: formatMessageText(msg.text) }}
                    />
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions Panel */}
          {messages.length === 1 && (
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex flex-col gap-1.5">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Suggerimenti di conversazione</span>
              {quickActions.map((qa, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(qa.prompt)}
                  className="w-full text-left px-3 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-bold text-slate-600 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50/20 transition-all shadow-sm"
                >
                  {qa.label}
                </button>
              ))}
            </div>
          )}

          {/* Footer Input Area */}
          <div className="p-3 bg-white border-t border-slate-150 flex items-center gap-2">
            <input
              type="text"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder="Chiedi a ImmoPlan..."
              className="flex-1 bg-slate-50 border-0 rounded-xl px-4 py-3 text-xs font-semibold focus:ring-1 focus:ring-brand-500 outline-none text-slate-900"
              onKeyDown={e => e.key === 'Enter' && handleSend(inputVal)}
              disabled={isLoading}
            />
            <button
              onClick={() => handleSend(inputVal)}
              disabled={isLoading || !inputVal.trim()}
              className="p-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl shadow-md transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><line x1="22" x2="11" y1="2" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 bg-brand-500 hover:bg-brand-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-brand-500/20 transform hover:scale-105 transition-all cursor-pointer relative z-50 ${isOpen ? 'rotate-90' : 'animate-bounce-subtle'}`}
      >
        {isOpen ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><line x1="18" x2="6" y1="6" y2="18"></line><line x1="6" x2="18" y1="6" y2="18"></line></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        )}
      </button>

      {/* Custom micro-animations */}
      <style>{`
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 3s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};
