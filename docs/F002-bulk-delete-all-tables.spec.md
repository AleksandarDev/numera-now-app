# F002: Bulk Delete for All Tables

## Feature Overview

Extend the bulk delete functionality currently implemented in the transactions table to all other data tables (accounts, categories, customers) that already have row selection capabilities but lack bulk delete functionality.

## Current State Analysis

- **Transactions**: ✅ Has full bulk delete implementation with toggle mode
  - `bulkDeleteMode` state in page component
  - Select column conditional rendering
  - `useBulkDeleteTransactions` hook
  - Backend `/bulk-delete` API endpoint
  - Proper validation and user authorization
  
- **Categories**: ⚠️ Has partial implementation
  - DataTable with `onDelete` handler
  - `useBulkDeleteCategories` hook exists
  - Backend `/bulk-delete` endpoint exists
  - Missing: Bulk delete mode toggle/UI control
  
- **Accounts**: ❌ Missing bulk delete
  - Has row selection UI (checkboxes visible)
  - No bulk delete mode toggle
  - No `useBulkDeleteAccounts` hook
  - No backend bulk delete endpoint
  
- **Customers**: ❌ Missing bulk delete
  - Has `onDelete={() => {}}` stub
  - No bulk delete functionality
  - No backend bulk delete endpoint

## User Story

As a user managing my financial data, I want to delete multiple records at once from any data table (accounts, categories, customers) so that I can efficiently clean up or reorganize my data without having to delete items one by one.

## Requirements

### UI Requirements (All Tables)

1. **Bulk Delete Mode Toggle**
   - Add a dropdown menu with "Bulk delete" / "Cancel bulk delete" option
   - Similar to transactions page implementation
   - Located in CardHeader actions area
   - Toggle button shows current state

2. **Visual Indicators**
   - Select column (checkboxes) appears only in bulk delete mode
   - Selected rows are highlighted
   - Delete button becomes enabled when rows are selected
   - Loading state during delete operation

3. **User Confirmation**
   - Confirmation dialog before executing bulk delete
   - Show count of items to be deleted
   - Warning about data loss (especially for accounts with transactions)

### Functional Requirements

#### Accounts Table

1. Create `useBulkDeleteAccounts` hook
2. Implement backend `/bulk-delete` endpoint in accountsRoutes
3. Add bulk delete mode state management
4. Ensure proper cascade handling (accounts may have associated transactions)
5. Validation: Prevent deletion of accounts with reconciled transactions
6. Update account balance calculations after deletion

#### Categories Table

1. Complete UI implementation with bulk delete mode toggle
2. Verify existing `useBulkDeleteCategories` hook functionality
3. Add bulk delete mode state to page component
4. Test cascade behavior (transactions with deleted categories should set categoryId to null)

#### Customers Table

1. Create `useBulkDeleteCustomers` hook
2. Implement backend `/bulk-delete` endpoint in customersRoutes
3. Replace `onDelete={() => {}}` stub with actual implementation
4. Add bulk delete mode state management
5. Handle cascade behavior for transactions linked to customers

### Backend Requirements

All bulk delete endpoints must:

- Accept array of IDs: `{ ids: string[] }`
- Validate user authorization for each record
- Use transactions for atomic operations
- Return deleted record count
- Implement proper error handling
- Log bulk delete operations for audit trail

### Data Integrity Requirements

1. **Authorization**: Verify user owns all records before deletion
2. **Cascading Rules**:
   - Accounts: Set to null in related transactions, or prevent if reconciled
   - Categories: Set to null in related transactions
   - Customers: Set to null in related transactions
3. **Atomic Operations**: All deletes in a batch succeed or all fail
4. **Cache Invalidation**: Update all relevant query caches
5. **Balance Recalculation**: Trigger for accounts and summary data

## Technical Implementation

### Frontend Pattern (Per Table)

```tsx
const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
const bulkDeleteMutation = useBulkDelete[Entity]();

// In dropdown menu
<DropdownMenuItem onClick={() => setBulkDeleteMode(!bulkDeleteMode)}>
  {bulkDeleteMode ? 'Cancel bulk delete' : 'Bulk delete'}
</DropdownMenuItem>

// In DataTable
<DataTable
  columns={bulkDeleteMode ? [selectColumn, ...columns] : columns}
  onDelete={bulkDeleteMode ? handleBulkDelete : undefined}
  // ... other props
/>
```

### Backend Pattern (Per Entity)

```typescript
.post('/bulk-delete',
  clerkMiddleware(),
  zValidator('json', z.object({ ids: z.array(z.string()) })),
  async (ctx) => {
    // 1. Authenticate
    // 2. Validate ownership
    // 3. Execute delete with CTE for authorization
    // 4. Return results
  }
)
```

## Acceptance Criteria

- [ ] Accounts page has bulk delete mode toggle
- [ ] Accounts can be bulk deleted with proper validation
- [ ] Accounts with reconciled transactions cannot be deleted
- [ ] Categories page has bulk delete mode toggle UI
- [ ] Categories can be bulk deleted (existing hook integrated)
- [ ] Customers page has bulk delete mode toggle
- [ ] Customers can be bulk deleted
- [ ] All tables show select column only in bulk delete mode
- [ ] Confirmation dialog appears before deletion
- [ ] Error messages are clear and specific
- [ ] Success toasts show number of items deleted
- [ ] Related transactions properly handle null foreign keys
- [ ] All query caches are invalidated appropriately
- [ ] Bulk delete operations are atomic (all or nothing)
- [ ] Unauthorized deletion attempts are blocked

## Testing Checklist

- [ ] Delete single item in bulk mode
- [ ] Delete multiple items in bulk mode
- [ ] Attempt to delete items from another user (should fail)
- [ ] Cancel bulk delete mode without deleting
- [ ] Verify cascade behavior for each entity type
- [ ] Test error handling for failed deletions
- [ ] Verify UI state during loading
- [ ] Check that summary data updates correctly
- [ ] Test with items that have dependencies
- [ ] Verify audit trail / logging

## Migration Notes

- No database schema changes required
- Implement accounts and customers endpoints first
- Complete categories UI to match transactions pattern
- Consider adding soft delete in future for better audit trail

## Future Enhancements

- Undo/restore recently deleted items
- Bulk archive instead of delete for better data retention
- Bulk operations menu (edit, export, etc.)
- Advanced filtering before bulk delete
- Keyboard shortcuts for bulk operations
