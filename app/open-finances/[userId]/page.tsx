'use client';

import {
    ArrowDownIcon,
    ArrowUpIcon,
    Loader2,
    TrendingUpIcon,
    WalletIcon,
} from 'lucide-react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';

type MetricConfig = {
    enabled: boolean;
    label: string;
    value: string; // Now always provided by the API
};

type ExposedMetrics = {
    revenue?: MetricConfig;
    expenses?: MetricConfig;
    profit?: MetricConfig;
    balance?: MetricConfig;
};

type PublicFinanceData = {
    pageTitle: string | null;
    pageDescription: string | null;
    metrics: ExposedMetrics;
    allowEmbedding: boolean;
};

export default function OpenFinancesPage() {
    const params = useParams();
    const userId = params.userId as string;
    const [data, setData] = useState<PublicFinanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(
                    `/api/open-finances/public/${userId}`,
                );
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to fetch data');
                }
                const result = await response.json();
                setData(result.data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            fetchData();
        }
    }, [userId]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="p-8">
                    <div className="flex items-center space-x-3">
                        <Loader2 className="size-6 animate-spin text-slate-600" />
                        <span className="text-slate-600">
                            Loading financial data...
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="p-8 max-w-md w-full">
                    <div className="text-center space-y-3">
                        <div className="text-6xl">🔒</div>
                        <h1 className="text-2xl font-bold text-slate-800">
                            Not Available
                        </h1>
                        <p className="text-slate-600">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!data) {
        return null;
    }

    const enabledMetrics = Object.entries(data.metrics).filter(
        ([_, config]) => config.enabled,
    );

    // Icon mapping for each metric
    const metricIcons: Record<string, React.ReactNode> = {
        revenue: <ArrowUpIcon className="size-8 text-slate-400" />,
        expenses: <ArrowDownIcon className="size-8 text-slate-400" />,
        profit: <TrendingUpIcon className="size-8 text-slate-400" />,
        balance: <WalletIcon className="size-8 text-slate-400" />,
    };

    return (
        <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center space-y-4">
                    <h1 className="text-4xl font-bold text-slate-900">
                        {data.pageTitle || 'Financial Transparency'}
                    </h1>
                    {data.pageDescription && (
                        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                            {data.pageDescription}
                        </p>
                    )}
                </div>

                {/* Metrics Grid */}
                {enabledMetrics.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {enabledMetrics.map(([key, config]) => (
                            <Card
                                key={key}
                                className="p-6 bg-white hover:shadow-lg transition-shadow"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 space-y-2">
                                        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide">
                                            {config.label}
                                        </h3>
                                        <p className="text-3xl font-bold text-slate-900">
                                            {config.value || 'N/A'}
                                        </p>
                                    </div>
                                    <div className="flex-shrink-0">
                                        {metricIcons[key]}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Card className="p-8 text-center">
                        <p className="text-slate-600">
                            No metrics have been configured for public display.
                        </p>
                    </Card>
                )}

                {/* Real-time data notice */}
                <div className="text-center text-xs text-slate-400 italic">
                    Real-time data calculated from transactions as of{' '}
                    {new Date().toLocaleString()}.
                </div>

                {/* Footer */}
                <a
                    href="https://www.numera.now"
                    className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-8"
                >
                    <span>Powered by</span>
                    <Image
                        alt="Numera Now"
                        src="/NumeraNowLogomarkDark.svg"
                        className="bg-black object-cover"
                        width={20}
                        height={20}
                    />
                </a>
            </div>
        </div>
    );
}
