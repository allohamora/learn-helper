import { type FC, type MouseEvent } from 'react';
import { CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Volume2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { List, type WordToOptionsData } from '@/types/user-words.types';
import { ToOptions } from './to-options';

type WordToOptionsProps = {
  title: string;
  subtitle: string;
  data: WordToOptionsData;
  onMistake: (userWordId: number) => void;
  onNext: () => void;
};

export const WordToOptions: FC<WordToOptionsProps> = ({ data, ...props }) => {
  const { playAudio, isPlaying } = useAudioPlayer();

  const handlePlayPronunciation = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (data.pronunciation) playAudio(data.pronunciation);
  };

  return (
    <ToOptions data={data} {...props}>
      <div className="space-y-2 md:space-y-4">
        <div className="flex items-start justify-between">
          <CardTitle className="text-xl leading-tight font-bold md:text-3xl">
            {data.value}
            {data.spelling && (
              <span className="ml-2 text-base font-normal text-muted-foreground md:text-lg">({data.spelling})</span>
            )}
          </CardTitle>

          <div className="flex items-center gap-1">
            {data.pronunciation && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePlayPronunciation}
                disabled={isPlaying}
                className="h-8 w-8 shrink-0 p-0"
                title="Play pronunciation"
              >
                <Volume2 className={cn('h-4 w-4', { 'animate-pulse': isPlaying })} />
              </Button>
            )}

            {data.link && (
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-8 w-8 shrink-0 p-0"
                title="View in Oxford Dictionary"
              >
                <a href={data.link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {data.level}
          </Badge>
          {data.partOfSpeech && (
            <Badge variant="outline" className="text-xs">
              {data.partOfSpeech.toLowerCase()}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {data.list === List.Oxford5000Words ? 'oxford 5000' : 'phrase list'}
          </Badge>
        </div>
      </div>
    </ToOptions>
  );
};
