/**
 * Double-Entry Bookkeeping - Account Classes & Normal Balances
 *
 * This module provides core accounting logic for double-entry bookkeeping,
 * including account class definitions, normal balance calculations, and
 * trial balance validation.
 */

/**
 * Normal balance type for each account class
 * - Debit normal: Debits increase balance, Credits decrease
 * - Credit normal: Credits increase balance, Debits decrease
 */
export const NORMAL_BALANCES = {
    asset: 'debit',
    expense: 'debit',
    liability: 'credit',
    equity: 'credit',
    income: 'credit',
} as const;

export type AccountClass = keyof typeof NORMAL_BALANCES;
export type NormalBalance = (typeof NORMAL_BALANCES)[AccountClass];

/**
 * Calculate account balance based on its class and transaction totals
 *
 * @param accountClass - The accounting class of the account
 * @param debitTotal - Total of all debit transactions (in miliunits)
 * @param creditTotal - Total of all credit transactions (in miliunits)
 * @returns The account balance (in miliunits)
 *
 * @example
 * // For an asset account (debit normal)
 * calculateAccountBalance('asset', 10000, 3000) // Returns 7000
 *
 * @example
 * // For a liability account (credit normal)
 * calculateAccountBalance('liability', 2000, 5000) // Returns 3000
 */
export function calculateAccountBalance(
    accountClass: AccountClass,
    debitTotal: number,
    creditTotal: number,
): number {
    const normalBalance = NORMAL_BALANCES[accountClass];

    if (normalBalance === 'debit') {
        // Debit normal: Debits increase, Credits decrease
        return debitTotal - creditTotal;
    }
    // Credit normal: Credits increase, Debits decrease
    return creditTotal - debitTotal;
}

/**
 * Check if an account balance is in its normal state (positive)
 * or contra/unusual state (negative)
 *
 * @param balance - The account balance
 * @returns true if the balance is normal (positive)
 */
export function isNormalBalance(balance: number): boolean {
    return balance >= 0;
}

/**
 * Get human-readable label for account class
 */
export const ACCOUNT_CLASS_LABELS: Record<AccountClass, string> = {
    asset: 'Asset',
    liability: 'Liability',
    equity: 'Equity',
    income: 'Income',
    expense: 'Expense',
};

/**
 * Interface for account balance summary
 */
export interface AccountBalanceSummary {
    accountId: string;
    accountName: string;
    accountClass: AccountClass;
    balance: number;
    normalBalance: NormalBalance;
    isNormal: boolean;
}

/**
 * Calculate trial balance check
 *
 * In proper double-entry bookkeeping, total debits should equal total credits.
 * This function checks if the books are balanced.
 *
 * @param accounts - Array of account balance summaries
 * @returns Object with total debits, credits, and balance status
 */
export function calculateTrialBalance(accounts: AccountBalanceSummary[]): {
    totalDebits: number;
    totalCredits: number;
    isBalanced: boolean;
    difference: number;
} {
    let totalDebits = 0;
    let totalCredits = 0;

    for (const account of accounts) {
        const normalBalance = NORMAL_BALANCES[account.accountClass];

        if (normalBalance === 'debit') {
            // For debit-normal accounts, positive balance = debits
            if (account.balance >= 0) {
                totalDebits += account.balance;
            } else {
                // Negative balance for debit account = credits
                totalCredits += Math.abs(account.balance);
            }
        } else {
            // For credit-normal accounts, positive balance = credits
            if (account.balance >= 0) {
                totalCredits += account.balance;
            } else {
                // Negative balance for credit account = debits
                totalDebits += Math.abs(account.balance);
            }
        }
    }

    const difference = totalDebits - totalCredits;
    // Allow for small rounding errors (< 1 cent in miliunits = 10)
    const isBalanced = Math.abs(difference) < 10;

    return {
        totalDebits,
        totalCredits,
        isBalanced,
        difference,
    };
}

/**
 * Suggest account class based on account type
 * This is a helper for migrating from the old accountType system
 *
 * @param accountType - The legacy account type (credit/debit/neutral)
 * @returns Suggested account class or null
 */
export function suggestAccountClass(
    accountType: 'credit' | 'debit' | 'neutral',
): AccountClass | null {
    switch (accountType) {
        case 'debit':
            // Debit accounts are typically assets or expenses
            return 'asset';
        case 'credit':
            // Credit accounts are typically liabilities, equity, or income
            return 'liability';
        default:
            // Can't suggest for neutral accounts
            return null;
    }
}
