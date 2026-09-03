import { type ComponentType, type FC, type ReactNode } from 'react';
import {
  ArrowDownUp,
  BookOpen,
  BookX,
  Calendar,
  CircleAlert,
  Clock,
  Database,
  DollarSign,
  History,
  Languages,
  Lightbulb,
  Pencil,
  RotateCcw,
  Search,
  Sparkles,
  Timer,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  Upload,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import type { InferResponseType } from 'hono/client';
import { appClient, type SuccessData } from '@/services/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { formatDollars, nanoDollarsToDollars } from '@/utils/currency';
import { toShortDate } from '@/utils/date';
import { formatDuration } from '@/utils/duration';

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
  hintsViewed: {
    label: 'Hints Viewed',
    color: 'var(--chart-6)',
  },
  durationMin: {
    label: 'Duration (min)',
    color: 'var(--chart-5)',
  },
} satisfies ChartConfig;

const costChartConfig = {
  costInDollars: {
    label: 'Task Cost',
    color: 'var(--chart-1)',
  },
  inputTokens: {
    label: 'Input Tokens',
    color: 'var(--chart-2)',
  },
  outputTokens: {
    label: 'Output Tokens',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig;

const itemsUpdatedChartConfig = {
  uaTranslation: {
    label: 'Ukrainian Translation',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

type StatisticsData = SuccessData<InferResponseType<(typeof appClient.api.v1.users.me.statistics)['$get']>>;
type TopVocabularyItem = StatisticsData['topMistakes'][number];

type MetricCardProps = {
  title: string;
  value: ReactNode;
  description: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
};

const MetricCard: FC<MetricCardProps> = ({ title, value, description, icon: Icon }) => (
  <Card size="sm" className="gap-0">
    <CardHeader>
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <CardAction>
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      </CardAction>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">{description}</p>
    </CardContent>
  </Card>
);

type StatisticsChartCardProps = {
  title: string;
  description: string;
  children: ReactNode;
};

const StatisticsChartCard: FC<StatisticsChartCardProps> = ({ title, description, children }) => (
  <Card>
    <CardHeader>
      <div className="flex items-center justify-between gap-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <Badge variant="secondary" className="shrink-0 font-normal">
          <Calendar className="size-3" aria-hidden="true" />
          Last 7 days
        </Badge>
      </div>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent className="mt-auto">{children}</CardContent>
  </Card>
);

const gradient = (id: string, color: string) => (
  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
    <stop offset="95%" stopColor={color} stopOpacity={0.05} />
  </linearGradient>
);

type AreaSeriesProps = {
  dataKey: string;
  gradientId: string;
};

const AreaSeries: FC<AreaSeriesProps> = ({ dataKey, gradientId }) => (
  <Area
    dataKey={dataKey}
    type="monotone"
    fill={`url(#${gradientId})`}
    stroke={`var(--color-${dataKey})`}
    strokeWidth={2}
    dot={{ r: 3, strokeWidth: 2 }}
    activeDot={{ r: 5 }}
  />
);

type ChartAxesProps = {
  hide: boolean;
};

const ChartAxes: FC<ChartAxesProps> = ({ hide }) => (
  <>
    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
    <XAxis hide={hide} dataKey="date" tickLine={false} axisLine={false} tickMargin={10} className="text-xs" />
    <YAxis hide={hide} tickLine={false} axisLine={false} tickMargin={10} className="text-xs" />
    <ChartTooltip cursor={{ strokeDasharray: '3 3' }} content={<ChartTooltipContent indicator="line" />} />
  </>
);

type RankedVocabularyTableProps = {
  title: string;
  description: string;
  countLabel: string;
  emptyMessage: string;
  items: TopVocabularyItem[];
  variant: 'mistakes' | 'hints';
};

const RankedVocabularyTable: FC<RankedVocabularyTableProps> = ({
  title,
  description,
  countLabel,
  emptyMessage,
  items,
  variant,
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base font-semibold">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent className="overflow-hidden">
      {items.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="overflow-auto rounded-lg border">
          <table className="w-full">
            <thead className="bg-muted/30">
              <tr className="border-b">
                {['Rank', 'Item', 'Type', countLabel].map((label) => (
                  <th
                    key={label}
                    className={[
                      'px-4 py-3 text-left text-xs font-medium tracking-wider text-muted-foreground uppercase',
                      label === countLabel ? 'text-right' : '',
                    ].join(' ')}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item, index) => (
                <tr key={`${item.value}-${index}`} className="transition-colors hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <Badge
                      variant={index < 3 ? (variant === 'mistakes' ? 'destructive' : 'default') : 'secondary'}
                      className="font-mono text-xs"
                    >
                      #{index + 1}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold">{item.value || 'Unknown'}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs font-normal">
                      {item.partOfSpeech || 'Unknown'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={[
                        'inline-flex items-center justify-center rounded-full px-3 py-1 text-sm font-bold',
                        variant === 'mistakes' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
                      ].join(' ')}
                    >
                      {item.count}
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
);

type StatisticsDashboardProps = {
  data: StatisticsData;
  isPhoneScreen: boolean;
};

export const StatisticsDashboard: FC<StatisticsDashboardProps> = ({ data, isPhoneScreen }) => {
  const { general } = data;
  const activityMetrics: MetricCardProps[] = [
    {
      title: 'Items Discovered',
      value: general.totalDiscoveredItems.toLocaleString(),
      description: 'items categorized',
      icon: Search,
    },
    {
      title: 'Discovery Undos',
      value: general.totalDiscoveryUndos.toLocaleString(),
      description: 'discoveries reverted',
      icon: TrendingDown,
    },
    {
      title: 'Tasks Completed',
      value: general.totalCompletedTasks.toLocaleString(),
      description: 'learning tasks finished',
      icon: Trophy,
    },
    {
      title: 'Mistakes Made',
      value: general.totalMistakesMade.toLocaleString(),
      description: 'errors to learn from',
      icon: CircleAlert,
    },
    {
      title: 'Retries Completed',
      value: general.totalRetriesCompleted.toLocaleString(),
      description: 'retry tasks finished',
      icon: RotateCcw,
    },
    {
      title: 'Showcases Completed',
      value: general.totalShowcasesCompleted.toLocaleString(),
      description: 'showcase tasks finished',
      icon: BookOpen,
    },
    {
      title: 'Items Progressed',
      value: general.totalItemsMovedToNextStep.toLocaleString(),
      description: 'items advanced',
      icon: TrendingUp,
    },
    {
      title: 'Hints Viewed',
      value: general.totalHintsViewed.toLocaleString(),
      description: 'hints viewed',
      icon: Lightbulb,
    },
    {
      title: 'Items Updated',
      value: general.totalItemsUpdated.toLocaleString(),
      description: 'items updated',
      icon: Pencil,
    },
    {
      title: 'Items Generated',
      value: general.totalItemsGenerated.toLocaleString(),
      description: 'items generated by ai',
      icon: Sparkles,
    },
    {
      title: 'Progress Resets',
      value: general.totalProgressResets.toLocaleString(),
      description: 'item progress reset',
      icon: History,
    },
    {
      title: 'Items Removed',
      value: general.totalItemsRemovedFromList.toLocaleString(),
      description: 'items removed from list',
      icon: Trash2,
    },
    {
      title: 'Readings Uploaded',
      value: general.totalReadingsUploaded.toLocaleString(),
      description: 'readings uploaded',
      icon: Upload,
    },
    {
      title: 'Readings Deleted',
      value: general.totalReadingsDeleted.toLocaleString(),
      description: 'readings deleted',
      icon: BookX,
    },
    {
      title: 'Reading Selections Translated',
      value: general.totalReadingSelectionTranslationsGenerated.toLocaleString(),
      description: 'reading selections translated by ai',
      icon: Languages,
    },
  ];

  const costMetrics: MetricCardProps[] = [
    {
      title: 'AI Cost',
      value: formatDollars(nanoDollarsToDollars(general.totalAiCostsInNanoDollars)),
      description: 'cost of ai generations',
      icon: DollarSign,
    },
    {
      title: 'Input Tokens',
      value: general.totalInputTokens.toLocaleString(),
      description: 'tokens sent to llm',
      icon: Database,
    },
    {
      title: 'Output Tokens',
      value: general.totalOutputTokens.toLocaleString(),
      description: 'tokens received from llm',
      icon: ArrowDownUp,
    },
  ];

  const timeMetrics: MetricCardProps[] = [
    {
      title: 'Total Learning Time',
      value: formatDuration(general.totalLearningDurationMs),
      description: 'time spent learning',
      icon: Clock,
    },
    {
      title: 'Total Discovery Time',
      value: formatDuration(general.totalDiscoveringDurationMs),
      description: 'time spent discovering',
      icon: Clock,
    },
    {
      title: 'Average Time Per Task',
      value: formatDuration(general.averageTimePerTaskMs),
      description: 'average task duration',
      icon: Timer,
    },
    {
      title: 'Average Time Per Discovery',
      value: formatDuration(general.averageTimePerDiscoveryMs),
      description: 'average discovery duration',
      icon: Timer,
    },
  ];

  const discoveringPerDay = data.discoveringPerDay.map((item) => ({
    ...item,
    date: toShortDate(item.date),
    durationMin: Math.round(item.durationMs / 60_000),
  }));

  const learningPerDay = data.learningPerDay.map((item) => ({
    ...item,
    date: toShortDate(item.date),
    durationMin: Math.round(item.durationMs / 60_000),
  }));

  const costPerDay = data.costPerDay.map((item) => ({
    date: toShortDate(item.date),
    costInDollars: nanoDollarsToDollars(item.costInNanoDollars),
    inputTokens: item.inputTokens,
    outputTokens: item.outputTokens,
  }));

  const itemsUpdatedPerDay = data.itemsUpdatedPerDay.map((item) => ({
    ...item,
    date: toShortDate(item.date),
  }));

  return (
    <div className="space-y-4 md:space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {activityMetrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {costMetrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {timeMetrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <StatisticsChartCard
          title="Item Discovery"
          description="Daily progression of known and learning items with time spent"
        >
          <ChartContainer config={discoveringChartConfig} className="min-h-52 w-full">
            <AreaChart accessibilityLayer data={discoveringPerDay}>
              <defs>
                {gradient('fillLearning', 'var(--color-learningCount)')}
                {gradient('fillKnown', 'var(--color-knownCount)')}
                {gradient('fillDiscoveryDuration', 'var(--color-durationMin)')}
              </defs>
              <ChartAxes hide={isPhoneScreen} />
              <AreaSeries dataKey="learningCount" gradientId="fillLearning" />
              <AreaSeries dataKey="knownCount" gradientId="fillKnown" />
              <AreaSeries dataKey="durationMin" gradientId="fillDiscoveryDuration" />
            </AreaChart>
          </ChartContainer>
        </StatisticsChartCard>

        <StatisticsChartCard
          title="Learning Activity"
          description="Daily tasks completed, retries, showcases, mistakes made, hints viewed, and time spent"
        >
          <ChartContainer config={learningChartConfig} className="min-h-52 w-full">
            <AreaChart accessibilityLayer data={learningPerDay}>
              <defs>
                {gradient('fillTasks', 'var(--color-completedTasks)')}
                {gradient('fillRetries', 'var(--color-completedRetries)')}
                {gradient('fillShowcases', 'var(--color-completedShowcases)')}
                {gradient('fillMistakes', 'var(--color-mistakesMade)')}
                {gradient('fillHints', 'var(--color-hintsViewed)')}
                {gradient('fillLearningDuration', 'var(--color-durationMin)')}
              </defs>
              <ChartAxes hide={isPhoneScreen} />
              <AreaSeries dataKey="completedTasks" gradientId="fillTasks" />
              <AreaSeries dataKey="completedRetries" gradientId="fillRetries" />
              <AreaSeries dataKey="completedShowcases" gradientId="fillShowcases" />
              <AreaSeries dataKey="mistakesMade" gradientId="fillMistakes" />
              <AreaSeries dataKey="hintsViewed" gradientId="fillHints" />
              <AreaSeries dataKey="durationMin" gradientId="fillLearningDuration" />
            </AreaChart>
          </ChartContainer>
        </StatisticsChartCard>

        <StatisticsChartCard
          title="AI Cost"
          description="Daily spend, input tokens, and output tokens for AI generations"
        >
          <ChartContainer config={costChartConfig} className="min-h-52 w-full">
            <AreaChart accessibilityLayer data={costPerDay}>
              <defs>
                {gradient('fillCost', 'var(--color-costInDollars)')}
                {gradient('fillInputTokens', 'var(--color-inputTokens)')}
                {gradient('fillOutputTokens', 'var(--color-outputTokens)')}
              </defs>
              <ChartAxes hide={isPhoneScreen} />
              <AreaSeries dataKey="costInDollars" gradientId="fillCost" />
              <AreaSeries dataKey="inputTokens" gradientId="fillInputTokens" />
              <AreaSeries dataKey="outputTokens" gradientId="fillOutputTokens" />
            </AreaChart>
          </ChartContainer>
        </StatisticsChartCard>

        <StatisticsChartCard title="Updated" description="Daily items updated">
          <ChartContainer config={itemsUpdatedChartConfig} className="min-h-52 w-full">
            <AreaChart accessibilityLayer data={itemsUpdatedPerDay}>
              <defs>{gradient('fillUaTranslation', 'var(--color-uaTranslation)')}</defs>
              <ChartAxes hide={isPhoneScreen} />
              <AreaSeries dataKey="uaTranslation" gradientId="fillUaTranslation" />
            </AreaChart>
          </ChartContainer>
        </StatisticsChartCard>
      </div>

      <RankedVocabularyTable
        title="Most Mistaken Items"
        description="Items that need more practice based on mistake frequency"
        countLabel="Mistakes"
        emptyMessage="No mistakes recorded yet. Keep practicing!"
        items={data.topMistakes}
        variant="mistakes"
      />

      <RankedVocabularyTable
        title="Most Hinted Items"
        description="Items you needed help with most frequently"
        countLabel="Hints"
        emptyMessage="No hints viewed yet. Try using hints when you need help!"
        items={data.topHintedItems}
        variant="hints"
      />
    </div>
  );
};
