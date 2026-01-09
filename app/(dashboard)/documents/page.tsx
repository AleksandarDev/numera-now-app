'use client';

import { format } from 'date-fns';
import {
    Download,
    FileText,
    Link2,
    Loader2,
    Plus,
    Search,
    Trash2,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { DatePicker } from '@/components/date-picker';
import { DocumentDropzone } from '@/components/document-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useCreateStandaloneDocument } from '@/features/documents/api/use-create-standalone-document';
import { useGetAllDocuments } from '@/features/documents/api/use-get-all-documents';
import {
    useDeleteDocument,
    useGetDocumentTypes,
} from '@/features/transactions/api/use-documents';
import { useOpenTransaction } from '@/features/transactions/hooks/use-open-transaction';
import { client } from '@/lib/hono';

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
    const [showUploadSheet, setShowUploadSheet] = useState(false);
    const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
    const [showUnattachedOnly, setShowUnattachedOnly] = useState(false);
    const [dateFrom, setDateFrom] = useState<Date | undefined>();
    const [dateTo, setDateTo] = useState<Date | undefined>();
    const [searchQuery, setSearchQuery] = useState('');

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

    // Filter documents by search query
    const filteredDocuments = (documentsQuery.data ?? []).filter((doc) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            doc.fileName.toLowerCase().includes(query) ||
            doc.documentTypeName?.toLowerCase().includes(query) ||
            doc.transactionPayee?.toLowerCase().includes(query)
        );
    });

    const handleDownload = async (documentId: string) => {
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
    };

    const handleDelete = async (documentId: string) => {
        if (!confirm('Are you sure you want to delete this document?')) return;

        try {
            await deleteDocument.mutateAsync(documentId);
            toast.success('Document deleted successfully');
        } catch (error) {
            console.error('Delete error:', error);
            toast.error('Failed to delete document');
        }
    };

    const handleViewTransaction = (transactionId: string) => {
        openTransaction(transactionId, 'documents');
    };

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
                            <div className="flex-1 min-w-[200px]">
                                <Label className="sr-only">Search</Label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Search documents..."
                                        value={searchQuery}
                                        onChange={(e) =>
                                            setSearchQuery(e.target.value)
                                        }
                                        className="pl-9"
                                    />
                                </div>
                            </div>

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

                    {/* Documents Table */}
                    {documentsQuery.isLoading ? (
                        <div className="flex h-[300px] items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredDocuments.length === 0 ? (
                        <div className="flex h-[300px] flex-col items-center justify-center text-center">
                            <FileText className="h-12 w-12 text-muted-foreground/50" />
                            <p className="mt-4 text-lg font-medium text-muted-foreground">
                                No documents found
                            </p>
                            <p className="text-sm text-muted-foreground/70">
                                Upload your first document to get started
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>File Name</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Size</TableHead>
                                        <TableHead>Uploaded</TableHead>
                                        <TableHead>Transaction</TableHead>
                                        <TableHead className="text-right">
                                            Actions
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredDocuments.map((doc) => (
                                        <TableRow key={doc.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                                    <span className="truncate max-w-[200px]">
                                                        {doc.fileName}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {doc.documentTypeName ||
                                                    'Unknown'}
                                            </TableCell>
                                            <TableCell>
                                                {formatFileSize(doc.fileSize)}
                                            </TableCell>
                                            <TableCell>
                                                {format(
                                                    new Date(doc.uploadedAt),
                                                    'MMM d, yyyy',
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {doc.transactionId ? (
                                                    <Button
                                                        variant="link"
                                                        size="sm"
                                                        className="h-auto p-0"
                                                        onClick={() =>
                                                            handleViewTransaction(
                                                                doc.transactionId as string,
                                                            )
                                                        }
                                                    >
                                                        <Link2 className="mr-1 h-3 w-3" />
                                                        {doc.transactionDate
                                                            ? format(
                                                                  new Date(
                                                                      doc.transactionDate,
                                                                  ),
                                                                  'MMM d',
                                                              )
                                                            : 'View'}
                                                        {doc.transactionPayee &&
                                                            ` - ${doc.transactionPayee.slice(0, 15)}...`}
                                                    </Button>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">
                                                        Not attached
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            handleDownload(
                                                                doc.id,
                                                            )
                                                        }
                                                        title="Download"
                                                    >
                                                        <Download className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() =>
                                                            handleDelete(doc.id)
                                                        }
                                                        disabled={
                                                            deleteDocument.isPending
                                                        }
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
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
