import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { FileSearch, Loader2 } from 'lucide-react';
import { AreaVariant } from './area-variant';
import { BarVariant } from './bar-variant';
import { LineVariant } from './line-variant';

type ChartConfigurableProps = {
    title: string;
    data?: {
        date: string;
        income: number;
        expenses: number;
    }[];
    chartType: 'area' | 'bar' | 'line';
    isLoading?: boolean;
};

export const ChartConfigurable = ({
    title,
    data = [],
    chartType,
    isLoading = false,
}: ChartConfigurableProps) => {
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
                        {chartType === 'area' && <AreaVariant data={data} />}
                        {chartType === 'bar' && <BarVariant data={data} />}
                        {chartType === 'line' && <LineVariant data={data} />}
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export const ChartConfigurableLoading = ({ title }: { title: string }) => {
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
