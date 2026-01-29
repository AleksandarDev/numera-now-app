'use client';

import { Button } from '@signalco/ui-primitives/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Typography } from '@signalco/ui-primitives/Typography';
import { FileText } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const reports = [
    {
        name: 'Income Statement',
        description:
            'View your income and expenses for a period, with net income calculation.',
        href: '/reports/income-statement',
        icon: FileText,
    },
    {
        name: 'Balance Sheet',
        description:
            'View your assets, liabilities, and equity at a specific date.',
        href: '/reports/balance-sheet',
        icon: FileText,
    },
];

export default function ReportsPage() {
    const searchParams = useSearchParams();

    return (
        <div className="max-w-screen-2xl mx-auto w-full pb-10 -mt-12 lg:-mt-24">
            <Card>
                <CardHeader>
                    <CardTitle>Reports</CardTitle>
                    <Typography level="body2" className="text-muted-foreground">
                        View financial reports for your accounts
                    </Typography>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {reports.map((report) => {
                            const Icon = report.icon;
                            return (
                                <Link
                                    key={report.href}
                                    href={{
                                        pathname: report.href,
                                        query: searchParams.toString(),
                                    }}
                                    prefetch
                                >
                                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                                        <CardHeader>
                                            <div className="flex items-center gap-2">
                                                <Icon className="size-5 text-primary" />
                                                <CardTitle className="text-lg">
                                                    {report.name}
                                                </CardTitle>
                                            </div>
                                            <Typography
                                                level="body2"
                                                className="text-muted-foreground"
                                            >
                                                {report.description}
                                            </Typography>
                                        </CardHeader>
                                        <CardContent>
                                            <Button
                                                variant="outlined"
                                                size="sm"
                                            >
                                                View Report
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </Link>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
