import { useOpenTransaction } from '@/features/transactions/hooks/use-open-transaction';
import { cn } from '@/lib/utils';

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
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        'border hover:opacity-80 transition-opacity',
                    )}
                    style={{
                        backgroundColor: tag.color
                            ? `${tag.color}20`
                            : '#dbeafe',
                        borderColor: tag.color ?? '#3b82f6',
                        color: tag.color ?? '#1e40af',
                    }}
                >
                    {tag.name}
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
