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
      <div className="mb-6 text-center">
        <h2 className="mb-2 text-xl font-semibold">Let&apos;s learn these words</h2>
        <p className="text-muted-foreground">Take a moment to familiarize yourself with each word</p>
      </div>

      <Card className="mb-6 flex min-h-[400px] flex-col bg-card shadow-lg">
        <CardHeader className="space-y-2 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-3xl leading-tight font-bold">
                {data.value}
                {data.spelling && (
                  <span className="ml-2 text-lg font-normal text-muted-foreground">({data.spelling})</span>
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

        <CardContent className="flex flex-1 items-center justify-center pt-4">
          <div className="text-center">
            <p className="text-xl leading-relaxed text-foreground">{data.definition}</p>
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
