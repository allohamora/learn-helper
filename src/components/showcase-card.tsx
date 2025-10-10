import { type FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Volume2, ExternalLink, ArrowRight, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { List, type UserWord } from '@/types/user-words.types';

type ShowcaseCardProps = {
  onNext?: () => void;
  onPrev?: () => void;
  onComplete: () => void;
  current: UserWord;
  currentIndex: number;
  totalWords: number;
  isLastWord: boolean;
};

export const ShowcaseCard: FC<ShowcaseCardProps> = ({
  onNext,
  onPrev,
  onComplete,
  current,
  currentIndex,
  totalWords,
  isLastWord,
}) => {
  const { isPlaying, playAudio } = useAudioPlayer();

  const handlePlayPronunciation = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (current.word.pronunciation) {
      playAudio(current.word.pronunciation);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <h2 className="mb-2 text-xl font-semibold">Let&apos;s learn these words</h2>
        <p className="text-muted-foreground">Take a moment to familiarize yourself with each word</p>
        <div className="mt-2">
          <span className="text-muted-foreground text-sm">
            Word {currentIndex + 1} of {totalWords}
          </span>
        </div>
      </div>

      <Card className="bg-card mb-6 flex min-h-[400px] flex-col shadow-lg">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex items-start justify-between">
            <CardTitle className="text-3xl leading-tight font-bold">
              {current.word.value}
              {current.word.spelling && (
                <span className="text-muted-foreground ml-2 text-lg font-normal">({current.word.spelling})</span>
              )}
            </CardTitle>

            <div className="flex items-center gap-1">
              {current.word.pronunciation && (
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

              {current.word.link && (
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-8 w-8 shrink-0 p-0"
                  title="View in Oxford Dictionary"
                >
                  <a href={current.word.link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {current.word.level}
            </Badge>
            {current.word.partOfSpeech && (
              <Badge variant="outline" className="text-xs">
                {current.word.partOfSpeech.toLowerCase()}
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {current.word.list === List.Oxford5000Words ? 'oxford 5000' : 'phrase list'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 items-center justify-center pt-4">
          <div className="text-center">
            <p className="text-foreground text-xl leading-relaxed">{current.word.definition}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button onClick={onPrev} variant="outline" disabled={currentIndex === 0} className="px-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>

        <div className="flex gap-2">
          {Array.from({ length: totalWords }, (_, i) => (
            <div
              key={i}
              className={cn('w-2 h-2 rounded-full transition-colors', i === currentIndex ? 'bg-primary' : 'bg-muted')}
            />
          ))}
        </div>

        <Button onClick={isLastWord ? onComplete : onNext} className="px-6">
          Next
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
