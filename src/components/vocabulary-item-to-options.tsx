import { type FC, type MouseEvent } from 'react';
import { CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Volume2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import type { UserVocabularyItemTaskType } from '@/const/event';
import type { VocabularyItemToOptionsData } from '@/types/learn';
import { ToOptions } from './to-options';

type VocabularyItemToOptionsProps = {
  title: string;
  subtitle: string;
  userVocabularyListId: string;
  taskType: UserVocabularyItemTaskType;
  data: VocabularyItemToOptionsData;
  onMistake: (userVocabularyItemId: string) => void;
  onNext: () => void;
};

export const VocabularyItemToOptions: FC<VocabularyItemToOptionsProps> = ({ data, ...props }) => {
  const { playAudio, isPlaying } = useAudioPlayer();

  const handlePlayPronunciation = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (data.pronunciation) void playAudio(data.pronunciation);
  };

  return (
    <ToOptions data={data} {...props}>
      <div className="space-y-2 md:space-y-4">
        <div className="flex items-start justify-between">
          <CardTitle className="text-xl/tight font-bold md:text-3xl">
            {data.value}
            <div className="text-base font-normal text-muted-foreground md:text-lg">({data.spelling})</div>
          </CardTitle>

          <div className="flex items-center gap-1">
            {data.pronunciation && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePlayPronunciation}
                disabled={isPlaying}
                className="size-8 shrink-0 p-0"
                title="Play pronunciation"
              >
                <Volume2 className={cn('size-4', { 'animate-pulse': isPlaying })} />
              </Button>
            )}
            {data.link && (
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="size-8 shrink-0 p-0"
                title="View in Oxford Dictionary"
              >
                <a href={data.link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            )}
          </div>
        </div>

        {data.partOfSpeech && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {data.partOfSpeech.toLowerCase()}
            </Badge>
          </div>
        )}
      </div>
    </ToOptions>
  );
};
