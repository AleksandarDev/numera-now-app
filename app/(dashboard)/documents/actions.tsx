'use client';

import { Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DocumentActionsProps {
    documentId: string;
    onDownload: (documentId: string) => void;
    onDelete: (documentId: string) => void;
    isDeleting?: boolean;
}

export function DocumentActions({
    documentId,
    onDownload,
    onDelete,
    isDeleting,
}: DocumentActionsProps) {
    return (
        <div className="flex items-center justify-end gap-1" data-row-interactive>
            <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                    e.stopPropagation();
                    onDownload(documentId);
                }}
                title="Download"
            >
                <Download className="h-4 w-4" />
            </Button>
            <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete(documentId);
                }}
                disabled={isDeleting}
                title="Delete"
            >
                <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
        </div>
    );
}
