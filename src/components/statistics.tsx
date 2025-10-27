import { AlertCircle, Calendar, Clock } from 'lucide-react';
import { CartesianGrid, XAxis, YAxis, Area, AreaChart } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Badge } from '@/components/ui/badge';
import { useMemo, type FC } from 'react';
import { useQuery } from '@tanstack/react-query';
import { actions } from 'astro:actions';
import { EventType, type DiscoveryStatus } from '@/types/user-words.types';
import { Button } from './ui/button';
import { Loader } from './ui/loader';

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  [EventType.DiscoveryWordStatusChanged]: 'Discovered',
  [EventType.LearningSessionCompleted]: 'Sessions',
  [EventType.WordMovedToNextStep]: 'Progressed',
  [EventType.LearningMistakeMade]: 'Mistakes',
};

const EVENT_TYPE_DESCRIPTIONS: Record<EventType, string> = {
  [EventType.DiscoveryWordStatusChanged]: 'words categorized',
  [EventType.LearningSessionCompleted]: 'sessions completed',
  [EventType.WordMovedToNextStep]: 'words advanced',
  [EventType.LearningMistakeMade]: 'errors made',
};

const durationChartConfig = {
  duration: {
    label: 'Minutes',
    color: 'var(--chart-1)',
  },
  count: {
    label: 'Sessions',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

const discoveryChartConfig = {
  known: {
    label: 'Known',
    color: 'var(--chart-3)',
  },
  learning: {
    label: 'Learning',
    color: 'var(--chart-4)',
  },
} satisfies ChartConfig;

type StatisticsData = Awaited<ReturnType<typeof actions.getStatistics.orThrow>>;
type TypeStatistics = StatisticsData['typeStatistics'];
type DurationPerDayStatistics = StatisticsData['durationPerDayStatistics'];
type DiscoveryPerDayStatistics = StatisticsData['discoveryPerDayStatistics'];

const buildTypeStatistics = (typeStatistics: TypeStatistics) => {
  const state = {
    [EventType.DiscoveryWordStatusChanged]: 0,
    [EventType.LearningSessionCompleted]: 0,
    [EventType.WordMovedToNextStep]: 0,
    [EventType.LearningMistakeMade]: 0,
  };

  for (const stat of typeStatistics) {
    state[stat.type as EventType] = stat.count;
  }

  return Object.entries(state).map(([type, count]) => ({
    type,
    count,
  }));
};

const getDates = () => {
  return Array.from({ length: 7 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));

    return date.toISOString().split('T')[0] as string;
  });
};

const withoutYear = (dateString: string) => {
  const [, month, day] = dateString.split('-');
  return `${month}-${day}`;
};

const buildDurationPerDayStatistics = (durationPerDayStatistics: DurationPerDayStatistics) => {
  const dates = getDates();
  const dateMap: Record<string, { date: string; duration: number; count: number }> = {};

  for (const date of dates) {
    dateMap[date] = { date: withoutYear(date), duration: 0, count: 0 };
  }

  for (const { date, duration, count } of durationPerDayStatistics) {
    dateMap[date] = {
      date: withoutYear(date),
      duration: Number((duration / 60000).toFixed(2)), // Convert ms to minutes
      count,
    };
  }

  return Object.values(dateMap);
};

const buildDiscoveryPerDayStatistics = (discoveryPerDayStatistics: DiscoveryPerDayStatistics) => {
  const dates = getDates();
  const dateMap: Record<string, { date: string } & { [key in DiscoveryStatus]: number }> = {};

  for (const date of dates) {
    dateMap[date] = { date: withoutYear(date), known: 0, learning: 0, waiting: 0 };
  }

  for (const { date, status, count } of discoveryPerDayStatistics) {
    if (!dateMap[date]) {
      throw new Error(`Unexpected date ${date} in discovery statistics`);
    }

    dateMap[date][status] = count;
  }

  return Object.values(dateMap);
};

