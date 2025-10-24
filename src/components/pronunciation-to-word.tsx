import { type FC, type MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import type { PronunciationToWordTask } from '@/types/user-words.types';
import { ToWord } from './to-word';

type PronunciationToWordProps = {
  data: PronunciationToWordTask['data'];
  onMistake: (userWordId: number) => void;
  onNext: () => void;
};

export const PronunciationToWord: FC<PronunciationToWordProps> = ({ data: { pronunciation, ...data }, ...props }) => {
  const { playAudio, isPlaying } = useAudioPlayer();

  const handlePlayPronunciation = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    playAudio(pronunciation);
  };

  return (
    <ToWord
      title="Which word matches this pronunciation?"
      subtitle="Listen to the pronunciation and type the word you hear."
      data={data}
      {...props}
    >
      <Button
        variant="outline"
        size="lg"
        onClick={handlePlayPronunciation}
        disabled={isPlaying}
        className="h-24 w-24 rounded-full"
        title="Play pronunciation"
      >
        <Volume2 className={cn('h-8 w-8', { 'animate-pulse': isPlaying })} />
      </Button>
    </ToWord>
  );
};
