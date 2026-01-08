'use client';

import { File, Loader2, Upload, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import {
    type DropzoneOptions,
    type FileRejection,
    useDropzone,
} from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PendingFile {
    file: File;
    id: string;
    preview?: string;
}

interface DocumentDropzoneProps {
    onFilesAccepted: (files: File[]) => void;
    isUploading?: boolean;
    maxFiles?: number;
    maxSize?: number; // in bytes
    accept?: DropzoneOptions['accept'];
    disabled?: boolean;
    className?: string;
}

const DEFAULT_ACCEPT = {
    'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
        '.docx',
    ],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        '.xlsx',
    ],
    'text/csv': ['.csv'],
};

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function DocumentDropzone({
    onFilesAccepted,
    isUploading = false,
    maxFiles = 10,
    maxSize = DEFAULT_MAX_SIZE,
    accept = DEFAULT_ACCEPT,
    disabled = false,
    className,
}: DocumentDropzoneProps) {
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const [rejectedFiles, setRejectedFiles] = useState<FileRejection[]>([]);

    const onDrop = useCallback(
        (acceptedFiles: File[], fileRejections: FileRejection[]) => {
            setRejectedFiles(fileRejections);

            if (acceptedFiles.length > 0) {
                // Create pending files with unique IDs
                const newPendingFiles: PendingFile[] = acceptedFiles.map(
                    (file) => ({
                        file,
                        id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                        preview: file.type.startsWith('image/')
                            ? URL.createObjectURL(file)
                            : undefined,
                    }),
                );

                setPendingFiles((prev) => [...prev, ...newPendingFiles]);
            }
        },
        [],
    );

    const handleRemovePending = useCallback((id: string) => {
        setPendingFiles((prev) => {
            const file = prev.find((f) => f.id === id);
            if (file?.preview) {
                URL.revokeObjectURL(file.preview);
            }
            return prev.filter((f) => f.id !== id);
        });
    }, []);

    const handleUploadAll = useCallback(() => {
        if (pendingFiles.length === 0) return;

        const files = pendingFiles.map((pf) => pf.file);
        onFilesAccepted(files);

        // Clean up previews
        pendingFiles.forEach((pf) => {
            if (pf.preview) {
                URL.revokeObjectURL(pf.preview);
            }
        });
        setPendingFiles([]);
        setRejectedFiles([]);
    }, [pendingFiles, onFilesAccepted]);

    const { getRootProps, getInputProps, isDragActive, isDragReject } =
        useDropzone({
            onDrop,
            accept,
            maxFiles,
            maxSize,
            disabled: disabled || isUploading,
            multiple: true,
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
                    'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer',
                    isDragActive &&
                        !isDragReject &&
                        'border-primary bg-primary/5',
                    isDragReject && 'border-destructive bg-destructive/5',
                    !isDragActive &&
                        'border-muted-foreground/25 hover:border-muted-foreground/50',
                    (disabled || isUploading) &&
                        'cursor-not-allowed opacity-60',
                )}
            >
                <input {...getInputProps()} />

                {isUploading ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-10 w-10 animate-spin" />
                        <p className="text-sm font-medium">Uploading...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Upload
                            className={cn(
                                'h-10 w-10',
                                isDragActive && 'text-primary',
                            )}
                        />
                        <div className="text-center">
                            <p className="text-sm font-medium">
                                {isDragActive
                                    ? isDragReject
                                        ? 'Some files are not allowed'
                                        : 'Drop files here'
                                    : 'Drag & drop files here'}
                            </p>
                            <p className="text-xs text-muted-foreground/70">
                                or click to browse
                            </p>
                        </div>
                        <p className="text-xs text-muted-foreground/50">
                            Max {formatFileSize(maxSize)} per file • PDF,
                            images, documents
                        </p>
                    </div>
                )}
            </div>

            {/* Rejected files */}
            {rejectedFiles.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive">
                        Some files were rejected:
                    </p>
                    {rejectedFiles.map(({ file, errors }, index) => (
                        <div
                            key={`${file.name}-${index}`}
                            className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm"
                        >
                            <File className="h-4 w-4 text-destructive" />
                            <span className="flex-1 truncate">{file.name}</span>
                            <span className="text-xs text-destructive">
                                {errors.map((e) => e.message).join(', ')}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Pending files list */}
            {pendingFiles.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                            {pendingFiles.length} file
                            {pendingFiles.length !== 1 ? 's' : ''} ready to
                            upload
                        </p>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    pendingFiles.forEach((pf) => {
                                        if (pf.preview)
                                            URL.revokeObjectURL(pf.preview);
                                    });
                                    setPendingFiles([]);
                                }}
                                disabled={isUploading}
                            >
                                Clear all
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleUploadAll}
                                disabled={isUploading}
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="mr-2 h-4 w-4" />
                                        Upload all
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {pendingFiles.map((pf) => (
                            <div
                                key={pf.id}
                                className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2"
                            >
                                {pf.preview ? (
                                    // biome-ignore lint/performance/noImgElement: In memory preview
                                    <img
                                        src={pf.preview}
                                        alt={pf.file.name}
                                        className="h-10 w-10 rounded object-cover"
                                    />
                                ) : (
                                    <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                                        <File className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                        {pf.file.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatFileSize(pf.file.size)}
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemovePending(pf.id)}
                                    disabled={isUploading}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
