import type { FC, MouseEvent } from 'react';
import type { InferResponseType } from 'hono/client';
import { ExternalLink, Pencil, Volume2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEditVocabularyItemTranslation } from '@/components/providers/edit-vocabulary-item-translation';
import { appClient } from '@/services/api';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { cn } from '@/lib/utils';

type ItemsResponse = InferResponseType<
  (typeof appClient.api.v1.users.me)['vocabulary-lists'][':userVocabularyListId']['items']['$get']
>;
export type VocabularyDiscoverItem = Extract<ItemsResponse, { success: true }>['data'][number];

type Props = {
  item: VocabularyDiscoverItem;
};

export const VocabularyDiscoverCard: FC<Props> = ({ item }) => {
  const { isPlaying, playAudio } = useAudioPlayer();
  const { openEdit } = useEditVocabularyItemTranslation();
  const { vocabularyItem } = item;

  const handlePlayPronunciation = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (vocabularyItem.pronunciation) {
      void playAudio(vocabularyItem.pronunciation);
    }
  };

  const handleEdit = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    openEdit({
      userVocabularyItemId: item.id,
      value: vocabularyItem.value,
      partOfSpeech: vocabularyItem.partOfSpeech,
      uaTranslation: vocabularyItem.uaTranslation,
    });
  };

  return (
    <Card className="shadow-lg [--card-spacing:--spacing(4)] md:[--card-spacing:--spacing(6)]">
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-xl md:text-2xl">{vocabularyItem.value}</CardTitle>
            <div className="text-base font-normal text-muted-foreground md:text-lg">({vocabularyItem.spelling})</div>
            <div className="text-sm text-muted-foreground">{vocabularyItem.uaTranslation}</div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleEdit}
              title="Edit translation"
              aria-label="Edit translation"
            >
              <Pencil />
            </Button>

            {vocabularyItem.pronunciation && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handlePlayPronunciation}
                disabled={isPlaying}
                title="Play pronunciation"
                aria-label="Play pronunciation"
              >
                <Volume2 className={cn(isPlaying && 'animate-pulse')} />
              </Button>
            )}

            {vocabularyItem.link && (
              <Button
                variant="ghost"
                size="icon-sm"
                asChild
                title="View in Oxford Dictionary"
                aria-label="View in Oxford Dictionary"
              >
                <a href={vocabularyItem.link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink />
                </a>
              </Button>
            )}
          </div>
        </div>

        {vocabularyItem.partOfSpeech && (
          <div>
            <Badge variant="outline">{vocabularyItem.partOfSpeech.replace(/-/g, ' ')}</Badge>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <p className="text-center leading-relaxed text-foreground md:text-lg">{vocabularyItem.definition}</p>
      </CardContent>
    </Card>
  );
};
