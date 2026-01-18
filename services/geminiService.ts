
import { GoogleGenAI } from "@google/genai";

// Analisi Scenario Finanziario - Complex Reasoning Task
export const analyzeFinancialScenario = async (context: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Analizza questo scenario finanziario immobiliare e fornisci consigli strategici dettagliati: ${context}`,
    config: {
      systemInstruction: "Sei un esperto consulente finanziario immobiliare senior. Fornisci analisi approfondite, evidenziando rischi di liquidità e opportunità di ottimizzazione fiscale o di mutuo. Usa il formato Markdown per la risposta.",
    },
  });

  return { text: response.text || "Impossibile generare l'analisi." };
};

// Ricerca Mercato con Grounding (Maps & Search)
export const getMarketInfo = async (query: string, lat?: number, lng?: number) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
  const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
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
