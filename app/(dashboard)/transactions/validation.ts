import {
    type DoubleEntryValidationIssue,
    validateAccountOperation,
} from '@/lib/double-entry-validation';
import type { ResponseType } from './columns';

export type ValidationIssue = {
    type:
        | 'customer'
        | 'account'
        | 'account-closed'
        | 'documents'
        | 'documents-status-block'
        | 'double-entry';
    message: string;
    severity: 'warning' | 'error';
    explanation?: string;
    doubleEntryIssue?: DoubleEntryValidationIssue;
};

/**
 * Gets the document requirement message based on settings
 */
function getDocumentRequirementMessage(
    attachedRequiredTypes: number,
    requiredDocumentTypes: number,
    minRequiredDocuments: number,
): string {
    if (minRequiredDocuments === 0) {
        // All required types needed
        const missing = requiredDocumentTypes - attachedRequiredTypes;
        return `Missing ${missing} required document type${missing > 1 ? 's' : ''}. Attach all required documents before reconciling this transaction.`;
    } else {
        // At least N required
        const needed = Math.min(minRequiredDocuments, requiredDocumentTypes);
        return `Need at least ${needed} of ${requiredDocumentTypes} required document type${requiredDocumentTypes > 1 ? 's' : ''} attached (currently ${attachedRequiredTypes}). Attach required documents before reconciling this transaction.`;
    }
}

/**
 * Validates a transaction and returns any validation issues found.
 * This centralized validation logic makes it easy to add, update, or adjust validation rules.
 */
export function validateTransaction(
    transaction: ResponseType,
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Customer validation: Check if transaction has a customer reference but no linked customer
    const hasPayee = !!transaction.payee;
    const hasCustomer = !!transaction.payeeCustomerName;

    if (hasPayee && !hasCustomer) {
        issues.push({
            type: 'customer',
            message:
                'Customer not linked. This transaction has a payee but no associated customer record.',
            severity: 'warning',
        });
    } else if (!hasPayee && !hasCustomer) {
        issues.push({
            type: 'customer',
            message:
                'No customer information. This transaction has no payee or customer data.',
            severity: 'warning',
        });
    }

    // Account validation: Check if any accounts involved are closed/inactive
    if (transaction.account && transaction.accountIsOpen === false) {
        issues.push({
            type: 'account-closed',
            message: `Account "${transaction.account}" is closed/inactive.`,
            severity: 'warning',
        });
    }

    if (
        transaction.creditAccount &&
        transaction.creditAccountIsOpen === false
    ) {
        issues.push({
            type: 'account-closed',
            message: `Credit account "${transaction.creditAccount}" is closed/inactive.`,
            severity: 'warning',
        });
    }

    if (transaction.debitAccount && transaction.debitAccountIsOpen === false) {
        issues.push({
            type: 'account-closed',
            message: `Debit account "${transaction.debitAccount}" is closed/inactive.`,
            severity: 'warning',
        });
    }

    // Account type validation: Check if credit/debit accounts match their type requirements
    if (
        transaction.creditAccount &&
        transaction.creditAccountType === 'debit'
    ) {
        issues.push({
            type: 'account',
            message: `Credit account "${transaction.creditAccount}" is debit-only and should not be used as a credit account.`,
            severity: 'error',
        });
    }

    if (transaction.debitAccount && transaction.debitAccountType === 'credit') {
        issues.push({
            type: 'account',
            message: `Debit account "${transaction.debitAccount}" is credit-only and should not be used as a debit account.`,
            severity: 'error',
        });
    }

    // Document validation: Check if required documents are attached
    // Only warn if transaction is not in draft status and has required document types defined
    if (
        transaction.status !== 'draft' &&
        transaction.requiredDocumentTypes !== undefined &&
        transaction.requiredDocumentTypes > 0 &&
        !transaction.hasAllRequiredDocuments
    ) {
        const minRequired = transaction.minRequiredDocuments ?? 0;
        issues.push({
            type: 'documents',
            message: getDocumentRequirementMessage(
                transaction.attachedRequiredTypes ?? 0,
                transaction.requiredDocumentTypes,
                minRequired,
            ),
            severity: 'warning',
        });
    }

    // Smart double-entry validation: Check if operations match account classes
    const isDraft = transaction.status === 'draft';
    const isClosingOrAdjustment = false; // TODO: Detect closing entries based on tags or notes

    // Validate credit account operation
    if (transaction.creditAccount && transaction.creditAccountId) {
        const creditIssue = validateAccountOperation(
            transaction.creditAccountClass,
            'credit',
            transaction.creditAccountId,
            transaction.creditAccount,
            isDraft,
            isClosingOrAdjustment,
        );

        if (creditIssue) {
            issues.push({
                type: 'double-entry',
                message: creditIssue.message,
                severity: creditIssue.severity,
                explanation: creditIssue.explanation,
                doubleEntryIssue: creditIssue,
            });
        }
    }

    // Validate debit account operation
    if (transaction.debitAccount && transaction.debitAccountId) {
        const debitIssue = validateAccountOperation(
            transaction.debitAccountClass,
            'debit',
            transaction.debitAccountId,
            transaction.debitAccount,
            isDraft,
            isClosingOrAdjustment,
        );

        if (debitIssue) {
            issues.push({
                type: 'double-entry',
                message: debitIssue.message,
                severity: debitIssue.severity,
                explanation: debitIssue.explanation,
                doubleEntryIssue: debitIssue,
            });
        }
    }

    return issues;
}

