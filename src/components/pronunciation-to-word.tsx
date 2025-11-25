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
      <div className="flex flex-col items-center gap-4">
        <Button
          variant="outline"
          size="lg"
          onClick={handlePlayPronunciation}
          disabled={isPlaying}
          className="h-20 w-20 rounded-full md:h-24 md:w-24"
          title="Play pronunciation"
        >
          <Volume2 className={cn('h-6 w-6 md:h-8 md:w-8', { 'animate-pulse': isPlaying })} />
        </Button>

        <details className="w-full max-w-xs text-center text-sm text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground select-none">Show spelling</summary>
          <p className="mt-2 text-lg font-semibold text-foreground">{data.spelling}</p>
        </details>
      </div>
    </ToWord>
  );
};
