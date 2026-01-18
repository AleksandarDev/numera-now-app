import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

type Props = {
    href: string;
    query?: string;
    label: string;
    icon?: LucideIcon;
    isActive?: boolean;
    badge?: number;
};

export const NavButton = ({
    href,
    query,
    label,
    icon: Icon,
    isActive,
    badge,
}: Props) => {
    return (
        <Link
            href={{
                pathname: href,
                query,
            }}
        >
            <Button
                size="sm"
                variant="outline"
                className={cn(
                    'w-full lg:w-auto justify-between font-normal hover:bg-white/20 hover:text-white border-none focus-visible:ring-offset-0 focus-visible:ring-transparent outline-none text-white focus:bg-white/30 transition',
                    isActive ? 'bg-white/10 text-white' : 'bg-transparent',
                )}
            >
                <span className="flex items-center gap-2">
                    {Icon && <Icon className="size-4" aria-hidden="true" />}
                    {label}
                    {badge !== undefined && badge > 0 && (
                        <Badge
                            variant="destructive"
                            className="ml-1 h-5 min-w-5 flex items-center justify-center px-1.5"
                        >
                            {badge}
                        </Badge>
                    )}
                </span>
            </Button>
        </Link>
    );
};
