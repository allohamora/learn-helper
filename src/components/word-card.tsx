import { type FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Volume2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import type { Word } from '@/types/user-words.types';

type WordCardProps = {
  word: Word;
};

export const WordCard: FC<WordCardProps> = ({ word }) => {
  const { isPlaying, playAudio } = useAudioPlayer();

  const handlePlayPronunciation = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (word.pronunciation) {
      playAudio(word.pronunciation);
    }
  };

  return (
    <Card className="group relative flex h-full flex-col transition-all duration-200 hover:shadow-md">
      <CardHeader className="flex-shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base leading-tight font-semibold">
            {word.value}
            {word.spelling && word.spelling !== word.value && (
              <span className="text-muted-foreground ml-1 text-xs font-normal">({word.spelling})</span>
            )}
          </CardTitle>

          <div className="flex items-center gap-1">
            {word.pronunciation && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePlayPronunciation}
                disabled={isPlaying}
                className="h-7 w-7 shrink-0 p-0"
                title="Play pronunciation"
              >
                <Volume2 className={cn('h-3 w-3', { 'animate-pulse': isPlaying })} />
              </Button>
            )}

            {word.link && (
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-7 w-7 shrink-0 p-0"
                title="View in Oxford Dictionary"
              >
                <a href={word.link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-grow flex-col space-y-3 px-4 pb-3">
        <div className="text-xs leading-relaxed">
          <p className="text-muted-foreground">{word.definition}</p>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-1">
          <Badge className="px-2 py-0.5 text-xs" variant="outline">
            {word.level}
          </Badge>

          {word.partOfSpeech && (
            <Badge variant="outline" className="px-2 py-0.5 text-xs">
              {word.partOfSpeech}
            </Badge>
          )}

          <Badge variant="outline" className="px-2 py-0.5 text-xs">
            {word.list === 'oxford-5000-words' ? 'oxford 5000' : 'phrase list'}
          </Badge>

          <Badge className="px-2 py-0.5 text-xs" variant="outline">
            {word.status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};
