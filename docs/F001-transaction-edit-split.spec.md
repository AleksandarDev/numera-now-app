# F001: Transaction Edit Split

## Feature Overview

Add the ability to split an existing transaction directly from the edit form, allowing users to break down a single transaction into multiple parts with different categories or accounts.

## User Story

As a user editing a transaction, I want to split it into multiple transactions so that I can accurately categorize different parts of a single payment or receipt.

## Requirements

### UI Components

1. **Split Button**
   - Location: Directly under the amount field in the transaction edit form
   - Label: "Split"
   - Behavior: When clicked, displays the split transaction UI

2. **Split UI**
   - Should mirror the split UI functionality from the create transaction form
   - Must support multiple split items
   - Each split item should include:
     - Amount field
     - Category selector
     - Optional notes/description
   - Total of split amounts must equal the original transaction amount
   - Validation to prevent saving if amounts don't match

### Functional Requirements

1. **Splitting Process**
   - Original transaction is marked as split/archived (not deleted)
   - New transactions are created for each split item
   - All split transactions should reference the original transaction ID
   - Date, payee/customer, and account should be inherited from original transaction
   - Each split transaction can have its own category

2. **Transaction History**
   - Original transaction should show "Split" indicator/status
   - History should track that the transaction was split
   - Should display link/reference to the resulting split transactions
   - Maintain audit trail of the split operation

3. **Data Integrity**
   - Original transaction amount must equal sum of split amounts
   - All split transactions must maintain the same date as original
   - Account balance calculations must remain accurate
   - Split operation should be atomic (all or nothing)

## Acceptance Criteria

- [ ] Split button appears in transaction edit form below amount field
- [ ] Clicking Split button reveals split UI interface
- [ ] Split UI allows adding/removing multiple split items
- [ ] Total validation prevents saving if split amounts don't equal original
- [ ] Original transaction is marked as split after save
- [ ] New transactions are created with correct amounts and categories
- [ ] Transaction history shows split indicator and links to split transactions
- [ ] Account balances remain accurate after split operation

## Technical Considerations

- Database schema may need updates to track split relationships
- Consider transaction isolation for atomic split operations
- Ensure reconciliation logic accounts for split transactions
- Performance: splitting should not cause UI lag or timeout

## Future Enhancements

- Ability to "unsplit" or merge split transactions back
- Quick split templates (e.g., 50/50, percentage-based)
- Visual indication in transaction list for split transactions
