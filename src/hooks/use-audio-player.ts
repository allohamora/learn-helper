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

      const cleanup = () => {
        setIsPlaying(false);

        audio.removeEventListener('ended', cleanup);
        audio.removeEventListener('error', cleanup);
      };

      audio.addEventListener('ended', cleanup);
      audio.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        cleanup();
      });

      await audio.play();
    } catch (error) {
      console.error('Failed to play pronunciation audio:', error);
      setIsPlaying(false);
    }
  };

  return { isPlaying, playAudio };
};
