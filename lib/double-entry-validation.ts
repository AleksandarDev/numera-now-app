/**
 * Smart Validation for Double-Entry Bookkeeping
 *
 * This module provides validation logic to enforce/recommend correct double-entry
 * operations based on account classes and normal balance rules.
 */

import { type AccountClass, NORMAL_BALANCES } from './accounting';

/**
 * Validation severity levels
 * - warning: Unusual but potentially valid (e.g., closing entries, corrections)
 * - error: Invalid operation that should be blocked (unless draft or override)
 */
export type ValidationSeverity = 'warning' | 'error';

/**
 * Validation issue structure
 */
export interface DoubleEntryValidationIssue {
    type: 'debit-credit-mismatch' | 'contra-balance-operation';
    accountId: string;
    accountName?: string;
    accountClass: AccountClass;
    operation: 'debit' | 'credit';
    severity: ValidationSeverity;
    message: string;
    explanation: string;
}

/**
 * Get explanation for normal balance of an account class
 */
export function getNormalBalanceExplanation(
    accountClass: AccountClass,
): string {
    const explanations: Record<AccountClass, string> = {
        asset: `Asset accounts have a debit normal balance. Debits increase assets (e.g., receiving cash, purchasing equipment). Credits decrease assets (e.g., spending cash, depreciation).`,
        expense: `Expense accounts have a debit normal balance. Debits increase expenses (e.g., recording costs). Credits decrease expenses (e.g., expense reversals, refunds).`,
        liability: `Liability accounts have a credit normal balance. Credits increase liabilities (e.g., taking a loan, accounts payable). Debits decrease liabilities (e.g., paying off debt).`,
        equity: `Equity accounts have a credit normal balance. Credits increase equity (e.g., owner contributions, retained earnings). Debits decrease equity (e.g., owner withdrawals, losses).`,
        income: `Income/Revenue accounts have a credit normal balance. Credits increase income (e.g., sales, service revenue). Debits decrease income (e.g., sales returns, discounts).`,
    };

    return explanations[accountClass];
}

/**
 * Get short explanation for a specific operation on an account class
 */
export function getOperationExplanation(
    accountClass: AccountClass,
    operation: 'debit' | 'credit',
): string {
    const normalBalance = NORMAL_BALANCES[accountClass];
    const isNormalOperation = normalBalance === operation;

    if (isNormalOperation) {
        // Normal operation
        const increases: Record<AccountClass, string> = {
            asset: 'This debit increases the asset account (normal operation).',
            expense:
                'This debit increases the expense account (normal operation).',
            liability:
                'This credit increases the liability account (normal operation).',
            equity: 'This credit increases the equity account (normal operation).',
            income: 'This credit increases the income account (normal operation).',
        };
        return increases[accountClass];
    }

    // Contra operation
    const decreases: Record<AccountClass, string> = {
        asset: 'This credit decreases the asset account. This is normal for payments, sales, or depreciation.',
        expense:
            'This credit decreases the expense account. This might be for expense reversals or refunds.',
        liability:
            'This debit decreases the liability account. This is normal for debt payments.',
        equity: 'This debit decreases the equity account. This might be for owner withdrawals or losses.',
        income: 'This debit decreases the income account. This might be for sales returns, discounts, or closing entries.',
    };
    return decreases[accountClass];
}

/**
 * Validate a debit or credit operation against an account class
 *
 * @param accountClass - The account class
 * @param operation - Whether this is a debit or credit operation
 * @param accountId - The account ID (for issue tracking)
 * @param accountName - Optional account name (for better error messages)
 * @param isDraft - Whether the transaction is a draft (affects severity)
 * @param isClosingOrAdjustment - Whether this is a closing entry or adjustment (affects severity)
 * @returns Validation issue if any, or null if valid
 */
