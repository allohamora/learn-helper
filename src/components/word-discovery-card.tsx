import { type MouseEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Volume2, ExternalLink, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { useEditWord } from '@/components/providers/edit-word';
import { List, type UserWord } from '@/types/user-words.types';

type WordDiscoveryCardProps = {
  userWord: UserWord;
};

export function WordDiscoveryCard({ userWord }: WordDiscoveryCardProps) {
  const { isPlaying, playAudio } = useAudioPlayer();
  const { openEditWord } = useEditWord();

  const handlePlayPronunciation = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (userWord.word.pronunciation) {
      playAudio(userWord.word.pronunciation);
    }
  };

  return (
    <Card className="flex min-h-64 flex-col gap-4 bg-card py-4 shadow-lg md:min-h-72 md:gap-6 md:py-6">
      <CardHeader className="space-y-2 px-4 pb-4 md:px-6">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl leading-tight font-bold md:text-2xl">{userWord.word.value}</CardTitle>

            <div className="text-base font-normal text-muted-foreground md:text-lg">({userWord.word.spelling})</div>
            <div className="text-sm text-muted-foreground">{userWord.word.uaTranslation}</div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openEditWord(userWord);
              }}
              className="h-8 w-8 shrink-0 p-0"
              title="Edit translation"
            >
              <Pencil className="h-4 w-4" />
            </Button>

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

      <CardContent className="flex flex-1 items-center justify-center px-4 md:px-6">
        <p className="text-center leading-relaxed text-foreground md:text-lg">{userWord.word.definition}</p>
      </CardContent>
    </Card>
  );
}
