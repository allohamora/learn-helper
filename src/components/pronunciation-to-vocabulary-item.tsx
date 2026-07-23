import { type FC, type MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import type { UserVocabularyItemTaskType } from '@/const/event';
import type { PronunciationToVocabularyItemTask } from '@/types/learn';
import { ToVocabularyItem } from './to-vocabulary-item';

type PronunciationToVocabularyItemProps = {
  data: PronunciationToVocabularyItemTask['data'];
  userVocabularyListId: string;
  taskType: UserVocabularyItemTaskType;
  onMistake: (userVocabularyItemId: string) => void;
  onNext: () => void;
};

export const PronunciationToVocabularyItem: FC<PronunciationToVocabularyItemProps> = ({
  data: { pronunciation, spelling, ...data },
  ...props
}) => {
  const { playAudio, isPlaying } = useAudioPlayer();

  const handlePlayPronunciation = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (pronunciation) void playAudio(pronunciation);
  };

  const hasPronunciation = !!pronunciation;

  return (
    <ToVocabularyItem
      title={hasPronunciation ? 'Which item matches this pronunciation?' : 'Which item matches this spelling?'}
      subtitle={
        hasPronunciation
          ? 'Listen to the pronunciation and type the item you hear.'
          : 'Use the phonetic spelling to type the correct item.'
      }
      data={data}
      {...props}
    >
      <div className="flex flex-col items-center gap-4">
        {hasPronunciation ? (
          <>
            <Button
              variant="outline"
              size="lg"
              onClick={handlePlayPronunciation}
              disabled={isPlaying}
              className="size-20 rounded-full md:size-24"
              title="Play pronunciation"
              aria-label="Play pronunciation"
            >
              <Volume2 className={cn('size-6 md:size-8', { 'animate-pulse': isPlaying })} />
            </Button>

            <details className="w-full max-w-xs text-center text-sm text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground select-none">Show spelling</summary>
              <p className="mt-2 text-lg font-semibold text-foreground">{spelling}</p>
            </details>
          </>
        ) : (
          <p className="text-xl font-semibold text-foreground md:text-2xl">{spelling}</p>
        )}
      </div>
    </ToVocabularyItem>
  );
};
