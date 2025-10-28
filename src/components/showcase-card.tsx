import { type FC, type MouseEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Volume2, ExternalLink, ArrowRight, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { List, type ShowcaseTask } from '@/types/user-words.types';

type ShowcaseCardProps = {
  onNext?: () => void;
  onPrev?: () => void;
  idx: number;
  data: ShowcaseTask['data'];
};

export const ShowcaseCard: FC<ShowcaseCardProps> = ({ onNext, onPrev, idx, data }) => {
  const { isPlaying, playAudio } = useAudioPlayer();

  const handlePlayPronunciation = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    playAudio(data.pronunciation);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 text-center md:mb-6">
        <h2 className="mb-2 text-lg font-semibold md:text-xl">Let&apos;s learn these words</h2>
        <p className="text-sm text-muted-foreground">Take a moment to familiarize yourself with each word</p>
      </div>

      <Card className="mb-4 flex min-h-64 flex-col gap-4 bg-card py-4 shadow-lg md:mb-6 md:min-h-[400px] md:gap-6 md:py-6">
        <CardHeader className="space-y-2 px-4 pb-4 md:px-6">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl leading-tight font-bold md:text-3xl">
                {data.value}
                {data.spelling && (
                  <span className="ml-2 text-base font-normal text-muted-foreground md:text-lg">({data.spelling})</span>
                )}
              </CardTitle>

              <div className="mt-1 text-sm text-muted-foreground">{data.uaTranslation}</div>
            </div>

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
        </CardHeader>

        <CardContent className="flex flex-1 items-center justify-center px-4 md:px-6">
          <div className="text-center">
            <p className="leading-relaxed text-foreground md:text-xl">{data.definition}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button onClick={onPrev} variant="outline" disabled={idx === 0} className="px-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>

        <Button onClick={onNext} className="px-6">
          Next
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
