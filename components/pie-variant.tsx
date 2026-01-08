import {
    Cell,
    Legend,
    type LegendProps,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';

import { formatPercentage } from '@/lib/utils';

import { CategoryTooltip } from './category-tooltip';

const COLORS = ['#0062FF', '#12C6FF', '#FF647F', '#FF9354'];

type PieVariantProps = {
    data: {
        name: string;
        value: number;
        percent?: number;
    }[];
};

type PieChartLegendPayload = NonNullable<LegendProps['payload']>[number];

export const PieVariant = ({ data }: PieVariantProps) => {
    return (
        <ResponsiveContainer width="100%" height={350}>
            <PieChart>
                <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="right"
                    iconType="circle"
                    content={({ payload }) => {
                        return (
                            <ul className="flex flex-col space-y-2">
                                {payload?.map(
                                    (entry: PieChartLegendPayload) => {
                                        const payloadData = entry.payload as {
                                            percent?: number;
                                        };
                                        return (
                                            <li
                                                key={`legend-${entry.value}`}
                                                className="flex items-center space-x-2"
                                            >
                                                <span
                                                    className="size-2 rounded-full"
                                                    style={{
                                                        backgroundColor:
                                                            entry.color,
                                                    }}
                                                    aria-hidden
                                                />

                                                <div className="space-x-1">
                                                    <span className="text-sm text-muted-foreground">
                                                        {entry.value}
                                                    </span>

                                                    <span className="text-sm">
                                                        {formatPercentage(
                                                            (payloadData.percent ??
                                                                0) * 100,
                                                        )}
                                                    </span>
                                                </div>
                                            </li>
                                        );
                                    },
                                )}
                            </ul>
                        );
                    }}
                />

                <Tooltip
                    content={({ active, payload }) => (
                        <CategoryTooltip active={active} payload={payload} />
                    )}
                />

                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={60}
                    paddingAngle={2}
                    fill="#8884d8"
                    dataKey="value"
                    labelLine={false}
                >
                    {data.map((entry, index) => (
                        <Cell
                            key={`cell-${entry.name}`}
                            fill={COLORS[index % COLORS.length]}
                        />
                    ))}
                </Pie>
            </PieChart>
        </ResponsiveContainer>
    );
};
