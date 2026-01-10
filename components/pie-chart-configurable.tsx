import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { FileSearch, Loader2 } from 'lucide-react';
import { PieVariant } from './pie-variant';
import { RadarVariant } from './radar-variant';
import { RadialVariant } from './radial-variant';

type PieChartConfigurableProps = {
    title: string;
    data?: {
        name: string;
        value: number;
    }[];
    chartType: 'pie' | 'radar' | 'radial';
    isLoading?: boolean;
};

export const PieChartConfigurable = ({
    title,
    data = [],
    chartType,
    isLoading = false,
}: PieChartConfigurableProps) => {
    return (
        <Card>
            <CardHeader className="flex justify-between space-y-2 lg:flex-row lg:items-center lg:space-y-0">
                <CardTitle>{title}</CardTitle>
            </CardHeader>

            <CardContent>
                {isLoading ? (
                    <div className="flex h-[350px] w-full items-center justify-center">
                        <Loader2 className="size-6 animate-spin text-slate-300" />
                    </div>
                ) : data.length === 0 ? (
                    <div className="flex h-[350px] w-full flex-col items-center justify-center gap-y-4">
                        <FileSearch className="size-6 text-muted-foreground" />

                        <p className="text-sm text-muted-foreground">
                            No data for this period.
                        </p>
                    </div>
                ) : (
                    <>
                        {chartType === 'pie' && <PieVariant data={data} />}
                        {chartType === 'radar' && <RadarVariant data={data} />}
                        {chartType === 'radial' && (
                            <RadialVariant data={data} />
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export const PieChartConfigurableLoading = () => {
    return (
        <Card>
            <CardHeader className="flex justify-between space-y-2 lg:flex-row lg:items-center lg:space-y-0">
                <div className="h-8 w-32 animate-pulse rounded bg-slate-200" />
            </CardHeader>

            <CardContent>
                <div className="flex h-[350px] w-full items-center justify-center">
                    <Loader2 className="size-6 animate-spin text-slate-300" />
                </div>
            </CardContent>
        </Card>
    );
};
