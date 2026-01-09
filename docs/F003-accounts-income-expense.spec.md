# F003: Double-Entry Bookkeeping - Account Classes & Normal Balances

## Overview

This specification defines the MVP requirements for proper double-entry bookkeeping support. The app uses **Accounts as the Chart of Accounts (COA)** and **Transactions** instead of traditional journals. This approach simplifies the user experience while maintaining accounting integrity.

## User Story

As a user managing my finances with double-entry bookkeeping, I want accounts to have proper accounting classifications (asset, liability, equity, income, expense) so that balances are calculated correctly and I can generate accurate financial reports.

---

## Current Implementation ✅

### What We Have (Solid Foundation)

| Feature | Status | Notes |
|---------|--------|-------|
| Double-entry mode toggle | ✅ | `doubleEntryMode` setting |
| Credit/Debit account fields | ✅ | `creditAccountId` + `debitAccountId` on transactions |
| Account type filtering | ✅ | `accountType`: credit/debit/neutral |
| Hierarchical COA | ✅ | `code` field with parent-child relationships |
| Account controls | ✅ | `isOpen`, `isReadOnly` |
| Split transactions | ✅ | Compound entries supported |
| Validation | ✅ | Enforces both accounts in double-entry mode |
| Import support | ✅ | Both single and double-entry modes |

---

## MVP Requirements

### 1. Account Class Field (Critical) ⬜

**Problem**: Only has generic `credit`/`debit`/`neutral` types, not proper accounting categories.

**Solution**: Add `accountClass` enum to accounts schema:

| Class | Normal Balance | Increases With | Examples |
|-------|---------------|----------------|----------|
| `asset` | Debit | Debit | Cash, Bank, Inventory, Equipment |
| `liability` | Credit | Credit | Loans, Accounts Payable, Credit Cards |
| `equity` | Credit | Credit | Owner's Capital, Retained Earnings |
| `income` | Credit | Credit | Sales, Service Revenue, Interest Income |
| `expense` | Debit | Debit | Rent, Utilities, Salaries, Supplies |

**Implementation**:

```typescript
// db/schema.ts
accountClass: text('account_class', {
  enum: ['asset', 'liability', 'equity', 'income', 'expense']
})
```

**Notes**:

- Field is nullable for backward compatibility
- COGS (Cost of Goods Sold) can be treated as expense class
- Normal balance is derived from class (not stored)

---

### 2. Normal Balance Logic (Critical) ⬜

**Problem**: Current balance calculations use `amount >= 0` for income — that's single-entry logic.

**Solution**: Calculate balances based on account class and debit/credit position:

```typescript
// lib/accounting.ts
export const NORMAL_BALANCES = {
  asset: 'debit',
  expense: 'debit',
  liability: 'credit',
  equity: 'credit',
  income: 'credit',
} as const;

export type AccountClass = keyof typeof NORMAL_BALANCES;

export function calculateAccountBalance(
  accountClass: AccountClass,
  debitTotal: number,
  creditTotal: number
): number {
  const normalBalance = NORMAL_BALANCES[accountClass];
  
  if (normalBalance === 'debit') {
    // Debit normal: Debits increase, Credits decrease
    return debitTotal - creditTotal;
  } else {
    // Credit normal: Credits increase, Debits decrease
    return creditTotal - debitTotal;
  }
}
```

**UI Display**:

- Show on account detail page
- Indicate if balance is normal or contra

**Balance Calculation Rules**:

- For **debit-normal accounts** (assets, expenses): Balance = Debits − Credits
- For **credit-normal accounts** (liabilities, equity, income): Balance = Credits − Debits
- Positive balance = normal; Negative balance = contra/unusual

---

### 3. Account Form Update (Critical) ⬜

**Problem**: No UI to select account class.

**Solution**: Add account class dropdown to account form:

- Show dropdown when double-entry mode is enabled
- Options: Asset, Liability, Equity, Income, Expense
- Display warning if account has no class assigned (in double-entry mode)
- Auto-suggest class based on account type (credit → liability/equity/income, debit → asset/expense)

