'use client';

import { Archive, FileText, Loader2, Upload } from 'lucide-react';
import { useCallback, useState } from 'react';
import {
    type DropzoneOptions,
    type FileRejection,
    useDropzone,
} from 'react-dropzone';
import { cn } from '@/lib/utils';

interface InvoiceZipDropzoneProps {
    onZipAccepted: (file: File) => void;
    isProcessing?: boolean;
    disabled?: boolean;
    className?: string;
}

const ZIP_ACCEPT: DropzoneOptions['accept'] = {
    'application/zip': ['.zip'],
    'application/x-zip-compressed': ['.zip'],
};

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export function InvoiceZipDropzone({
    onZipAccepted,
    isProcessing = false,
    disabled = false,
    className,
}: InvoiceZipDropzoneProps) {
    const [rejectedFiles, setRejectedFiles] = useState<FileRejection[]>([]);

    const onDrop = useCallback(
        (acceptedFiles: File[], fileRejections: FileRejection[]) => {
            setRejectedFiles(fileRejections);

            if (acceptedFiles.length > 0) {
                // Only accept one ZIP file
                onZipAccepted(acceptedFiles[0]);
            }
        },
        [onZipAccepted],
    );

    const { getRootProps, getInputProps, isDragActive, isDragReject } =
        useDropzone({
            onDrop,
            accept: ZIP_ACCEPT,
            maxFiles: 1,
            maxSize: MAX_SIZE,
            disabled: disabled || isProcessing,
            multiple: false,
        });

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className={cn('space-y-4', className)}>
            {/* Dropzone area */}
            <div
                {...getRootProps()}
                className={cn(
                    'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer',
                    isDragActive &&
                        !isDragReject &&
                        'border-primary bg-primary/5',
                    isDragReject && 'border-destructive bg-destructive/5',
                    !isDragActive &&
                        'border-muted-foreground/25 hover:border-muted-foreground/50',
                    (disabled || isProcessing) &&
                        'cursor-not-allowed opacity-60',
                )}
            >
                <input {...getInputProps()} />

                {isProcessing ? (
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <Loader2 className="h-12 w-12 animate-spin" />
                        <div className="text-center">
                            <p className="text-sm font-medium">
                                Processing ZIP file...
                            </p>
                            <p className="text-xs text-muted-foreground/70">
                                Extracting and parsing invoices
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="relative">
                            <Archive
                                className={cn(
                                    'h-12 w-12',
                                    isDragActive && 'text-primary',
                                )}
                            />
                            <Upload className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-background text-primary" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium">
                                {isDragActive
                                    ? isDragReject
                                        ? 'Only ZIP files are allowed'
                                        : 'Drop ZIP file here'
                                    : 'Import invoices from ZIP'}
                            </p>
                            <p className="text-xs text-muted-foreground/70">
                                Drag & drop or click to browse
                            </p>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground/50">
                            <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                XML invoices
                            </span>
                            <span>•</span>
                            <span>Max {formatFileSize(MAX_SIZE)}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Info text */}
            <div className="text-xs text-muted-foreground space-y-1">
                <p>
                    <strong>Supported formats:</strong> ZIP files containing UBL
                    invoice XML files
                </p>
                <p>
                    Embedded PDF attachments will be automatically extracted and
                    attached to the transaction.
                </p>
            </div>

            {/* Rejected files */}
            {rejectedFiles.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive">
                        File rejected:
                    </p>
                    {rejectedFiles.map(({ file, errors }, index) => (
                        <div
                            key={`${file.name}-${index}`}
                            className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm"
                        >
                            <Archive className="h-4 w-4 text-destructive" />
                            <span className="flex-1 truncate">{file.name}</span>
                            <span className="text-xs text-destructive">
                                {errors.map((e) => e.message).join(', ')}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
