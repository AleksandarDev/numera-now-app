import { cn, getTagBadgeColors } from '@/lib/utils';

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
        'inline-flex items-center rounded-full font-medium max-w-[100px] overflow-hidden';
    const sizeClasses =
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

    const badgeColors = color ? getTagBadgeColors(color) : null;

    const style = badgeColors
        ? {
              backgroundColor: badgeColors.backgroundColor,
              color: badgeColors.textColor,
          }
        : {};

    return (
        <span
            className={cn(
                baseClasses,
                sizeClasses,
                !color && 'bg-blue-100 text-blue-800',
                className,
            )}
            style={style}
            title={name}
        >
            <span className="truncate">{name}</span>
        </span>
    );
};
