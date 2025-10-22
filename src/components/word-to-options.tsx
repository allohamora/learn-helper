import { type FC, type MouseEvent, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Volume2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { List, type WordToOptionsData } from '@/types/user-words.types';

type WordToOptionsProps = {
  title: string;
  subtitle: string;
  data: WordToOptionsData;
  onMistake: (userWordId: number) => void;
  onNext: () => void;
};

export const WordToOptions: FC<WordToOptionsProps> = ({ data, title, subtitle, onMistake, onNext }) => {
  const [answers, setAnswers] = useState<Set<number>>(new Set());
  const [isFinished, setIsFinished] = useState(false);
  const { playAudio, isPlaying } = useAudioPlayer();

  const onSelectOption = (optionId: number) => {
    setAnswers((prev) => new Set(prev).add(optionId));

    if (data.options.find((opt) => opt.id === optionId)?.isCorrect) {
      setIsFinished(true);
    } else {
      onMistake(data.id);
    }
  };

  const handlePlayPronunciation = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (data.pronunciation) playAudio(data.pronunciation);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <h2 className="mb-2 text-xl font-semibold">{title}</h2>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>

      <Card className="mb-6 bg-card shadow-lg">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex items-start justify-between">
            <CardTitle className="text-3xl leading-tight font-bold">
              {data.value}
              {data.spelling && (
                <span className="ml-2 text-lg font-normal text-muted-foreground">({data.spelling})</span>
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
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="space-y-3">
            {data.options.map((option) => {
              const isAnswered = answers.has(option.id);

              return (
                <Button
                  key={option.id}
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left p-4 h-auto transition-colors duration-200 whitespace-normal [&:disabled]:opacity-80',
                    {
                      'border-green-500 text-green-500': isAnswered && option.isCorrect,
                      'border-red-500 text-red-500': isAnswered && !option.isCorrect,
                    },
                  )}
                  onClick={() => onSelectOption(option.id)}
                  disabled={isAnswered || isFinished}
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <span className="flex-1 text-base leading-relaxed">{option.value}</span>
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {isFinished && (
        <div className="text-center">
          <Button onClick={onNext} size="lg" className="px-8">
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
