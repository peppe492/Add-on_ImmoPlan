
import React, { useState } from 'react';
import { generateRenovationVideo } from '../services/geminiService';

export const VideoGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handleGenerate = async () => {
    if (!prompt) return;
    setIsLoading(true);
    setStatus('Inizio generazione video...');
    try {
      // Check for API key selection
      const aistudio = (window as any).aistudio;
      if (aistudio && !(await aistudio.hasSelectedApiKey())) {
        await aistudio.openSelectKey();
        // GUIDELINE: Assume the key selection was successful after triggering openSelectKey() and proceed
      }
      
      const url = await generateRenovationVideo(prompt);
      setVideoUrl(url);
    } catch (e: any) {
      console.error(e);
      if (e?.message?.includes("Requested entity was not found.")) {
        // Reset key state if billing/key issue
        await (window as any).aistudio.openSelectKey();
      }
      alert("Errore nella generazione del video. Verifica la tua API Key (Billing richiesto su un progetto GCP a pagamento).");
    } finally {
      setIsLoading(false);
      setStatus('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 rounded-3xl shadow-soft border border-slate-100">
      <div className="text-center mb-8">
        <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto text-slate-650 dark:text-slate-350"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect width="20" height="12" x="2" y="6" rx="2"/><path d="m22 10-6 4V10l6 4Z"/></svg></div>
        <h3 className="text-2xl font-bold text-slate-900 mt-4">Veo Video Walkthrough</h3>
        <p className="text-slate-500 mt-2">Crea un tour virtuale della tua futura casa.</p>
      </div>

      <div className="space-y-6">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Es: Un volo di droni attraverso un open space moderno con parquet in rovere, grandi vetrate e una cucina ad isola minimalista..."
          className="w-full h-32 bg-slate-50 border border-slate-200 rounded-2xl p-4 focus:ring-2 focus:ring-brand-500 outline-none"
        />
        
        <button
          onClick={handleGenerate}
          disabled={isLoading || !prompt}
          className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-brand-600 disabled:opacity-50 transition-all shadow-xl"
        >
          {isLoading ? 'Generazione in corso (attendi ~1 min)...' : 'Genera Video Cinematografico'}
        </button>

        {isLoading && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
            <p className="text-brand-600 font-medium animate-pulse">{status}</p>
          </div>
        )}

        {videoUrl && (
          <div className="rounded-2xl overflow-hidden shadow-2xl border border-slate-200 aspect-video bg-black">
            <video src={videoUrl} controls className="w-full h-full" autoPlay loop />
          </div>
        )}
      </div>
      
      <div className="mt-8 p-4 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700">
        Nota: La generazione video richiede una API Key associata a un account di fatturazione (Billing) su Google Cloud (GCP). 
        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline ml-1 font-bold">Info Billing</a>
      </div>
    </div>
  );
};
