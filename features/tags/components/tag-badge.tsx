import { cn, getContrastingTextColor } from '@/lib/utils';

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
        'inline-flex items-center rounded-full font-medium max-w-[120px] overflow-hidden';
    const sizeClasses =
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

    const style = color
        ? {
              backgroundColor: color,
              color: getContrastingTextColor(color),
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
            title={name}
        >
            <span className="truncate">{name}</span>
        </span>
    );
};
