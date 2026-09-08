
import { GoogleGenAI } from "@google/genai";
import { db } from "./dbService";

export const getApiKey = async (): Promise<string> => {
  if (typeof window !== 'undefined') {
    const localKey = localStorage.getItem('immoplan_api_key');
    if (localKey) return localKey;
  }
  try {
    const config = await db.getAppData();
    if (config?.apiKey) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('immoplan_api_key', config.apiKey);
      }
      return config.apiKey;
    }
  } catch (e) {
    // Ignore IndexedDB error
  }
  try {
    if (typeof window !== 'undefined' && (window as any).process?.env?.API_KEY) {
      return (window as any).process.env.API_KEY;
    }
  } catch (e) {}
  try {
    if (typeof process !== 'undefined' && process.env?.API_KEY) {
      return process.env.API_KEY;
    }
  } catch (e) {}
  return '';
};

export const sanitizeDbContent = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeDbContent(item));
  }
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        if (key === 'data' && typeof obj[key] === 'string' && (obj[key].startsWith('data:') || obj[key].length > 100)) {
          newObj[key] = `[Base64 Data Omitted - size: ${(obj[key].length / 1024).toFixed(1)} KB]`;
        } else {
          newObj[key] = sanitizeDbContent(obj[key]);
        }
      }
    }
    return newObj;
  }
  return obj;
};

// Analisi Scenario Finanziario - Complex Reasoning Task
export const analyzeFinancialScenario = async (context: string) => {
  const apiKey = await getApiKey();
  const ai = new GoogleGenAI({ apiKey });
  
  let sanitizedContext = context;
  try {
    const parsed = JSON.parse(context);
    sanitizedContext = JSON.stringify(sanitizeDbContent(parsed), null, 2);
  } catch (e) {}

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Analizza questo scenario finanziario immobiliare e fornisci consigli strategici dettagliati: ${sanitizedContext}`,
    config: {
      systemInstruction: "Sei un esperto consulente finanziario immobiliare senior. Fornisci analisi approfondite, evidenziando rischi di liquidità e opportunità di ottimizzazione fiscale o di mutuo. Usa il formato Markdown per la risposta.",
    },
  });

  return { text: response.text || "Impossibile generare l'analisi." };
};

// Ricerca Mercato con Grounding (Maps & Search)
export const getMarketInfo = async (query: string, lat?: number, lng?: number) => {
  const apiKey = await getApiKey();
  const ai = new GoogleGenAI({ apiKey });
  // Maps grounding is only supported in Gemini 2.5 series models.
  const model = "gemini-2.5-flash";
  
  const config: any = {
    tools: [{ googleSearch: {} }, { googleMaps: {} }],
  };

  if (lat && lng) {
    config.toolConfig = {
      retrievalConfig: { latLng: { latitude: lat, longitude: lng } }
    };
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: query,
      config,
    });

    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => {
        if (chunk.web) return { uri: chunk.web.uri, title: chunk.web.title };
        if (chunk.maps) return { uri: chunk.maps.uri, title: chunk.maps.title };
        return null;
      }).filter((s: any) => s !== null) || [];

    return { text: response.text || "", sources };
  } catch (error) {
    console.error("Gemini Search/Maps Error:", error);
    throw error;
  }
};

// Editing Immagine con AI
export const editPropertyImage = async (base64ImageData: string, prompt: string) => {
  const apiKey = await getApiKey();
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          inlineData: {
            data: base64ImageData,
            mimeType: 'image/jpeg',
          },
        },
        {
          text: `Modifica questa stanza seguendo queste istruzioni: ${prompt}. Mantieni la struttura architettonica ma cambia arredi, finiture e illuminazione.`,
        },
      ],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Nessuna immagine generata dal modello.");
};

// Fixed error: Added generateRenovationVideo as expected by components/VideoGenerator.tsx
export const generateRenovationVideo = async (prompt: string) => {
  const apiKey = await getApiKey();
  const ai = new GoogleGenAI({ apiKey });
  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({operation: operation});
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  // Append API key when fetching from the download link as per guidelines
  const response = await fetch(`${downloadLink}&key=${apiKey}`);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

// Fixed error: Added decode as expected by components/LiveConsultant.tsx
export function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Fixed error: Added decodeAudioData as expected by components/LiveConsultant.tsx
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Fixed error: Added encode as expected by components/LiveConsultant.tsx
export function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export const chatPropertyManagement = async (
  messageHistory: { role: 'user' | 'model'; parts: { text: string }[] }[],
  dbContent: any
) => {
  const apiKey = dbContent?.appConfig?.apiKey || await getApiKey();
  const ai = new GoogleGenAI({ apiKey });
  
  const sanitizedDbContent = sanitizeDbContent(dbContent);
  const owner1 = dbContent?.appConfig?.owner1Name || 'Giuseppe';
  const owner2 = dbContent?.appConfig?.owner2Name || 'Claudia';
  
  const systemInstruction = `
Sei l'assistente virtuale intelligente di ImmoPlan, un property manager esperto e consulente specialistico in ristrutturazioni edilizie ed estimo immobiliare.
Il tuo obiettivo è assistere l'utente (${owner1} e ${owner2}) nella gestione del loro patrimonio immobiliare e nei loro progetti di acquisto e ristrutturazione.

Dati correnti del patrimonio e dei progetti dell'utente:
${JSON.stringify(sanitizedDbContent, null, 2)}

Regole di comportamento:
1. Sii estremamente professionale, chiaro, cordiale ed executive (stile SaaS di alto livello).
2. Fornisci risposte basate sui dati reali del patrimonio dell'utente quando ti fa domande specifiche (es. "Quali sono i miei conti?", "Quanto ho speso?", "Il mio progetto è sostenibile?").
3. Quando ti chiede consigli su ristrutturazioni, materiali, design, layout o stime di costi, agisci come un consulente tecnico esperto: suggerisci materiali (es. grès porcellanato, parquet Rovere, resine), consiglia soluzioni di ottimizzazione degli spazi, illuminazione, efficienza energetica, e fornisci stime realistiche se richieste.
4. Rispondi sempre in italiano, usando la formattazione Markdown (grassetto, liste, tabelle se utili) per rendere le risposte estremamente leggibili e strutturate.
5. Mantieni le risposte concise ma esaurienti, evitando spiegazioni inutilmente prolisse.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: messageHistory,
    config: {
      systemInstruction: systemInstruction,
    },
  });

  return response.text || "Impossibile generare la risposta.";
};