const buildDurationStatistics = (typeStatistics: TypeStatistics) => {
  const durationStat = typeStatistics.find((stat) => stat.type === EventType.LearningSessionCompleted);
  const durationStatistics = durationStat ? durationStat.duration : 0;

  const totalMinutes = Math.round(durationStatistics / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const dataToStatistics = ({
  typeStatistics,
  durationPerDayStatistics,
  discoveryPerDayStatistics,
  topMistakes,
}: Awaited<ReturnType<typeof actions.getStatistics.orThrow>>) => {
  return {
    typeStatistics: buildTypeStatistics(typeStatistics),
    durationPerDayStatistics: buildDurationPerDayStatistics(durationPerDayStatistics),
    discoveryPerDayStatistics: buildDiscoveryPerDayStatistics(discoveryPerDayStatistics),
    durationStatistics: buildDurationStatistics(typeStatistics),
    topMistakes,
  };
};

export const Statistics: FC = () => {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['getStatistics'],
    queryFn: async () => {
      return await actions.getStatistics.orThrow({});
    },
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center">
        <Loader />
      </div>
    );
  }

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

  const { typeStatistics, durationPerDayStatistics, discoveryPerDayStatistics, durationStatistics, topMistakes } =
    dataToStatistics(data);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-center">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">Total Learning Time</h3>
                </div>
                <div className="flex justify-center gap-2">
                  <span className="text-4xl font-bold tracking-tight">{durationStatistics}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {typeStatistics.map((stat) => {
            return (
              <Card key={stat.type} className="gap-2">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>{EVENT_TYPE_LABELS[stat.type as EventType]}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tracking-tight">{stat.count.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">{EVENT_TYPE_DESCRIPTIONS[stat.type as EventType]}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Discovery Statistics Chart */}
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Word Discovery</CardTitle>
              <Badge variant="secondary" className="font-normal">
                <Calendar className="mr-1 h-3 w-3" />
                Last 7 days
              </Badge>
            </div>
            <CardDescription className="text-sm">Daily progression of known and learning words</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <ChartContainer config={discoveryChartConfig}>
              <AreaChart accessibilityLayer data={discoveryPerDayStatistics}>
                <defs>
                  <linearGradient id="fillKnown" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-known)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-known)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="fillLearning" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-learning)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-learning)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={10} className="text-xs" />
                <YAxis tickLine={false} axisLine={false} tickMargin={10} className="text-xs" />
                <ChartTooltip cursor={{ strokeDasharray: '3 3' }} content={<ChartTooltipContent indicator="line" />} />
                <Area
                  dataKey="known"
                  type="monotone"
                  fill="url(#fillKnown)"
                  stroke="var(--color-known)"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
                <Area
                  dataKey="learning"
                  type="monotone"
                  fill="url(#fillLearning)"
                  stroke="var(--color-learning)"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Duration Chart */}
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Learning Activity</CardTitle>
              <Badge variant="secondary" className="font-normal">
                <Calendar className="mr-1 h-3 w-3" />
                Last 7 days
              </Badge>
            </div>
            <CardDescription className="text-sm">Daily sessions and total time spent learning</CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <ChartContainer config={durationChartConfig}>
              <AreaChart accessibilityLayer data={durationPerDayStatistics}>
                <defs>
                  <linearGradient id="fillDuration" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-duration)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-duration)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="fillCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={10} className="text-xs" />
                <YAxis tickLine={false} axisLine={false} tickMargin={10} className="text-xs" />
                <ChartTooltip cursor={{ strokeDasharray: '3 3' }} content={<ChartTooltipContent indicator="line" />} />
                <Area
                  dataKey="duration"
                  type="monotone"
                  fill="url(#fillDuration)"
                  stroke="var(--color-duration)"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
                <Area
                  dataKey="count"
                  type="monotone"
                  fill="url(#fillCount)"
                  stroke="var(--color-count)"
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Mistakes Table */}
      <Card className="border-muted/40">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Most Challenging Words</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Words that need more practice based on mistake frequency
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border border-muted/40">
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
                    <td className="px-4 py-3 text-sm font-semibold">{mistake.value}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs font-normal">
                        {mistake.partOfSpeech}
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
        </CardContent>
      </Card>
    </div>
  );
};
