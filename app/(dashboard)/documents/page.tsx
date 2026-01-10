'use client';

import type { Row } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data-table';
import { DatePicker } from '@/components/date-picker';
import { DocumentDropzone } from '@/components/document-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useCreateStandaloneDocument } from '@/features/documents/api/use-create-standalone-document';
import { useGetAllDocuments } from '@/features/documents/api/use-get-all-documents';
import {
    useDeleteDocument,
    useGetDocumentTypes,
} from '@/features/transactions/api/use-documents';
import { useOpenTransaction } from '@/features/transactions/hooks/use-open-transaction';
import { client } from '@/lib/hono';
import { getColumns, type ResponseType } from './columns';

export default function DocumentsPage() {
    const [showUploadSheet, setShowUploadSheet] = useState(false);
    const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
    const [showUnattachedOnly, setShowUnattachedOnly] = useState(false);
    const [dateFrom, setDateFrom] = useState<Date | undefined>();
    const [dateTo, setDateTo] = useState<Date | undefined>();

    const { onOpen: openTransaction } = useOpenTransaction();

    const { data: documentTypes = [] } = useGetDocumentTypes();

    const documentsQuery = useGetAllDocuments({
        documentTypeId:
            selectedTypeFilter !== 'all' ? selectedTypeFilter : undefined,
        from: dateFrom?.toISOString(),
        to: dateTo?.toISOString(),
        unattached: showUnattachedOnly,
    });

    const deleteDocument = useDeleteDocument();
    const documents = documentsQuery.data || [];
    const isInitialLoading = documentsQuery.isLoading;
    const isDeleting = deleteDocument.isPending;

    const handleDownload = useCallback(async (documentId: string) => {
        try {
            const response = await client.api.documents[':id'][
                'download-url'
            ].$get({
                param: { id: documentId },
            });

            if (!response.ok) {
                throw new Error('Failed to get download URL');
            }

            const { data } = await response.json();
            window.open(data.downloadUrl, '_blank');
        } catch (error) {
            console.error('Download error:', error);
            toast.error('Failed to download document');
        }
    }, []);

    const handleDelete = useCallback(
        async (documentId: string) => {
            if (!confirm('Are you sure you want to delete this document?'))
                return;

            try {
                await deleteDocument.mutateAsync(documentId);
                toast.success('Document deleted successfully');
            } catch (error) {
                console.error('Delete error:', error);
                toast.error('Failed to delete document');
            }
        },
        [deleteDocument],
    );

    const handleRowClick = (row: Row<ResponseType>) => {
        const doc = row.original;
        if (doc.transactionId) {
            openTransaction(doc.transactionId, 'documents');
        }
    };

    const columns = useMemo(
        () =>
            getColumns({
                onDownload: handleDownload,
                onDelete: handleDelete,
                isDeleting,
            }),
        [isDeleting, handleDownload, handleDelete],
    );

    const skeletonColumns = useMemo(
        () =>
            columns.map((column) => ({
                ...column,
                cell: () => (
                    <Skeleton className="h-[14px] w-[100%] rounded-sm" />
                ),
            })),
        [columns],
    );

    const tableColumns = isInitialLoading ? skeletonColumns : columns;
    const tableData = isInitialLoading
        ? (Array.from({ length: 10 }, () => ({})) as ResponseType[])
        : documents;

    return (
        <div className="mx-auto -mt-24 w-full max-w-screen-2xl pb-10">
            <Card className="border-none drop-shadow-sm">
                <CardHeader className="gap-y-2 lg:flex-row lg:items-center lg:justify-between">
                    <CardTitle className="line-clamp-1 text-xl">
                        Documents
                    </CardTitle>
                    <Button onClick={() => setShowUploadSheet(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Upload Document
                    </Button>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="mb-6 space-y-4">
                        <div className="flex flex-wrap gap-4">
                            <div className="w-[180px]">
                                <Label className="sr-only">Document Type</Label>
                                <Select
                                    value={selectedTypeFilter}
                                    onValueChange={setSelectedTypeFilter}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="All types" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            All types
                                        </SelectItem>
                                        {documentTypes.map((type) => (
                                            <SelectItem
                                                key={type.id}
                                                value={type.id}
                                            >
                                                {type.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="w-[180px]">
                                <DatePicker
                                    value={dateFrom}
                                    onChange={setDateFrom}
                                />
                            </div>

                            <div className="w-[180px]">
                                <DatePicker
                                    value={dateTo}
                                    onChange={setDateTo}
                                />
                            </div>

                            <Button
                                variant={
                                    showUnattachedOnly ? 'default' : 'outline'
                                }
                                onClick={() =>
                                    setShowUnattachedOnly(!showUnattachedOnly)
                                }
                            >
                                {showUnattachedOnly
                                    ? 'Showing Unattached'
                                    : 'Show Unattached Only'}
                            </Button>
                        </div>
                    </div>

                    {/* Documents Table with Pagination */}
                    <DataTable
                        filterKey="fileName"
                        filterPlaceholder="Search documents..."
                        paginationKey="documents"
                        autoResetPageIndex={false}
                        columns={tableColumns}
                        data={tableData}
                        disabled={isInitialLoading || isDeleting}
                        loading={isDeleting}
                        onRowClick={handleRowClick}
                    />
                </CardContent>
            </Card>

            {/* Upload Sheet */}
            <UploadDocumentSheet
                open={showUploadSheet}
                onOpenChange={setShowUploadSheet}
                documentTypes={documentTypes}
            />
        </div>
    );
}

interface UploadDocumentSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    documentTypes: Array<{ id: string; name: string }>;
}

function UploadDocumentSheet({
    open,
    onOpenChange,
    documentTypes,
}: UploadDocumentSheetProps) {
    const [selectedTypeId, setSelectedTypeId] = useState<string>('');
    const createDocument = useCreateStandaloneDocument();

    const handleFilesAccepted = useCallback(
        async (files: File[]) => {
            if (files.length === 0) return;

            if (!selectedTypeId) {
                toast.error('Please select a document type first');
                return;
            }

            for (const file of files) {
                try {
                    await createDocument.mutateAsync({
                        documentTypeId: selectedTypeId,
                        file,
                    });
                } catch (error) {
                    console.error('Upload error:', error);
                }
            }

            setSelectedTypeId('');
            onOpenChange(false);
        },
        [selectedTypeId, createDocument, onOpenChange],
    );

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Upload Document</SheetTitle>
                    <SheetDescription>
                        Upload a standalone document that can be linked to
                        transactions later.
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                    <div className="space-y-2">
                        <Label>Document Type</Label>
                        <Select
                            value={selectedTypeId}
                            onValueChange={setSelectedTypeId}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a document type" />
                            </SelectTrigger>
                            <SelectContent>
                                {documentTypes.map((type) => (
                                    <SelectItem key={type.id} value={type.id}>
                                        {type.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <DocumentDropzone
                        onFilesAccepted={handleFilesAccepted}
                        isUploading={createDocument.isPending}
                        disabled={!selectedTypeId}
                    />

                    {!selectedTypeId && (
                        <p className="text-sm text-muted-foreground">
                            Please select a document type before uploading.
                        </p>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
