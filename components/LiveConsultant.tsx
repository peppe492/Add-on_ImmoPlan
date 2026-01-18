

import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { decode, encode, decodeAudioData } from '../services/geminiService';

export const LiveConsultant: React.FC<{ dataContext: string }> = ({ dataContext }) => {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('Pronto a parlare');
  const inputAudioCtx = useRef<AudioContext | null>(null);
  const outputAudioCtx = useRef<AudioContext | null>(null);
  const nextStartTime = useRef(0);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const sources = useRef<Set<AudioBufferSourceNode>>(new Set());

  const createPCMContent = (data: Float32Array) => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = data[i] * 32768;
    }
    return {
      data: encode(new Uint8Array(int16.buffer)),
      mimeType: 'audio/pcm;rate=16000',
    };
  };

  const startSession = async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    inputAudioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    outputAudioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Fixed model name according to guidelines: gemini-2.5-flash-native-audio-preview-12-2025
    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: `Sei l'assistente vocale di ImmoPlan AI. Aiuta Giuseppe e Claudia con i loro dubbi immobiliari. Sii cordiale e professionale. Dati correnti del loro progetto: ${dataContext}`,
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
      },
      callbacks: {
        onopen: () => {
          setIsActive(true);
          setStatus('In ascolto...');
          
          const source = inputAudioCtx.current!.createMediaStreamSource(stream);
          const processor = inputAudioCtx.current!.createScriptProcessor(4096, 1, 1);
          
          processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmBlob = createPCMContent(inputData);
            // CRITICAL: Use sessionPromise to ensure data is sent to the resolved session
            sessionPromise.then((session) => {
              session.sendRealtimeInput({ media: pcmBlob });
            });
          };
          
          source.connect(processor);
          processor.connect(inputAudioCtx.current!.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          const audioBase64 = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audioBase64 && outputAudioCtx.current) {
            nextStartTime.current = Math.max(nextStartTime.current, outputAudioCtx.current.currentTime);
            
            const audioBuffer = await decodeAudioData(
              decode(audioBase64),
              outputAudioCtx.current,
              24000,
              1
            );
            
            const source = outputAudioCtx.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioCtx.current.destination);
            
            source.addEventListener('ended', () => {
              sources.current.delete(source);
            });
            
            source.start(nextStartTime.current);
            nextStartTime.current += audioBuffer.duration;
            sources.current.add(source);
          }

          if (message.serverContent?.interrupted) {
            for (const source of sources.current) {
              try { source.stop(); } catch (e) {}
              sources.current.delete(source);
            }
            nextStartTime.current = 0;
          }
        },
        onclose: () => {
          setIsActive(false);
          setStatus('Sessione chiusa');
        },
        onerror: (e) => {
          console.error("Live Error:", e);
          setStatus('Errore di connessione');
        }
      }
    });

    sessionPromiseRef.current = sessionPromise;
  };

  const stopSession = async () => {
    if (sessionPromiseRef.current) {
      const session = await sessionPromiseRef.current;
      session.close();
    }
    window.location.reload(); // Simple way to cleanup everything
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-3xl shadow-soft border border-slate-100 p-8">
      <div className={`w-32 h-32 rounded-full flex items-center justify-center text-4xl mb-8 transition-all duration-500 ${isActive ? 'bg-brand-500 text-white scale-110 shadow-glow' : 'bg-slate-100 text-slate-400'}`}>
        {isActive ? '🎙️' : '💤'}
      </div>
      <h3 className="text-2xl font-bold text-slate-900 mb-2">Assistente Vocale Live</h3>
      <p className="text-slate-500 mb-8">{status}</p>
      
      {!isActive ? (
        <button onClick={startSession} className="bg-brand-600 text-white px-10 py-4 rounded-2xl font-bold shadow-lg hover:bg-brand-700 transition-all">
          Attiva Microfono
        </button>
      ) : (
        <button onClick={stopSession} className="bg-rose-500 text-white px-10 py-4 rounded-2xl font-bold shadow-lg hover:bg-rose-600 transition-all">
          Termina Chiamata
        </button>
      )}
    </div>
  );
};
