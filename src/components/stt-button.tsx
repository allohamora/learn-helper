import { type FC, type MouseEvent, useEffect, useEffectEvent, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SttButtonProps = {
  onText: (text: string) => void;
  disabled?: boolean;
  className?: string;
};

export const SttButton: FC<SttButtonProps> = ({ onText, disabled = false, className }) => {
  const [isListening, setIsListening] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const onTranscription = useEffectEvent(onText);

  useEffect(() => {
    if (typeof window === 'undefined') {
      console.error('Window is undefined in this environment.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error('Speech recognition API is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    const abortController = new AbortController();

    recognition.addEventListener(
      'start',
      () => {
        setIsListening(true);
      },
      { signal: abortController.signal },
    );

    recognition.addEventListener(
      'end',
      () => {
        setIsListening(false);
      },
      { signal: abortController.signal },
    );

    recognition.addEventListener(
      'result',
      (event) => {
        const transcript = event.results[0]?.[0]?.transcript;

        if (!transcript) {
          console.error('No transcript available from speech recognition result.', event);
        } else {
          onTranscription(transcript);
        }
      },
      { signal: abortController.signal },
    );

    recognition.addEventListener(
      'error',
      (event) => {
        console.error('Speech recognition error:', event.error ?? event.message ?? 'unknown error');
        setIsListening(false);
      },
      { signal: abortController.signal },
    );

    recognitionRef.current = recognition;

    return () => {
      abortController.abort();

      try {
        recognition.stop();
      } catch {
        // Ignored: recognition may already be stopped.
      }

      recognitionRef.current = null;
    };
  }, []);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!recognitionRef.current) {
      return;
    }

    try {
      if (isListening) {
        recognitionRef.current.stop();
      } else {
        recognitionRef.current.start();
      }
    } catch (error) {
      console.error('Unable to access microphone:', error);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleClick}
      disabled={disabled}
      className={cn(className)}
      aria-live="polite"
    >
      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </Button>
  );
};
