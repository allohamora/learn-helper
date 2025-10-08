import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Volume2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { List, type Word } from '@/types/user-words.types';

type WordDiscoveryCardProps = {
  word: Word;
};

export function WordDiscoveryCard({ word }: WordDiscoveryCardProps) {
  const { isPlaying, playAudio } = useAudioPlayer();

  const handlePlayPronunciation = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (word.pronunciation) {
      playAudio(word.pronunciation);
    }
  };

  return (
    <Card className="bg-card flex h-72 flex-col shadow-lg">
      <CardHeader className="space-y-4 pb-4">
        <div className="flex items-start justify-between">
          <CardTitle className="text-2xl leading-tight font-bold">
            {word.value}
            {word.spelling && (
              <span className="text-muted-foreground ml-2 text-base font-normal">({word.spelling})</span>
            )}
          </CardTitle>

          <div className="flex items-center gap-1">
            {word.pronunciation && (
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

            {word.link && (
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-8 w-8 shrink-0 p-0"
                title="View in Oxford Dictionary"
              >
                <a href={word.link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {word.level}
          </Badge>
          {word.partOfSpeech && (
            <Badge variant="outline" className="text-xs">
              {word.partOfSpeech.toLowerCase()}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {word.list === List.Oxford5000Words ? 'oxford 5000' : 'phrase list'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 items-center justify-center">
        <p className="text-foreground text-center text-lg leading-relaxed">{word.definition}</p>
      </CardContent>
    </Card>
  );
}