---

### 4. Validation & Warnings (High Priority) ⬜

**Problem**: No indication when accounts are misconfigured.

**Solution**:

- Show warning badge on accounts page for accounts missing `accountClass` (when double-entry enabled)
- Show warning in transaction form if selected account has no class
- Prevent non-draft transactions from using accounts without class (optional, can be soft warning)

---

### 5. Opening Balances (High Priority) ⬜

**Problem**: No way to set initial account balances when starting the system.

**Solution**: Add `openingBalance` field to accounts schema:

```typescript
openingBalance: integer('opening_balance').default(0)
```

**Notes**:

- Simple integer field (in miliunits like amounts)
- Applied as starting point for balance calculations
- Alternative: Use a special "Opening Balance" transaction — but field is simpler for MVP

---

### 6. Trial Balance Check (High Priority) ⬜

**Problem**: No verification that debits equal credits.

**Solution**: Add trial balance summary/check:

- Sum all debit balances vs all credit balances
- Display warning if they don't match
- Can be shown as a dedicated report page

```typescript
// Simple trial balance check
const debitAccounts = accounts.filter(a => 
  NORMAL_BALANCES[a.accountClass] === 'debit'
);
const creditAccounts = accounts.filter(a => 
  NORMAL_BALANCES[a.accountClass] === 'credit'
);

const totalDebits = sum(debitAccounts.map(a => a.balance));
const totalCredits = sum(creditAccounts.map(a => a.balance));
const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;
```

---

## Database Schema Changes

```sql
-- Add account class field (nullable for backward compatibility)
ALTER TABLE accounts ADD COLUMN account_class TEXT;

-- Add opening balance field
ALTER TABLE accounts ADD COLUMN opening_balance INTEGER DEFAULT 0;

-- Note: Keep existing accountType field for credit/debit filtering in UI
```

**Drizzle migration**:

```typescript
// drizzle/0023_add_account_class.sql
ALTER TABLE accounts ADD COLUMN account_class TEXT;
ALTER TABLE accounts ADD COLUMN opening_balance INTEGER DEFAULT 0;
```

---

## Implementation Checklist

### MVP (Required for Double-Entry)

- [ ] Add `accountClass` field to schema
- [ ] Add `openingBalance` field to schema
- [ ] Create migration file
- [ ] Add `NORMAL_BALANCES` constant and helper functions
- [ ] Update account form with class dropdown (when double-entry enabled)
- [ ] Update account form with opening balance input
- [ ] Show warning indicator for accounts missing class
- [ ] Update balance calculation to use account class
- [ ] Add trial balance check to dashboard or summary

### Post-MVP (Nice to Have)

- [ ] Income Statement report (sum income − sum expenses)
- [ ] Balance Sheet report (assets = liabilities + equity)
- [ ] General Ledger view per account
- [ ] Period closing functionality
- [ ] COA import with class mapping
- [ ] Smart validation (income should be credited, expenses debited)

---

## Out of Scope (Future)

| Feature | Reason |
|---------|--------|
| COA templates | Users create their own accounts |
| Mandatory system accounts | Not required for basic operation |
| Journal entries | We use transactions instead |
| Period/fiscal year closing | Advanced feature |
| Multi-currency | Separate feature |
| Tax reports | Separate feature |
| IFRS/GAAP compliance | Enterprise feature |

---

## Acceptance Criteria

- [ ] `accountClass` field added to accounts schema
- [ ] `openingBalance` field added to accounts schema
- [ ] Account form shows class dropdown when double-entry mode enabled
- [ ] Account form shows opening balance input
- [ ] Accounts without class show warning indicator (in double-entry mode)
- [ ] Balance calculations use normal balance logic based on class
- [ ] Trial balance check shows if books are balanced
- [ ] Existing accounts continue to work (nullable class field)
- [ ] Migration runs without data loss
