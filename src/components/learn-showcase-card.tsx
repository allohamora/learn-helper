import { type FC, type MouseEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Volume2, ExternalLink, ArrowRight, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEditVocabularyItemTranslation } from '@/components/providers/edit-vocabulary-item-translation';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import type { LearnItem, ShowcaseTask } from '@/types/learn';

type LearnShowcaseCardProps = {
  data: ShowcaseTask['data'];
  item?: LearnItem;
  onNext: () => void;
};

export const LearnShowcaseCard: FC<LearnShowcaseCardProps> = ({ data, item, onNext }) => {
  const { isPlaying, playAudio } = useAudioPlayer();
  const { openEdit } = useEditVocabularyItemTranslation();

  const handlePlayPronunciation = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (data.pronunciation) void playAudio(data.pronunciation);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 text-center md:mb-6">
        <h2 className="mb-2 text-lg font-semibold md:text-xl">Let&apos;s learn these items</h2>
        <p className="text-sm text-muted-foreground">Take a moment to familiarize yourself with each item</p>
      </div>

      <Card className="mb-4 flex min-h-64 flex-col gap-4 bg-card py-4 shadow-lg md:mb-6 md:min-h-[400px] md:gap-6 md:py-6">
        <CardHeader className="space-y-2 px-4 pb-4 md:px-6">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl/tight font-bold md:text-3xl">{data.value}</CardTitle>

              <div className="text-base font-normal text-muted-foreground md:text-lg">({data.spelling})</div>
              <div className="text-sm text-muted-foreground">{data.uaTranslation}</div>
            </div>

            <div className="flex items-center gap-1">
              {item && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openEdit({
                      userVocabularyItemId: item.id,
                      value: data.value,
                      partOfSpeech: data.partOfSpeech,
                      uaTranslation: data.uaTranslation,
                    });
                  }}
                  className="size-8 shrink-0 p-0"
                  title="Edit translation"
                >
                  <Pencil className="size-4" />
                </Button>
              )}

              {data.pronunciation && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePlayPronunciation}
                  disabled={isPlaying}
                  className="size-8 shrink-0 p-0"
                  title="Play pronunciation"
                >
                  <Volume2 className={cn('size-4', { 'animate-pulse': isPlaying })} />
                </Button>
              )}

              {data.link && (
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="size-8 shrink-0 p-0"
                  title="View in Oxford Dictionary"
                >
                  <a href={data.link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>

          {data.partOfSpeech && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {data.partOfSpeech.toLowerCase()}
              </Badge>
            </div>
          )}
        </CardHeader>

        <CardContent className="flex flex-1 items-center justify-center px-4 md:px-6">
          <div className="text-center">
            <p className="leading-relaxed text-foreground md:text-xl">{data.definition}</p>
          </div>
        </CardContent>
      </Card>

      <div className="text-center">
        <Button onClick={onNext} size="lg" className="px-8">
          Next
          <ArrowRight className="ml-2 size-4" />
        </Button>
      </div>
    </div>
  );
};
