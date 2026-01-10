# Smart Validation for Double-Entry Accounting

This document describes the smart validation feature that enforces and recommends correct double-entry bookkeeping operations.

## Overview

The smart validation system provides real-time feedback when users create or view transactions, helping them understand whether their account usage follows proper double-entry accounting principles.

## Features

### 1. Normal Balance Validation

Each account class has a "normal balance" side:

- **Debit Normal** (increases with debits, decreases with credits):
  - Asset accounts
  - Expense accounts

- **Credit Normal** (increases with credits, decreases with debits):
  - Liability accounts
  - Equity accounts
  - Income/Revenue accounts

The validation system checks if operations match these expectations and provides appropriate feedback.

### 2. Validation Severity Levels

The system uses two severity levels:

- **Warning** (Yellow/Amber): Unusual but potentially valid operations
  - Asset accounts being credited (normal for payments, sales)
  - Liability accounts being debited (normal for debt payments)
  - Equity accounts being debited (might be for withdrawals)
  - Income/Expense accounts with contra operations (might be for corrections or closing)

- **Error** (Red): Highly unusual operations that should be blocked unless draft or override
  - Income accounts being debited (except closing entries)
  - Expense accounts being credited (except corrections)

### 3. User-Friendly Explanations

Each validation issue includes:
- A clear message describing the issue
- An explanation of why it's flagged
- Context about normal vs. contra operations for that account class

### 4. Visual Indicators

Validation badges appear in the transaction list next to accounts:
- Warning indicators (amber) for unusual operations
- Error indicators (red) for potentially incorrect operations
- Hover tooltips with detailed explanations

## Implementation Details

### Core Module: `lib/double-entry-validation.ts`

This module provides:

- `validateAccountOperation()`: Checks if a single debit/credit operation is appropriate for an account class
- `validateTransactionEntries()`: Validates an entire transaction with multiple entries
- `getNormalBalanceExplanation()`: Returns human-readable explanation for an account class
- `getOperationExplanation()`: Returns explanation for a specific operation on an account class

### Integration Points

#### 1. Transaction List (`app/(dashboard)/transactions/`)

- **columns.tsx**: Calls `validateTransaction()` to get issues for each row
- **account-column.tsx**: Displays validation indicators next to credit/debit accounts
- **validation.ts**: Extended to include double-entry validation
- **validation-indicator.tsx**: Updated to show explanations in tooltips

#### 2. Account Form (`features/accounts/components/account-form.tsx`)

- Displays normal balance explanation when an account class is selected
- Helps users understand what operations are expected for their account type

#### 3. API Routes (`app/api/[[...route]]/transactionsRoutes.ts`)

- Extended to include `accountClass` fields for credit and debit accounts
- Enables validation logic to access account class information

## Usage Examples

### Example 1: Normal Operations (No Warnings)

```
Credit: Income Account (Revenue)  →  Amount: $100  →  Debit: Asset Account (Cash)
```

- Income account being credited: ✅ Normal (credits increase income)
- Asset account being debited: ✅ Normal (debits increase assets)

### Example 2: Unusual but Valid Operations (Warnings)

```
Credit: Asset Account (Cash)  →  Amount: $50  →  Debit: Liability Account (Loan)
```

- Asset account being credited: ⚠️ Warning (decreases asset, normal for payments)
- Liability account being debited: ⚠️ Warning (decreases liability, normal for paying off debt)

### Example 3: Highly Unusual Operations (Errors)

```
Credit: Expense Account (Utilities)  →  Amount: $75  →  Debit: Asset Account (Cash)
```

- Expense account being credited: 🔴 Error (expenses should normally be debited)
- Asset account being debited: ✅ Normal

This would be flagged as an error unless:
- The transaction is marked as "draft" (allowing entry to be completed later)
- It's a closing entry or adjustment (can be indicated by specific tags)

## Edge Cases Handled

The validation system is designed to minimize false positives:

1. **Draft Transactions**: Validation is more lenient for draft transactions
2. **Closing Entries**: System can be configured to detect closing entries (currently via tags/notes)
3. **Corrections and Reversals**: Unusual operations are allowed with warnings
4. **Missing Account Classes**: No validation errors if account class is not set (graceful degradation)

## Future Enhancements

Potential improvements to consider:

1. **Smart Detection of Closing Entries**: Automatically detect year-end closing entries
2. **Form-Level Validation**: Show warnings in real-time as users fill out transaction forms
3. **Override Capability**: Allow users to explicitly mark unusual entries as reviewed/correct
4. **Transaction Templates**: Suggest common transaction patterns based on account selections
5. **Batch Validation**: Check consistency across multiple transactions
6. **Configurable Rules**: Allow users to customize validation severity per account

## Testing Recommendations

When testing the smart validation feature:

1. **Test Normal Operations**: Verify no warnings for standard transactions
2. **Test Contra Operations**: Verify appropriate warnings for unusual operations
3. **Test Draft Mode**: Ensure validation is lenient for draft transactions
4. **Test Various Account Classes**: Try all combinations of credit/debit with all account classes
5. **Test Edge Cases**: Closing entries, corrections, split transactions
6. **Test UI Display**: Verify tooltips show correct explanations
7. **Test Performance**: Ensure validation doesn't slow down transaction list rendering

## Configuration

No additional configuration is required. The feature automatically activates when:
- Accounts have their `accountClass` field set
- Transactions reference accounts with account classes
- Double-entry mode may be enabled in settings (but validation works regardless)

## References

- Double-Entry Bookkeeping Specification: See related issue documentation
- Account Classes: `lib/accounting.ts` - `NORMAL_BALANCES` constant
- Account Schema: `db/schema.ts` - `accounts` table definition
