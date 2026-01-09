import { cn } from '@/lib/utils';

type TagBadgeProps = {
    name: string;
    color?: string | null;
    size?: 'sm' | 'md';
    className?: string;
};

export const TagBadge = ({
    name,
    color,
    size = 'sm',
    className,
}: TagBadgeProps) => {
    const baseClasses =
        'inline-flex items-center rounded-full font-medium whitespace-nowrap';
    const sizeClasses =
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

    const style = color
        ? {
              backgroundColor: `${color}20`,
              color: color,
              borderColor: color,
          }
        : {};

    return (
        <span
            className={cn(
                baseClasses,
                sizeClasses,
                'border',
                !color && 'bg-blue-100 text-blue-800 border-blue-200',
                className,
            )}
            style={style}
        >
            {name}
        </span>
    );
};
