
import { useState, useEffect, useRef, useCallback } from 'react';

// Extend the global Window interface for the SpeechRecognition API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface SpeechRecognitionOptions {
    onTranscript: (transcript: string) => void;
    onEnd?: () => void;
}

export const useSpeechRecognition = ({ onTranscript, onEnd }: SpeechRecognitionOptions) => {
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Speech Recognition not supported by this browser.");
            setError("Гласовото разпознаване не се поддържа от този браузър.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false; // Set to false to capture a single utterance and prevent repetitions.
        recognition.interimResults = true;
        recognition.lang = 'bg-BG';

        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            // We can get multiple results, even with continuous=false.
            // Loop through them and concatenate the final ones.
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript) {
                onTranscript(finalTranscript.trim());
            }
        };

        recognition.onend = () => {
            setIsListening(false);
            if (onEnd) onEnd();
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event.error);
            // Avoid showing 'no-speech' error if user simply stops talking
            if (event.error !== 'no-speech') {
              setError(`Грешка при гласово разпознаване: ${event.error}`);
            }
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        
        return () => {
            recognitionRef.current?.abort();
        };
    }, [onTranscript, onEnd]);

    const startListening = useCallback(() => {
        if (recognitionRef.current && !isListening) {
            recognitionRef.current.start();
            setIsListening(true);
            setError(null);
        }
    }, [isListening]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
            // onend will handle setting isListening to false
        }
    }, [isListening]);
    
    const toggleListening = useCallback(() => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    }, [isListening, startListening, stopListening]);


    return {
        isListening,
        error,
        toggleListening,
        isSupported: !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    };
};