export function validateAccountOperation(
    accountClass: AccountClass | null | undefined,
    operation: 'debit' | 'credit',
    accountId: string,
    accountName?: string,
    isDraft: boolean = false,
    isClosingOrAdjustment: boolean = false,
): DoubleEntryValidationIssue | null {
    // Skip validation if account class is not set
    if (!accountClass) {
        return null;
    }

    const normalBalance = NORMAL_BALANCES[accountClass];
    const isNormalOperation = normalBalance === operation;

    // If it's a normal operation, no issue
    if (isNormalOperation) {
        return null;
    }

    // It's a contra operation - determine severity
    // Certain account classes with contra operations are more unusual than others
    const accountLabel = accountName ? `"${accountName}"` : 'Account';

    // Income being debited or Expense being credited are highly unusual
    // (except for closing entries or corrections)
    if (
        (accountClass === 'income' && operation === 'debit') ||
        (accountClass === 'expense' && operation === 'credit')
    ) {
        // If it's a closing/adjustment entry, treat as warning
        // Otherwise, it's a potential error
        const severity: ValidationSeverity =
            isClosingOrAdjustment || isDraft ? 'warning' : 'error';

        const operationText = operation === 'debit' ? 'debited' : 'credited';
        const message =
            accountClass === 'income'
                ? `${accountLabel} is an income account being ${operationText}. Income accounts should normally be credited.`
                : `${accountLabel} is an expense account being ${operationText}. Expense accounts should normally be debited.`;

        return {
            type: 'debit-credit-mismatch',
            accountId,
            accountName,
            accountClass,
            operation,
            severity,
            message,
            explanation: getOperationExplanation(accountClass, operation),
        };
    }

    // For assets, liabilities, and equity with contra operations,
    // these are often valid (paying off debt, spending cash, etc.)
    // So we only show a soft warning
    const operationText = operation === 'debit' ? 'debited' : 'credited';
    const expectedText =
        normalBalance === 'debit' ? 'typically debited' : 'typically credited';

    return {
        type: 'contra-balance-operation',
        accountId,
        accountName,
        accountClass,
        operation,
        severity: 'warning',
        message: `${accountLabel} is ${operationText}. This account is ${expectedText} (${accountClass} account).`,
        explanation: getOperationExplanation(accountClass, operation),
    };
}

/**
 * Validate a complete transaction (with credit and debit entries)
 *
 * @param entries - Array of transaction entries with account info
 * @param isDraft - Whether the transaction is a draft
 * @param isClosingOrAdjustment - Whether this is a closing entry or adjustment
 * @returns Array of validation issues
 */
export function validateTransactionEntries(
    entries: Array<{
        accountId: string;
        accountName?: string;
        accountClass: AccountClass | null | undefined;
        operation: 'debit' | 'credit';
        amount: number;
    }>,
    isDraft: boolean = false,
    isClosingOrAdjustment: boolean = false,
): DoubleEntryValidationIssue[] {
    const issues: DoubleEntryValidationIssue[] = [];

    for (const entry of entries) {
        const issue = validateAccountOperation(
            entry.accountClass,
            entry.operation,
            entry.accountId,
            entry.accountName,
            isDraft,
            isClosingOrAdjustment,
        );

        if (issue) {
            issues.push(issue);
        }
    }

    return issues;
}

/**
 * Check if a transaction has any blocking validation issues
 * (errors that should prevent submission unless draft or override)
 */
export function hasBlockingIssues(
    issues: DoubleEntryValidationIssue[],
): boolean {
    return issues.some((issue) => issue.severity === 'error');
}

/**
 * Get a user-friendly summary of validation issues
 */
export function getValidationSummary(
    issues: DoubleEntryValidationIssue[],
): string {
    if (issues.length === 0) return '';

    const errors = issues.filter((i) => i.severity === 'error');
    const warnings = issues.filter((i) => i.severity === 'warning');

    const parts: string[] = [];

    if (errors.length > 0) {
        parts.push(
            `${errors.length} validation error${errors.length > 1 ? 's' : ''}`,
        );
    }

    if (warnings.length > 0) {
        parts.push(
            `${warnings.length} warning${warnings.length > 1 ? 's' : ''}`,
        );
    }

    return parts.join(', ');
}
