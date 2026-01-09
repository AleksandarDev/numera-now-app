import { useOpenTransaction } from '@/features/transactions/hooks/use-open-transaction';
import { cn, getContrastingTextColor } from '@/lib/utils';

type Tag = {
    id: string;
    name: string;
    color?: string | null;
};

type TagsColumnProps = {
    id: string;
    tags: Tag[];
};

export const TagsColumn = ({ id, tags }: TagsColumnProps) => {
    const { onOpen: onOpenTransaction } = useOpenTransaction();

    const onClick = () => {
        onOpenTransaction(id);
    };

    if (!tags || tags.length === 0) {
        return (
            <button
                type="button"
                onClick={onClick}
                className="text-muted-foreground text-sm cursor-pointer hover:underline"
            >
                No tags
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={onClick}
            className="flex flex-wrap gap-1 cursor-pointer"
        >
            {tags.slice(0, 3).map((tag) => (
                <span
                    key={tag.id}
                    className={cn(
                        'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                        'border hover:opacity-80 transition-opacity',
                        'max-w-[100px] overflow-hidden',
                    )}
                    style={{
                        backgroundColor: tag.color ?? '#3b82f6',
                        borderColor: tag.color ?? '#3b82f6',
                        color: tag.color ? getContrastingTextColor(tag.color) : '#ffffff',
                    }}
                    title={tag.name}
                >
                    <span className="truncate">{tag.name}</span>
                </span>
            ))}
            {tags.length > 3 && (
                <span className="text-xs text-muted-foreground">
                    +{tags.length - 3}
                </span>
            )}
        </button>
    );
};
