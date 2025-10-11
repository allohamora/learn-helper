import { type FC, type MouseEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Volume2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { List, type UserWord } from '@/types/user-words.types';

type WordCardProps = {
  userWord: UserWord;
};

export const WordCard: FC<WordCardProps> = ({ userWord }) => {
  const { isPlaying, playAudio } = useAudioPlayer();

  const handlePlayPronunciation = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (userWord.word.pronunciation) {
      playAudio(userWord.word.pronunciation);
    }
  };

  return (
    <Card className="group relative flex h-full flex-col transition-all duration-200 hover:shadow-md">
      <CardHeader className="flex-shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base leading-tight font-semibold">
            {userWord.word.value}
            {userWord.word.spelling && userWord.word.spelling !== userWord.word.value && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">({userWord.word.spelling})</span>
            )}
          </CardTitle>

          <div className="flex items-center gap-1">
            {userWord.word.pronunciation && (
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

            {userWord.word.link && (
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-7 w-7 shrink-0 p-0"
                title="View in Oxford Dictionary"
              >
                <a href={userWord.word.link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-grow flex-col space-y-3 px-4 pb-3">
        <div className="text-xs leading-relaxed">
          <p className="text-muted-foreground">{userWord.word.definition}</p>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-1">
          <Badge className="px-2 py-0.5 text-xs" variant="outline">
            {userWord.word.level}
          </Badge>

          {userWord.word.partOfSpeech && (
            <Badge variant="outline" className="px-2 py-0.5 text-xs">
              {userWord.word.partOfSpeech}
            </Badge>
          )}

          <Badge variant="outline" className="px-2 py-0.5 text-xs">
            {userWord.word.list === List.Oxford5000Words ? 'oxford 5000' : 'phrase list'}
          </Badge>

          <Badge className="px-2 py-0.5 text-xs" variant="outline">
            {userWord.status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};