/**
 * Checks if a transaction has any validation issues.
 */
export function hasValidationIssues(transaction: ResponseType): boolean {
    return validateTransaction(transaction).length > 0;
}

/**
 * Gets a formatted message for all validation issues.
 */
export function getValidationMessage(transaction: ResponseType): string {
    const issues = validateTransaction(transaction);
    if (issues.length === 0) return '';

    return issues.map((issue) => issue.message).join('\n');
}

/**
 * Checks if a transaction has missing required documents.
 */
export function hasMissingRequiredDocuments(
    transaction: ResponseType,
): boolean {
    return (
        transaction.status !== 'draft' &&
        transaction.requiredDocumentTypes !== undefined &&
        transaction.requiredDocumentTypes > 0 &&
        !transaction.hasAllRequiredDocuments
    );
}

/**
 * Checks if status progression should be blocked due to missing documents.
 * This is used to prevent advancing to "reconciled" status without required documents.
 */
export function canProgressToStatus(
    transaction: ResponseType,
    targetStatus: 'draft' | 'pending' | 'completed' | 'reconciled',
): { canProgress: boolean; blockedReason?: string } {
    // Only block when trying to progress to "reconciled" status
    if (targetStatus !== 'reconciled') {
        return { canProgress: true };
    }

    // Check if transaction has required document types defined
    if (
        !transaction.requiredDocumentTypes ||
        transaction.requiredDocumentTypes === 0
    ) {
        return { canProgress: true };
    }

    // Check if document requirements are met
    if (transaction.hasAllRequiredDocuments) {
        return { canProgress: true };
    }

    // Documents are missing - block reconciliation
    const minRequired = transaction.minRequiredDocuments ?? 0;
    const attachedCount = transaction.attachedRequiredTypes ?? 0;
    const totalRequired = transaction.requiredDocumentTypes;

    let message: string;
    if (minRequired === 0) {
        const missing = totalRequired - attachedCount;
        message = `Cannot reconcile. Missing ${missing} required document type${missing > 1 ? 's' : ''}. Please attach all required documents.`;
    } else {
        const needed = Math.min(minRequired, totalRequired);
        message = `Cannot reconcile. Need at least ${needed} of ${totalRequired} required document type${totalRequired > 1 ? 's' : ''} attached (currently ${attachedCount}).`;
    }

    return { canProgress: false, blockedReason: message };
}

/**
 * Gets document requirement status info for UI display.
 */
export function getDocumentRequirementStatus(transaction: ResponseType): {
    isBlocked: boolean;
    attachedCount: number;
    requiredCount: number;
    minRequired: number;
    message: string;
} {
    const attachedCount = transaction.attachedRequiredTypes ?? 0;
    const requiredCount = transaction.requiredDocumentTypes ?? 0;
    const minRequired = transaction.minRequiredDocuments ?? 0;
    const isBlocked = requiredCount > 0 && !transaction.hasAllRequiredDocuments;

    let message = '';
    if (requiredCount > 0) {
        if (minRequired === 0) {
            message = isBlocked
                ? `${attachedCount}/${requiredCount} required document types attached`
                : `All ${requiredCount} required document type${requiredCount > 1 ? 's' : ''} attached`;
        } else {
            const needed = Math.min(minRequired, requiredCount);
            message = isBlocked
                ? `${attachedCount}/${needed} required (of ${requiredCount} types)`
                : `Document requirement met (${attachedCount} of ${needed} minimum)`;
        }
    }

    return { isBlocked, attachedCount, requiredCount, minRequired, message };
}
