
import React, { useState, useRef } from 'react';
import { editPropertyImage } from '../services/geminiService';

export const RenovationVisualizer: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImage(base64);
        setEditedImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEdit = async () => {
    if (!image || !prompt) return;
    setIsLoading(true);
    try {
      const base64Data = image.split(',')[1];
      const result = await editPropertyImage(base64Data, prompt);
      setEditedImage(result);
    } catch (e) {
      alert("Errore durante la generazione dell'immagine. Riprova.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white p-8 rounded-3xl shadow-soft border border-slate-100">
        <div className="text-center mb-10">
           <span className="inline-block p-3 rounded-2xl bg-violet-100 text-violet-600 text-2xl mb-4">✨</span>
           <h3 className="text-3xl font-bold text-slate-900 mb-3">AI Interior Designer</h3>
           <p className="text-slate-500 max-w-xl mx-auto text-lg">
             Carica una foto e trasforma l'ambiente istantaneamente. Prova stili diversi, materiali e colori.
           </p>
        </div>

        {!image ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="group border-3 border-dashed border-slate-200 rounded-3xl h-80 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-brand-300 transition-all duration-300"
          >
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-4xl mb-4 group-hover:scale-110 transition-transform text-slate-400 group-hover:text-brand-500 group-hover:bg-brand-50">📸</div>
            <span className="text-slate-900 font-bold text-lg">Carica una foto della stanza</span>
            <span className="text-slate-400 text-sm mt-1">JPG o PNG max 5MB</span>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />
          </div>
        ) : (
          <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <p className="font-bold text-slate-700">Originale</p>
                  <button 
                    onClick={() => { setImage(null); setEditedImage(null); }}
                    className="text-xs text-rose-500 font-bold hover:bg-rose-50 px-3 py-1 rounded-full transition-colors"
                  >
                    🗑️ Rimuovi
                  </button>
                </div>
                <div className="relative rounded-2xl overflow-hidden shadow-md border border-slate-200 aspect-[4/3] group">
                   <img src={image} alt="Original" className="w-full h-full object-cover" />
                </div>
              </div>
              
              <div className="space-y-3">
                <p className="font-bold text-slate-700">Risultato AI</p>
                <div className="relative rounded-2xl overflow-hidden shadow-md border border-slate-200 aspect-[4/3] bg-slate-50 flex items-center justify-center">
                  {isLoading ? (
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4"></div>
                      <span className="text-slate-400 font-medium animate-pulse">Generazione design...</span>
                    </div>
                  ) : editedImage ? (
                    <img src={editedImage} alt="Edited" className="w-full h-full object-cover animate-fade-in" />
                  ) : (
                    <div className="text-center text-slate-400 p-8">
                       <span className="block text-4xl mb-2 opacity-30">🎨</span>
                       L'immagine modificata apparirà qui
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex gap-4 items-center shadow-inner">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Es. Stile scandinavo, parquet chiaro, pareti verde salvia..."
                className="flex-1 bg-white border-0 rounded-xl px-5 py-4 focus:ring-2 focus:ring-brand-500 outline-none shadow-sm text-slate-900"
                onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
              />
              <button
                onClick={handleEdit}
                disabled={isLoading || !prompt}
                className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold hover:bg-brand-600 disabled:opacity-50 disabled:bg-slate-300 transition-all shadow-lg active:scale-95"
              >
                ✨ Genera
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
