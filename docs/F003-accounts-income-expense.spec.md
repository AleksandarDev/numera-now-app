# F003: Double-Entry Bookkeeping - Income & Expense Accounts

## Overview

Accounts in double-bookkeeping systems must accurately track income and expenses to ensure financial integrity and compliance. This specification analyzes the current implementation and outlines what's needed for fully functional double-entry bookkeeping with proper account types.

## User Story

As a user managing my finances, I want to create and manage accounts specifically for income and expenses so that I can accurately track my financial transactions and generate reports for budgeting and tax purposes using proper double-entry accounting principles.

---

## Current Implementation Analysis

### ✅ What We Have (Implemented)

#### 1. **Basic Double-Entry Infrastructure**

- Toggle in settings to enable/disable double-entry mode (`doubleEntryMode` setting)
- Transactions support both `creditAccountId` and `debitAccountId` fields
- Validation enforces both accounts when double-entry mode is enabled (except for drafts)
- Account type field: `credit`, `debit`, or `neutral`
- Account type validation prevents misuse (e.g., credit account can't be debit)

#### 2. **Account Structure**

- Hierarchical account structure using `code` field
- Code-based parent-child relationships (e.g., "1" → "11" → "111")
- Visual hierarchy in accounts page with expand/collapse
- Account status: `isOpen` (active/inactive)
- Account protection: `isReadOnly` (prevents transactions)
- Account filtering by type in selectors

#### 3. **Transaction Support**

- Single-entry mode: uses `accountId` + positive/negative amounts
- Double-entry mode: uses `creditAccountId` + `debitAccountId` + positive amounts
- Automatic account opening when used in transactions (including parents)
- Split transactions support double-entry
- Import supports both single and double-entry modes
- Validation warnings for missing credit/debit accounts in UI

#### 4. **Reporting & Summary**

- Income/expense calculation based on amount sign (positive = income, negative = expense)
- Summary queries handle both single and double-entry transactions
- Account balances aggregate across transaction types
- Charts display income vs expenses

---

## ❌ What's Missing for Full Double-Entry Bookkeeping

### 1. **Standard Account Types/Classes**

**Issue**: Only has generic `credit`/`debit`/`neutral` types, not proper accounting categories.

**What's Needed**:

- Account classification following standard accounting equation:
  - **Assets** (Debit normal balance)
  - **Liabilities** (Credit normal balance)
  - **Equity** (Credit normal balance)
  - **Income/Revenue** (Credit normal balance)
  - **Expenses** (Debit normal balance)
  - **Cost of Goods Sold (COGS)** (optional)
  
**Implementation**:

```typescript
// Update schema.ts
accountClass: text('account_class', {
  enum: ['asset', 'liability', 'equity', 'income', 'expense', 'cogs']
}).notNull()

// Derived from class
normalBalance: 'debit' | 'credit' // auto-determined by class
```

### 2. **Normal Balance Logic**

**Issue**: System doesn't understand normal balance behavior for different account types.

**What's Needed**:

- Each account class should have a normal balance (debit or credit)
- Debits increase assets & expenses, decrease liabilities, equity & income
- Credits increase liabilities, equity & income, decrease assets & expenses
- Account balances should reflect proper accounting signs

**Implementation**:

```typescript
const NORMAL_BALANCES = {
  asset: 'debit',
  expense: 'debit',
  liability: 'credit',
  equity: 'credit',
  income: 'credit',
  cogs: 'debit'
} as const;

function calculateAccountBalance(account, transactions) {
  const normalBalance = NORMAL_BALANCES[account.accountClass];
  // Sum debits and credits, apply sign based on normal balance
}
```

### 3. **Chart of Accounts (COA) Management**

**Issue**: No standard COA template or structure enforcement.

**What's Needed**:

- Predefined COA templates (Small Business, Freelance, etc.)
- Industry-standard account numbering (e.g., 1000-1999 = Assets, 2000-2999 = Liabilities)
- Account code validation ensuring proper hierarchy
- Prevent users from creating invalid account structures

**Implementation**:

- COA template seeding on user setup
- Account code regex validation: `/^[1-9]\d{0,3}$/`
- Parent account must exist before creating child
- Standard account codes:
  - 1000-1999: Assets
  - 2000-2999: Liabilities
  - 3000-3999: Equity
  - 4000-4999: Income/Revenue
  - 5000-5999: Cost of Goods Sold
  - 6000-6999: Expenses

### 4. **Mandatory Accounts**

**Issue**: No system accounts that must exist for proper operations.

**What's Needed**:

- Required accounts that cannot be deleted:
  - **Owner's Equity** (3000) - starting capital
  - **Retained Earnings** (3999) - accumulated profit/loss
  - **Opening Balances** (special equity account)
- Automatic end-of-year closing entries
- Income summary account for closing

### 5. **Transaction Journal Entry View**

**Issue**: No proper journal entry format showing debits and credits side-by-side.

**What's Needed**:

- Traditional journal entry display format:

  ```
  Date: 2026-01-08
  Description: Office supplies purchase
  
  Debit:  Expenses - Office Supplies    $500.00
  Credit:   Assets - Cash                      $500.00
  ```

- Ability to create multi-line journal entries
- Journal entry validation (total debits = total credits)
- Transaction history in journal format

### 6. **Trial Balance Report**

**Issue**: No trial balance report to verify debits equal credits.

**What's Needed**:

- Trial Balance report showing:
  - All accounts with balances
  - Debit column vs Credit column
  - Total debits = Total credits verification
  - Date range filtering
  - Export capability

### 7. **Financial Statements**

**Issue**: No proper financial statement generation.

**What's Needed**:

- **Balance Sheet** (Assets = Liabilities + Equity)
  - Assets section (by normal balance)
  - Liabilities section
  - Equity section
  - Date-specific (point in time)
  
- **Income Statement** (Profit & Loss)
  - Revenue section
  - COGS section
  - Gross Profit
  - Expenses section
  - Net Income/Loss
  - Date range (period)
  
- **Cash Flow Statement** (optional, future)

### 8. **Account Balance Calculation**

**Issue**: Current balance calculations don't respect double-entry principles.

**What's Needed**:

```typescript
// Proper account balance considering:
// - Account class normal balance
// - All transactions where account appears as debit OR credit
// - Opening balance
// - Date range for period reporting

interface AccountBalance {
  accountId: string;
  openingBalance: number;
  debitTotal: number;
  creditTotal: number;
  closingBalance: number;
  normalBalance: 'debit' | 'credit';
}
```

### 9. **Opening Balances**

**Issue**: No way to set initial account balances when starting the system.

**What's Needed**:

- Special "Opening Balances" transaction type
- Wizard to set up initial balances for all accounts
- Must balance (total debits = total credits)
- Linked to Owner's Equity or Opening Balance Equity account

### 10. **Account Restrictions**

**Issue**: Insufficient business rules for account usage.

**What's Needed**:

- Prevent transactions between incompatible account types
- Validate transaction makes sense:
  - Income must be credited (not debited)
  - Expenses must be debited (not credited)
  - Asset purchases: Debit Asset, Credit Cash/Liability
- Smart validation messages explaining proper usage

### 11. **Period Closing**

**Issue**: No fiscal year-end or period closing process.

**What's Needed**:

- Fiscal year setup (calendar or custom)
- Year-end closing wizard:
  - Close all income accounts to Income Summary
  - Close all expense accounts to Income Summary
  - Close Income Summary to Retained Earnings
  - Prevent modifications to closed periods
- Period locking mechanism

### 12. **Account Reports**

**Issue**: Limited reporting for accounting analysis.

**What's Needed**:

- **General Ledger** - All transactions per account
- **Account Statement** - Single account activity
- **Transaction Listing** - Searchable transaction log
- **Account Analysis** - Period comparisons
- **Aging Reports** - For receivables/payables (if applicable)

---

## Implementation Priority

### Phase 1: Foundation (Critical)

1. Add `accountClass` field to schema
2. Implement normal balance logic
3. Update account form to select account class
4. Migrate existing accounts (default to appropriate classes)
5. Update balance calculation to respect normal balances

### Phase 2: Structure (High Priority)

1. Implement COA templates
2. Add opening balance feature
3. Create mandatory system accounts
4. Enforce account hierarchy validation

### Phase 3: Reporting (High Priority)

1. Build Trial Balance report
2. Create Balance Sheet
3. Create Income Statement
4. Implement General Ledger view

### Phase 4: Advanced (Medium Priority)

1. Journal entry view/creation
2. Period closing functionality
3. Enhanced account restrictions
4. Account analysis reports

### Phase 5: Polish (Low Priority)

1. COA import/export
2. Multi-currency support
3. Tax reporting features
4. Advanced reconciliation

---

## Database Schema Changes Required

```sql
-- Add account class field
ALTER TABLE accounts ADD COLUMN account_class TEXT;
ALTER TABLE accounts ADD CONSTRAINT account_class_check 
  CHECK (account_class IN ('asset', 'liability', 'equity', 'income', 'expense', 'cogs'));

-- Add normal balance (computed from class but cached for performance)
ALTER TABLE accounts ADD COLUMN normal_balance TEXT;
ALTER TABLE accounts ADD CONSTRAINT normal_balance_check 
  CHECK (normal_balance IN ('debit', 'credit'));

-- Add opening balance field
ALTER TABLE accounts ADD COLUMN opening_balance INTEGER DEFAULT 0;

-- Add account flags
ALTER TABLE accounts ADD COLUMN is_system_account BOOLEAN DEFAULT FALSE;
ALTER TABLE accounts ADD COLUMN allow_transactions BOOLEAN DEFAULT TRUE;

-- Create fiscal periods table (future)
CREATE TABLE fiscal_periods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  is_closed BOOLEAN DEFAULT FALSE,
  closed_at TIMESTAMP,
  closed_by TEXT
);

-- Update account type to be more specific
-- Note: Keep accountType for backward compatibility during migration
```

---

## Configuration Examples

### Standard Account Classes with Codes

```typescript
const STANDARD_ACCOUNTS = {
  // Assets (1000-1999)
  '1000': { name: 'Assets', class: 'asset' },
  '1100': { name: 'Current Assets', class: 'asset', parent: '1000' },
  '1110': { name: 'Cash', class: 'asset', parent: '1100' },
  '1120': { name: 'Bank Account', class: 'asset', parent: '1100' },
  '1200': { name: 'Accounts Receivable', class: 'asset', parent: '1100' },
  
  // Liabilities (2000-2999)
  '2000': { name: 'Liabilities', class: 'liability' },
  '2100': { name: 'Current Liabilities', class: 'liability', parent: '2000' },
  '2110': { name: 'Accounts Payable', class: 'liability', parent: '2100' },
  '2120': { name: 'Credit Card', class: 'liability', parent: '2100' },
  
  // Equity (3000-3999)
  '3000': { name: 'Owner\'s Equity', class: 'equity' },
  '3999': { name: 'Retained Earnings', class: 'equity', parent: '3000' },
  
  // Income (4000-4999)
  '4000': { name: 'Income', class: 'income' },
  '4100': { name: 'Sales Revenue', class: 'income', parent: '4000' },
  '4200': { name: 'Service Revenue', class: 'income', parent: '4000' },
  
  // Expenses (6000-6999)
  '6000': { name: 'Expenses', class: 'expense' },
  '6100': { name: 'Operating Expenses', class: 'expense', parent: '6000' },
  '6110': { name: 'Office Supplies', class: 'expense', parent: '6100' },
  '6120': { name: 'Rent', class: 'expense', parent: '6100' },
};
```

---

## Acceptance Criteria

- [ ] Account class field added to schema and UI
- [ ] Normal balance logic implemented in balance calculations
- [ ] COA template can be applied on setup
- [ ] Opening balances can be set and balance
- [ ] System accounts created and protected
- [ ] Trial Balance report shows correct debits/credits
- [ ] Balance Sheet generates from account balances
- [ ] Income Statement shows revenue minus expenses
- [ ] General Ledger view shows account transactions
- [ ] Account hierarchy enforces valid parent-child relationships
- [ ] Transaction validation respects account classes
- [ ] All reports export to PDF/Excel
- [ ] Existing data migrates without loss
- [ ] Documentation updated with accounting principles

---

## Future Enhancements

- Multi-entity/company support
- Budget vs actual reporting
- Consolidated financial statements
- International Financial Reporting Standards (IFRS) compliance
- Generally Accepted Accounting Principles (GAAP) compliance
- Tax form generation (1099, W-2, etc.)
- Audit trail with immutable transaction history
- Role-based access (accountant, bookkeeper, viewer)
- API for accounting software integration
