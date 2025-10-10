import { type FC, useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Volume2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { List, type Word } from '@/types/user-words.types';

type WordToDefinitionProps = {
  word: Word;
  otherWords: Word[];
  onComplete: (failures: number) => void;
};

type OptionState = 'idle' | 'correct' | 'incorrect';

export const WordToDefinition: FC<WordToDefinitionProps> = ({ word, otherWords, onComplete }) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [optionStates, setOptionStates] = useState<Record<string, OptionState>>({});
  const [failures, setFailures] = useState(0);
  const [isAnswered, setIsAnswered] = useState(false);
  const { isPlaying, playAudio } = useAudioPlayer();

  // Reset state when word changes
  useEffect(() => {
    setSelectedOption(null);
    setOptionStates({});
    setFailures(0);
    setIsAnswered(false);
  }, [word.id]);

  const options = useMemo(() => {
    // Create options array with correct answer and distractors
    const distractors = otherWords.slice(0, Math.min(3, otherWords.length));
    const allOptions = [word, ...distractors];

    // Shuffle options using Fisher-Yates algorithm for better randomness
    const shuffled = [...allOptions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.map((w) => ({ id: w.id, definition: w.definition, partOfSpeech: w.partOfSpeech }));
  }, [word.id, otherWords.map((w) => w.id).join(',')]);

  const handleOptionSelect = (optionId: number) => {
    if (isAnswered) return;

    const isCorrect = optionId === word.id;
    setSelectedOption(optionId.toString());

    if (isCorrect) {
      setOptionStates((prev) => ({ ...prev, [optionId]: 'correct' }));
      setIsAnswered(true);
    } else {
      setOptionStates((prev) => ({ ...prev, [optionId]: 'incorrect' }));
      setFailures((prev) => prev + 1);
      // Allow retry after a brief delay
      setTimeout(() => {
        setSelectedOption(null);
      }, 1000);
    }
  };

  const handleContinue = () => {
    onComplete(failures);
  };

  const handlePlayPronunciation = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (word.pronunciation) {
      playAudio(word.pronunciation);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <h2 className="mb-2 text-xl font-semibold">What does this word mean?</h2>
        <p className="text-muted-foreground">Select the correct definition for the given word</p>
      </div>

      <Card className="bg-card mb-6 shadow-lg">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex items-start justify-between">
            <CardTitle className="text-3xl leading-tight font-bold">
              {word.value}
              {word.spelling && (
                <span className="text-muted-foreground ml-2 text-lg font-normal">({word.spelling})</span>
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

        <CardContent className="mt-4 space-y-3">
          <div className="space-y-3">
            {options.map((option) => {
              const state = optionStates[option.id] || 'idle';
              const isSelected = selectedOption === option.id.toString();

              return (
                <Button
                  key={option.id}
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left p-4 h-auto transition-colors duration-200 whitespace-normal',
                    {
                      'border-green-500 bg-green-50 text-green-700': state === 'correct',
                      'border-red-500 bg-red-50 text-red-700': state === 'incorrect',
                      'border-primary bg-primary/5': isSelected && state === 'idle',
                    },
                  )}
                  onClick={() => handleOptionSelect(option.id)}
                  disabled={isAnswered}
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <span className="flex-1 text-base leading-relaxed">{option.definition}</span>
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {failures > 0 && (
        <div className="mb-4 text-center">
          <p className="text-muted-foreground text-sm">
            {failures} incorrect attempt{failures > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {isAnswered && (
        <div className="text-center">
          <Button onClick={handleContinue} size="lg" className="px-8">
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
