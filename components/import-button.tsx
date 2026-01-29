import { Button } from '@signalco/ui-primitives/Button';
import { Import } from 'lucide-react';
import { useCSVReader } from 'react-papaparse';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// Type for CSV reader results - using generic types to allow flexibility
export type CSVResult = {
    data: string[][];
    errors: unknown[];
    meta: unknown[];
};

// Type for getRootProps function result
type RootProps = {
    onClick?: (e: React.MouseEvent) => void;
};

type ImportButtonProps = {
    onUpload: (results: CSVResult) => void;
    variant?: 'button' | 'menu';
    className?: string;
};

// CSV Reader config to handle various formats (semicolon, comma, tab delimiters)
const csvReaderConfig = {
    skipEmptyLines: true,
    // Auto-detect delimiter (handles semicolons, commas, tabs)
    delimiter: '',
};

export const ImportButton = ({
    onUpload,
    variant = 'button',
    className,
}: ImportButtonProps) => {
    const { CSVReader } = useCSVReader();

    const handleUpload = (results: CSVResult) => {
        onUpload(results);
    };

    if (variant === 'menu') {
        return (
            <CSVReader onUploadAccepted={handleUpload} config={csvReaderConfig}>
                {({ getRootProps }: { getRootProps: () => RootProps }) => {
                    const props = getRootProps();
                    return (
                        <DropdownMenuItem
                            className={cn('gap-2 cursor-pointer', className)}
                            onSelect={(e) => {
                                e.preventDefault();
                                if (props.onClick) {
                                    props.onClick(
                                        e as unknown as React.MouseEvent,
                                    );
                                }
                            }}
                        >
                            <Import className="size-4" />
                            Import from CSV
                        </DropdownMenuItem>
                    );
                }}
            </CSVReader>
        );
    }

    return (
        <CSVReader onUploadAccepted={handleUpload} config={csvReaderConfig}>
            {({ getRootProps }: { getRootProps: () => RootProps }) => {
                const props = getRootProps();
                return (
                    <Button
                        size="sm"
                        className={cn('w-full lg:w-auto', className)}
                        onClick={(e) => {
                            if (props.onClick) {
                                props.onClick(e);
                            }
                        }}
                    >
                        <Import className="mr-2 size-4" />
                        Import
                    </Button>
                );
            }}
        </CSVReader>
    );
};
