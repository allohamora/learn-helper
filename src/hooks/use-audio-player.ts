import { useState } from 'react';

export const useAudioPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);

  const playAudio = async (audioUrl: string) => {
    if (isPlaying || !audioUrl) {
      return;
    }

    setIsPlaying(true);

    try {
      const audio = new Audio();
      audio.src = audioUrl;

      const cleanup = (event: Event) => {
        if (event.type === 'error') {
          console.error('Audio error:', event);
        }

        setIsPlaying(false);

        audio.removeEventListener('ended', cleanup);
        audio.removeEventListener('error', cleanup);
      };

      audio.addEventListener('ended', cleanup);
      audio.addEventListener('error', cleanup);

      await audio.play();
    } catch (error) {
      console.error('Failed to play pronunciation audio:', error);
      setIsPlaying(false);
    }
  };

  return { isPlaying, playAudio };
};
