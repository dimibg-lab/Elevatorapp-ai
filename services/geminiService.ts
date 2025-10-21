
import { GoogleGenAI } from "@google/genai";

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // Remove the data URL prefix e.g. "data:image/png;base64,"
            resolve(result.split(',')[1]);
        };
        reader.onerror = (error) => reject(error);
    });
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export interface StreamedChatResponse {
    textChunk?: string;
    sources?: { uri: string; title: string }[];
    isFinal: boolean;
}

export async function* getChatResponseStream(files: File[], question: string): AsyncGenerator<StreamedChatResponse> {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable is not set.");
    }
    
    const imageParts = await Promise.all(
      files.map(async (file) => {
        const base64Data = await fileToBase64(file);
        return {
          inlineData: {
            mimeType: file.type,
            data: base64Data,
          },
        };
      })
    );

    const prompt = `### РОЛЯ И ЦЕЛ ###
Ти си "AI Асансьорен Техник", експерт-асистент. Твоята задача е да предоставяш точна и полезна информация, свързана с асансьорна техника, като предлагаш конкретни решения на проблемите.

### ИНСТРУКЦИИ ЗА ИЗВЛИЧАНЕ НА ИНФОРМАЦИЯ ###
1.  **ПРИОРИТЕТ - ПРЕДОСТАВЕНИ ДОКУМЕНТИ:** Ако потребителят е качил файлове (схеми, ръководства, снимки), твоят отговор ТРЯВА да се базира **първо и основно** на информацията от тях.
2.  **ИНТЕРНЕТ ТЪРСЕНЕ:** Ако предоставените документи не съдържат отговора, или ако не са предоставени никакви документи, използвай своите възможности за търсене в интернет, за да намериш най-актуалната и релевантна информация.
3.  **ОБЩИ ПОЗНАНИЯ:** Можеш да допълваш отговорите си със своите общи познания, но винаги давай предимство на информацията от качените файлове и резултатите от търсенето.

### ИНСТРУКЦИИ ЗА ФОРМАТИРАНЕ И СЪДЪРЖАНИЕ ###
1.  **БЕЗОПАСНОСТТА НА ПЪРВО МЯСТО:** ВИНАГИ, когато отговорът ти включва инструкции за ремонт, диагностика или работа с компоненти, започвай с ясно видимо предупреждение за безопасност. Например: "⚠️ **ВНИМАНИЕ: Преди започване на каквато и да е работа, уверете се, че асансьорът е напълно обезопасен, изключен от главното захранване и са спазени всички процедури за безопасност!**"
2.  **ПРЕДЛАГАНЕ НА РЕШЕНИЯ:** Твоята цел е да бъдеш полезен асистент. Вместо просто да препоръчваш "извикайте квалифициран техник", твоята задача е да предоставиш **конкретни стъпки за диагностика, възможни причини за проблема и потенциални решения**, които потребителят може да разгледа. Целта е да дадеш възможност на потребителя да разбере проблема в дълбочина, дори ако крайната стъпка е намеса от специалист.
3.  **ЯСНА СТРУКТУРА:** Използвай Markdown (заглавия, списъци, удебелен текст), за да направиш отговора си лесен за четене и разбиране.
4.  **ЛИПСВАЩА ИНФОРМАЦИЯ:** Ако не можеш да намериш отговор нито в документите, нито в интернет, ясно заяви това, вместо да предполагаш.

### ПОТРЕБИТЕЛСКИ ВЪПРОС ###
"${question}"`;

    const textPart = {
        text: prompt
    };

    try {
        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [...imageParts, textPart] }],
            config: {
                tools: [{googleSearch: {}}],
            },
        });

        const uniqueSources = new Map<string, { uri: string; title: string }>();

        for await (const chunk of responseStream) {
            if (chunk.text) {
                yield { textChunk: chunk.text, isFinal: false };
            }

            const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
            groundingChunks.forEach(gChunk => {
                if (gChunk.web && gChunk.web.uri && !uniqueSources.has(gChunk.web.uri)) {
                    uniqueSources.set(gChunk.web.uri, {
                        uri: gChunk.web.uri,
                        title: gChunk.web.title || gChunk.web.uri
                    });
                }
            });
        }
        
        yield { sources: Array.from(uniqueSources.values()), isFinal: true };

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Неуспешно свързване с AI услугата.");
    }
};
