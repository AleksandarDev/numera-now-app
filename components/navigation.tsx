'use client';

import { Row } from '@signalco/ui-primitives/Row';
import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useMedia } from 'react-use';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { useGetIncompleteCustomersCount } from '@/features/customers/api/use-get-incomplete-count';
import { NavButton } from './nav-button';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

const routes = [
    {
        href: '/',
        label: 'Overview',
    },
    {
        href: '/transactions',
        label: 'Transactions',
    },
    {
        href: '/customers',
        label: 'Customers',
    },
    {
        href: '/accounts',
        label: 'Accounts',
    },
];

const settingsRoute = {
    href: '/settings',
    label: 'Settings',
};

const mobileRoutes = [routes[0], routes[1]]; // Only show Overview and Transactions on mobile

export const Navigation = () => {
    const [isOpen, setIsOpen] = useState(false);

    const pathname = usePathname();
    const isMobile = useMedia('(max-width: 1024px)', false);
    const searchParams = useSearchParams();

    const { data: incompleteCount } = useGetIncompleteCustomersCount();

    if (isMobile) {
        return (
            <Row spacing={1}>
                <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    <SheetTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="font-normal bg-white/10 hover:bg-white/20 hover:text-white border-none focus-visible:ring-offset-0 focus-visible:ring-transparent outline-none text-white focus:bg-white/30 transition"
                            aria-label="Toggle navigation"
                        >
                            <Menu className="size-4" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="px-2">
                        <SheetHeader>
                            <SheetTitle className="hidden">
                                Navigation
                            </SheetTitle>
                            <SheetDescription className="hidden">
                                Quickly navigate to different sections
                            </SheetDescription>
                        </SheetHeader>
                        <nav className="flex flex-col gap-y-2 pt-6">
                            {routes.map((route) => (
                                <Link
                                    key={route.href}
                                    href={{
                                        pathname: route.href,
                                        query: searchParams.toString(),
                                    }}
                                    prefetch
                                >
                                    <Button
                                        variant={
                                            route.href === pathname
                                                ? 'secondary'
                                                : 'ghost'
                                        }
                                        key={route.href}
                                        onClick={() => setIsOpen(false)}
                                        className="w-full justify-start"
                                    >
                                        <span className="flex items-center gap-2">
                                            {route.label}
                                            {route.href === '/customers' &&
                                                incompleteCount !== undefined &&
                                                incompleteCount > 0 && (
                                                    <Badge
                                                        variant="destructive"
                                                        className="ml-1 h-5 min-w-5 flex items-center justify-center px-1.5"
                                                    >
                                                        {incompleteCount}
                                                    </Badge>
                                                )}
                                        </span>
                                    </Button>
                                </Link>
                            ))}
                        </nav>
                    </SheetContent>
                </Sheet>
                {mobileRoutes.map((route) => (
                    <NavButton
                        key={route.href}
                        href={route.href}
                        query={searchParams.toString()}
                        label={route.label}
                        isActive={pathname === route.href}
                        badge={
                            route.href === '/customers'
                                ? incompleteCount
                                : undefined
                        }
                    />
                ))}
            </Row>
        );
    }

    return (
        <nav className="hidden lg:flex items-center gap-x-2 overflow-x-auto">
            {routes.map((route) => (
                <NavButton
                    key={route.href}
                    href={route.href}
                    query={searchParams.toString()}
                    label={route.label}
                    isActive={pathname === route.href}
                    badge={
                        route.href === '/customers'
                            ? incompleteCount
                            : undefined
                    }
                />
            ))}
        </nav>
    );
};

export const SettingsNav = () => {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    return (
        <div className="hidden lg:block">
            <NavButton
                href={settingsRoute.href}
                query={searchParams.toString()}
                label={settingsRoute.label}
                isActive={pathname === settingsRoute.href}
            />
        </div>
    );
};
