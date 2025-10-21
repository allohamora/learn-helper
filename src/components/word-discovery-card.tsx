import { type MouseEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Volume2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { List, type UserWord } from '@/types/user-words.types';

type WordDiscoveryCardProps = {
  userWord: UserWord;
};

export function WordDiscoveryCard({ userWord }: WordDiscoveryCardProps) {
  const { isPlaying, playAudio } = useAudioPlayer();

  const handlePlayPronunciation = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (userWord.word.pronunciation) {
      playAudio(userWord.word.pronunciation);
    }
  };

  return (
    <Card className="flex h-72 flex-col bg-card shadow-lg">
      <CardHeader className="space-y-2 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-2xl leading-tight font-bold">
              {userWord.word.value}
              {userWord.word.spelling && (
                <span className="ml-2 text-base font-normal text-muted-foreground">({userWord.word.spelling})</span>
              )}
            </CardTitle>

            <div className="mt-1 text-sm text-muted-foreground">{userWord.word.uaTranslation}</div>
          </div>

          <div className="flex items-center gap-1">
            {userWord.word.pronunciation && (
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

            {userWord.word.link && (
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-8 w-8 shrink-0 p-0"
                title="View in Oxford Dictionary"
              >
                <a href={userWord.word.link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {userWord.word.level}
          </Badge>
          {userWord.word.partOfSpeech && (
            <Badge variant="outline" className="text-xs">
              {userWord.word.partOfSpeech.toLowerCase()}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {userWord.word.list === List.Oxford5000Words ? 'oxford 5000' : 'phrase list'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 items-center justify-center">
        <p className="text-center text-lg leading-relaxed text-foreground">{userWord.word.definition}</p>
      </CardContent>
    </Card>
  );
}
