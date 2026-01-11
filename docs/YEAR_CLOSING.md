# Year Closing Feature

This feature provides a guided workflow for closing fiscal periods (typically years) in the accounting system.

## Overview

The year closing feature consists of:

1. **Period Locking**: Prevents transactions from being created, modified, or deleted within closed periods
2. **Closing Entries**: Automatically generates journal entries to close income and expense accounts
3. **Wizard Interface**: User-friendly multi-step wizard to guide through the closing process

## Key Components

### Database Schema

#### `accounting_periods` Table
- `id`: Unique identifier
- `userId`: Owner of the period
- `startDate`: Period start date
- `endDate`: Period end date
- `status`: Either 'open' or 'closed'
- `closedAt`: Timestamp when period was closed
- `closedBy`: User who closed the period
- `notes`: Optional notes about the closing
- `createdAt`: Creation timestamp

#### Account Updates
- `systemRole`: Optional field to designate special purpose accounts (profit_and_loss, retained_earnings)

#### Transaction Updates
- `closingPeriodId`: Links closing entry transactions to their period

### API Endpoints

All endpoints are under `/api/accounting-periods`:

- `GET /` - List all accounting periods for the user
- `GET /:id` - Get a specific period
- `POST /` - Create a new period
- `PATCH /:id/close` - Close a period
- `PATCH /:id/reopen` - Reopen a closed period
- `DELETE /:id` - Delete a period
- `POST /preview-closing` - Generate preview of closing entries
- `POST /create-closing-entries` - Create the actual closing entries

### Transaction Locking

Period locking is enforced in:
- `POST /api/transactions` - Creating new transactions
- `PATCH /api/transactions/:id` - Updating transactions
- `DELETE /api/transactions/:id` - Deleting transactions
- `POST /api/transactions/bulk-delete` - Bulk deleting transactions

When a transaction operation is attempted for a date within a closed period, the API returns a 400 error with a descriptive message.

## User Interface

### Year Closing Wizard

Access via: Accounts page > More menu > "Close Year"

#### Step 1: Select Period
- Choose start and end dates for the period to close
- Validates for overlapping periods
- Creates the period record

#### Step 2: Configure Closing
- Select **Profit and Loss Account** (required): Where net results are posted
- Select **Retained Earnings Account** (optional): For final equity transfer
- Choose **Closing Date**: When closing entries are dated (defaults to period end)

#### Step 3: Preview
- Shows totals for:
  - Total Income
  - Total Expenses
  - Net Result (profit/loss)
- Lists number of accounts to be closed
- Allows going back to adjust settings

#### Step 4: Create Entries
- Creates actual closing transactions
- In **double-entry mode**: Creates proper debit/credit journal entries
- In **single-entry mode**: Creates balancing transactions
- All created transactions are marked with the `closingPeriodId`

#### Step 5: Lock Period
- Final confirmation step
- Warns about immutability
- Closes the period and enables locking

## Accounting Logic

### Double-Entry Mode

Closing entries follow standard accounting principles:

1. **Close Income Accounts**:
   - Debit: Income account (to zero it out)
   - Credit: Profit & Loss account

2. **Close Expense Accounts**:
   - Debit: Profit & Loss account
   - Credit: Expense account (to zero it out)

3. **Transfer Net Result** (if Retained Earnings account is specified):
   - If profit: Debit P&L, Credit Retained Earnings
   - If loss: Debit Retained Earnings, Credit P&L

### Single-Entry Mode

1. Create reversing entries for each income/expense account
2. Post the net result to the Profit & Loss account

All entries are grouped using `splitGroupId` and marked as `child` entries.

## Testing Recommendations

### Functional Testing

1. **Period Creation**
   - [ ] Create a period successfully
   - [ ] Attempt to create overlapping periods (should fail)
   - [ ] Create adjacent periods (should succeed)

2. **Transaction Locking**
   - [ ] Create transaction in open period (should succeed)
   - [ ] Create transaction in closed period (should fail)
   - [ ] Edit transaction in closed period (should fail)
   - [ ] Delete transaction in closed period (should fail)
   - [ ] Bulk delete including closed period transactions (should fail)

3. **Closing Preview**
   - [ ] Preview with only income accounts
   - [ ] Preview with only expense accounts
   - [ ] Preview with both (profit scenario)
   - [ ] Preview with both (loss scenario)
   - [ ] Preview with zero balances

4. **Closing Entries**
   - [ ] Create entries in double-entry mode
   - [ ] Create entries in single-entry mode
   - [ ] Verify debits equal credits (double-entry)
   - [ ] Verify accounts are zeroed out
   - [ ] Verify P&L account has correct balance
   - [ ] Verify Retained Earnings transfer (if applicable)

5. **Period Management**
   - [ ] Close a period
   - [ ] Reopen a closed period
   - [ ] Delete an open period
   - [ ] Attempt to delete closed period with transactions

### Edge Cases

- Empty periods (no transactions)
- Periods with only reconciled transactions
- Periods spanning multiple years
- Reopening and re-closing a period
- Accounts without accountClass set
- Read-only accounts in closing

### UI Testing

- [ ] Wizard progresses through all steps
- [ ] Back button works correctly
- [ ] Error messages display properly
- [ ] Loading states show during API calls
- [ ] Success toasts appear
- [ ] Wizard closes on completion
- [ ] Closed period indicator appears (TBD)

## Future Enhancements

- Fiscal year presets (calendar year, fiscal year starting different months)
- Closing entry templates
- Period comparison reports
- Audit log of period changes
- Multi-currency support
- Batch closing for multiple periods
- Depreciation automation
- Accrual/deferral support

## Migration Guide

When deploying this feature:

1. Apply database migration `0036_short_warlock.sql`
2. Ensure all existing transactions have valid dates
3. Consider existing account classifications
4. Test in staging environment first
5. Communicate to users about new capabilities

## Troubleshooting

### "Transaction date in closed period" errors

**Cause**: Attempting to create/edit/delete transactions in a closed period

**Solution**: 
- Check accounting periods list to see what's closed
- Reopen the period if needed
- Adjust transaction date to a different period

### Preview shows zero balances

**Cause**: No transactions or all balances are zero for the period

**Solution**: Verify the period dates and that transactions exist

### "Account class not set" errors

**Cause**: Income or expense accounts missing `accountClass` field

**Solution**: Edit accounts to set proper account class before closing

## Security Considerations

- All API endpoints require authentication
- Period locking is enforced server-side
- Users can only manage their own periods
- Transaction immutability cannot be bypassed

## Performance Notes

- Closing preview queries all transactions in the period
- Large periods with many transactions may take time to process
- Consider batching or pagination for very large datasets
- Indexes on `date` and `userId` fields improve query performance
