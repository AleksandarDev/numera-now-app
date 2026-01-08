import {
    BlobSASPermissions,
    BlobServiceClient,
    generateBlobSASQueryParameters,
    StorageSharedKeyCredential,
} from '@azure/storage-blob';

// Lazy initialization of Azure Blob Storage client
let sharedKeyCredential: StorageSharedKeyCredential | null = null;
let blobServiceClient: BlobServiceClient | null = null;
let containerClient: ReturnType<
    BlobServiceClient['getContainerClient']
> | null = null;

function getAzureClients() {
    if (!sharedKeyCredential || !blobServiceClient || !containerClient) {
        const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
        const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
        const containerName =
            process.env.AZURE_STORAGE_CONTAINER_NAME || 'documents';

        if (!accountName || !accountKey) {
            throw new Error(
                'Azure Storage credentials not configured. Please set AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_ACCOUNT_KEY',
            );
        }

        sharedKeyCredential = new StorageSharedKeyCredential(
            accountName,
            accountKey,
        );
        blobServiceClient = new BlobServiceClient(
            `https://${accountName}.blob.core.windows.net`,
            sharedKeyCredential,
        );
        containerClient = blobServiceClient.getContainerClient(containerName);
    }

    return {
        sharedKeyCredential,
        blobServiceClient,
        containerClient,
        accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME ?? '',
        containerName: process.env.AZURE_STORAGE_CONTAINER_NAME || 'documents',
    };
}

export interface UploadOptions {
    userId: string;
    transactionId: string;
    fileName: string;
    fileBuffer: Buffer;
    mimeType: string;
}

export interface DocumentMetadata {
    fileName: string;
    fileSize: number;
    mimeType: string;
    storagePath: string;
    uploadedAt: Date;
}

/**
 * Generate a unique storage path for a document
 */
export function generateStoragePath(
    userId: string,
    transactionId: string,
    fileName: string,
): string {
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `users/${userId}/transactions/${transactionId}/${timestamp}-${sanitizedFileName}`;
}

/**
 * Upload a document to Azure Blob Storage
 */
export async function uploadDocument(
    options: UploadOptions,
): Promise<DocumentMetadata> {
    const { userId, transactionId, fileName, fileBuffer, mimeType } = options;
    const { containerClient } = getAzureClients();

    const storagePath = generateStoragePath(userId, transactionId, fileName);
    const blockBlobClient = containerClient.getBlockBlobClient(storagePath);

    try {
        await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
            blobHTTPHeaders: {
                blobContentType: mimeType,
            },
        });

        return {
            fileName,
            fileSize: fileBuffer.length,
            mimeType,
            storagePath,
            uploadedAt: new Date(),
        };
    } catch (error) {
        console.error('Error uploading document to Azure Storage:', error);
        throw new Error('Failed to upload document');
    }
}

/**
 * Delete a document from Azure Blob Storage
 */
export async function deleteDocument(storagePath: string): Promise<void> {
    const { containerClient } = getAzureClients();
    const blockBlobClient = containerClient.getBlockBlobClient(storagePath);

    try {
        await blockBlobClient.delete();
    } catch (error) {
        console.error('Error deleting document from Azure Storage:', error);
        throw new Error('Failed to delete document');
    }
}

/**
 * Generate a SAS URL for secure download of a document
 * Expires in 1 hour by default
 */
export function generateDownloadUrl(
    storagePath: string,
    expirationMinutes: number = 60,
): string {
    try {
        const { sharedKeyCredential, accountName, containerName } =
            getAzureClients();
        const expiryDate = new Date();
        expiryDate.setMinutes(expiryDate.getMinutes() + expirationMinutes);

        const sasQueryParams = generateBlobSASQueryParameters(
            {
                containerName,
                blobName: storagePath,
                permissions: BlobSASPermissions.parse('r'), // Read-only
                expiresOn: expiryDate,
            },
            sharedKeyCredential,
        );

        const sasUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${storagePath}?${sasQueryParams.toString()}`;

        return sasUrl;
    } catch (error) {
        console.error('Error generating SAS URL:', error);
        throw new Error('Failed to generate download URL');
    }
}

/**
 * Generate a SAS URL for uploading a document directly from the client
 * Expires in 30 minutes by default
 */
export function generateUploadUrl(
    userId: string,
    transactionId: string,
    fileName: string,
    expirationMinutes: number = 30,
): string {
    try {
        const { sharedKeyCredential, accountName, containerName } =
            getAzureClients();
        const storagePath = generateStoragePath(
            userId,
            transactionId,
            fileName,
        );
        const expiryDate = new Date();
        expiryDate.setMinutes(expiryDate.getMinutes() + expirationMinutes);

        const sasQueryParams = generateBlobSASQueryParameters(
            {
                containerName,
                blobName: storagePath,
                permissions: BlobSASPermissions.parse('cw'), // Create, Write
                expiresOn: expiryDate,
            },
            sharedKeyCredential,
        );

        const sasUrl = `https://${accountName}.blob.core.windows.net/${containerName}/${storagePath}?${sasQueryParams.toString()}`;

        return sasUrl;
    } catch (error) {
        console.error('Error generating upload SAS URL:', error);
        throw new Error('Failed to generate upload URL');
    }
}

/**
 * Verify that a storage path belongs to a specific user
 * This is a security check to prevent unauthorized access
 */
export function verifyStoragePathOwnership(
    storagePath: string,
    userId: string,
): boolean {
    return storagePath.startsWith(`users/${userId}/`);
}
