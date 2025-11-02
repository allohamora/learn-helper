import { Calendar, TrendingUp, Search, Clock, CircleAlert, BookOpen, RotateCcw, Trophy, Timer } from 'lucide-react';
import { CartesianGrid, XAxis, YAxis, Area, AreaChart } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Badge } from '@/components/ui/badge';
import { type FC } from 'react';
import { useQuery } from '@tanstack/react-query';
import { actions } from 'astro:actions';
import { Button } from './ui/button';
import { Loader } from './ui/loader';
import { toDateWithoutYear } from '@/utils/date.utils';
import { useMediaQuery } from 'usehooks-ts';

const discoveringChartConfig = {
  learningCount: {
    label: 'Learning',
    color: 'var(--chart-1)',
  },
  knownCount: {
    label: 'Known',
    color: 'var(--chart-2)',
  },
  durationMin: {
    label: 'Duration (min)',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig;

const learningChartConfig = {
  completedTasks: {
    label: 'Tasks Completed',
    color: 'var(--chart-1)',
  },
  completedRetries: {
    label: 'Retry Tasks',
    color: 'var(--chart-2)',
  },
  completedShowcases: {
    label: 'Showcase Tasks',
    color: 'var(--chart-3)',
  },
  mistakesMade: {
    label: 'Mistakes',
    color: 'var(--chart-4)',
  },
  durationMin: {
    label: 'Duration (min)',
    color: 'var(--chart-5)',
  },
} satisfies ChartConfig;

const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
};

export const Statistics: FC = () => {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['getStatistics'],
    queryFn: async () => {
      return await actions.getStatistics.orThrow({});
    },
  });

  const isPhoneScreen = useMediaQuery('(max-width: 640px)');

  if (error) {
    return (
      <div className="flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-destructive">{error.message}</p>
          <Button onClick={() => void refetch()}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  const { general, topMistakes } = data;

  return (
    <div className="space-y-4 md:space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="gap-0 py-4 md:py-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 md:px-6">
            <CardTitle className="text-sm font-medium">Words Discovered</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="text-2xl font-bold">{general.totalDiscoveredWords.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">words categorized</p>
          </CardContent>
        </Card>

        <Card className="gap-0 py-4 md:py-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 md:px-6">
            <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="text-2xl font-bold">{general.totalCompletedTasks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">learning tasks finished</p>
          </CardContent>
        </Card>

        <Card className="gap-0 py-4 md:py-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 md:px-6">
            <CardTitle className="text-sm font-medium">Mistakes Made</CardTitle>
            <CircleAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="text-2xl font-bold">{general.totalMistakesMade.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">errors to learn from</p>
          </CardContent>
        </Card>

        <Card className="gap-0 py-4 md:py-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 md:px-6">
            <CardTitle className="text-sm font-medium">Retries Completed</CardTitle>
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="text-2xl font-bold">{general.totalRetriesCompleted.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">retry tasks finished</p>
          </CardContent>
        </Card>

        <Card className="gap-0 py-4 md:py-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 md:px-6">
            <CardTitle className="text-sm font-medium">Showcases Completed</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="text-2xl font-bold">{general.totalShowcasesCompleted.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">showcase tasks finished</p>
          </CardContent>
        </Card>

        <Card className="gap-0 py-4 md:py-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 md:px-6">
            <CardTitle className="text-sm font-medium">Words Progressed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="text-2xl font-bold">{general.totalWordsMovedToNextStep.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">words advanced</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        <Card className="gap-0 py-4 md:py-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 md:px-6">
            <CardTitle className="text-sm font-medium">Total Learning Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="text-2xl font-bold">{formatDuration(general.totalLearningDurationMs)}</div>
            <p className="text-xs text-muted-foreground">time spent learning</p>
          </CardContent>
        </Card>

        <Card className="gap-0 py-4 md:py-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 md:px-6">
            <CardTitle className="text-sm font-medium">Total Discovery Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="text-2xl font-bold">{formatDuration(general.totalDiscoveringDurationMs)}</div>
            <p className="text-xs text-muted-foreground">time spent discovering</p>
          </CardContent>
        </Card>

        <Card className="gap-0 py-4 md:py-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 md:px-6">
            <CardTitle className="text-sm font-medium">Average Time Per Task</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="text-2xl font-bold">{formatDuration(general.averageTimePerTaskMs)}</div>
            <p className="text-xs text-muted-foreground">average task duration</p>
          </CardContent>
        </Card>

        <Card className="gap-0 py-4 md:py-6">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 md:px-6">
            <CardTitle className="text-sm font-medium">Average Time Per Discovery</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="text-2xl font-bold">{formatDuration(general.averageTimePerDiscoveryMs)}</div>
            <p className="text-xs text-muted-foreground">average discovery duration</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <Card className="py-4 md:py-6">
          <CardHeader className="space-y-1 px-4 md:px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Word Discovery</CardTitle>
              <Badge variant="secondary" className="font-normal">
                <Calendar className="mr-1 h-3 w-3" />
                Last 7 days
              </Badge>
            </div>
            <CardDescription className="text-sm">
              Daily progression of known and learning words with time spent
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pt-2 md:px-6">
            <ChartContainer config={discoveringChartConfig}>
              <AreaChart
                accessibilityLayer
                data={data.discoveringPerDay.map((item) => ({
                  ...item,
                  date: toDateWithoutYear(item.date),
                  durationMin: Math.round(item.durationMs / 60000),
                }))}
              >
                <defs>
                  <linearGradient id="fillLearning" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-learningCount)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-learningCount)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="fillKnown" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-knownCount)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-knownCount)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="fillDiscoveryDuration" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-durationMin)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-durationMin)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis
                  hide={isPhoneScreen}
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  className="text-xs"
                />
                <YAxis hide={isPhoneScreen} tickLine={false} axisLine={false} tickMargin={10} className="text-xs" />
                <ChartTooltip cursor={{ strokeDasharray: '3 3' }} content={<ChartTooltipContent indicator="line" />} />
                <Area
                  dataKey="learningCount"
                  type="monotone"
                  fill="url(#fillLearning)"
                  stroke="var(--color-learningCount)"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
                <Area
                  dataKey="knownCount"
                  type="monotone"
                  fill="url(#fillKnown)"
                  stroke="var(--color-knownCount)"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
                <Area
                  dataKey="durationMin"
                  type="monotone"
                  fill="url(#fillDiscoveryDuration)"
                  stroke="var(--color-durationMin)"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="py-4 md:py-6">
          <CardHeader className="space-y-1 px-4 md:px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Learning Activity</CardTitle>
              <Badge variant="secondary" className="font-normal">
                <Calendar className="mr-1 h-3 w-3" />
                Last 7 days
              </Badge>
            </div>
            <CardDescription className="text-sm">
              Daily tasks completed, retries, showcases, mistakes made, and time spent
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <ChartContainer config={learningChartConfig}>
              <AreaChart
                accessibilityLayer
                data={data.learningPerDay.map((item) => ({
                  ...item,
                  date: toDateWithoutYear(item.date),
                  durationMin: Math.round(item.durationMs / 60000),
                }))}
              >
                <defs>
                  <linearGradient id="fillTasks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-completedTasks)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-completedTasks)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="fillRetries" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-completedRetries)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-completedRetries)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="fillShowcases" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-completedShowcases)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-completedShowcases)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="fillMistakes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-mistakesMade)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-mistakesMade)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="fillDuration" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-durationMin)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-durationMin)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis
                  hide={isPhoneScreen}
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  className="text-xs"
                />
                <YAxis hide={isPhoneScreen} tickLine={false} axisLine={false} tickMargin={10} className="text-xs" />
                <ChartTooltip cursor={{ strokeDasharray: '3 3' }} content={<ChartTooltipContent indicator="line" />} />
                <Area
                  dataKey="completedTasks"
                  type="monotone"
                  fill="url(#fillTasks)"
                  stroke="var(--color-completedTasks)"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
                <Area
                  dataKey="completedRetries"
                  type="monotone"
                  fill="url(#fillRetries)"
                  stroke="var(--color-completedRetries)"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
                <Area
                  dataKey="completedShowcases"
                  type="monotone"
                  fill="url(#fillShowcases)"
                  stroke="var(--color-completedShowcases)"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
                <Area
                  dataKey="mistakesMade"
                  type="monotone"
                  fill="url(#fillMistakes)"
                  stroke="var(--color-mistakesMade)"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
                <Area
                  dataKey="durationMin"
                  type="monotone"
                  fill="url(#fillDuration)"
                  stroke="var(--color-durationMin)"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-muted/40 py-4 md:py-6">
        <CardHeader className="space-y-1 px-4 md:px-6">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Most Challenging Words</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Words that need more practice based on mistake frequency
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-hidden px-4 md:px-6">
          {topMistakes.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>No mistakes recorded yet. Keep practicing!</p>
            </div>
          ) : (
            <div className="overflow-auto rounded-lg border border-muted/40">
              <table className="w-full">
                <thead className="bg-muted/30">
                  <tr className="border-b border-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      Rank
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      Word
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium tracking-wider text-muted-foreground uppercase">
                      Mistakes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted/40">
                  {topMistakes.map((mistake, index) => (
                    <tr key={`${mistake.value}-${index}`} className="transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <Badge variant={index < 3 ? 'destructive' : 'secondary'} className="font-mono text-xs">
                          #{index + 1}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold">{mistake.value || 'Unknown'}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs font-normal">
                          {mistake.partOfSpeech || 'Unknown'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center justify-center rounded-full bg-destructive/10 px-3 py-1 text-sm font-bold text-destructive">
                          {mistake.count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
