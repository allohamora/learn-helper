import { Calendar, Clock, Search, Timer, TrendingUp } from 'lucide-react';
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

  const { general } = data;

  return (
    <div className="space-y-4 md:space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <CardTitle className="text-sm font-medium">Words Progressed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="text-2xl font-bold">{general.totalWordsMovedToNextStep.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">words advanced</p>
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
            <CardTitle className="text-sm font-medium">Average Discovery Time</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 md:px-6">
            <div className="text-2xl font-bold">{formatDuration(general.averageTimePerDiscoveryMs)}</div>
            <p className="text-xs text-muted-foreground">average discovery duration</p>
          </CardContent>
        </Card>
      </div>

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
        <CardContent className="mt-auto px-4 pt-2 md:px-6">
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
    </div>
  );
};
