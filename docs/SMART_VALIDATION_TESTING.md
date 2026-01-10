# Smart Validation - Manual Testing Guide

This document provides a comprehensive manual testing guide for the smart validation feature.

## Prerequisites

Before testing, ensure:
1. You have accounts with `accountClass` set
2. Double-entry mode may be enabled in settings (though validation works regardless)
3. You have test data with various transaction types

## Test Setup

### Create Test Accounts

Create the following accounts with their classes:

1. **Cash** (Asset, Debit normal)
   - Account Class: Asset
   - Type: Neutral

2. **Revenue** (Income, Credit normal)
   - Account Class: Income
   - Type: Neutral

3. **Utilities Expense** (Expense, Debit normal)
   - Account Class: Expense
   - Type: Neutral

4. **Accounts Payable** (Liability, Credit normal)
   - Account Class: Liability
   - Type: Neutral

5. **Owner's Equity** (Equity, Credit normal)
   - Account Class: Equity
   - Type: Neutral

## Test Cases

### Test Case 1: Normal Revenue Transaction (No Warnings)
**Objective**: Verify that standard income transactions show no validation issues

**Steps**:
1. Create a transaction:
   - Credit: Revenue (Income account)
   - Amount: $100
   - Debit: Cash (Asset account)
2. View transaction in the list

**Expected Result**:
- No validation warnings or errors
- Both accounts display normally without badges

**Verification**:
✅ No warning/error indicators  
✅ Transaction appears normal

---

### Test Case 2: Normal Expense Transaction (No Warnings)
**Objective**: Verify that standard expense transactions show no validation issues

**Steps**:
1. Create a transaction:
   - Credit: Cash (Asset account)
   - Amount: $50
   - Debit: Utilities Expense (Expense account)
2. View transaction in the list

**Expected Result**:
- ⚠️ Warning on Cash (asset being credited)
- No warning on Utilities Expense (expense being debited is normal)

**Verification**:
✅ Warning badge appears on Cash account  
✅ Tooltip explains: "This credit decreases the asset account. This is normal for payments..."  
✅ No warning on Utilities Expense

---

### Test Case 3: Paying Off Liability (Warnings Expected)
**Objective**: Verify warnings appear for contra operations but allow them

**Steps**:
1. Create a transaction:
   - Credit: Cash (Asset account)
   - Amount: $200
   - Debit: Accounts Payable (Liability account)
2. View transaction in the list

**Expected Result**:
- ⚠️ Warning on Cash (asset being credited)
- ⚠️ Warning on Accounts Payable (liability being debited)
- Tooltips explain these are valid operations

**Verification**:
✅ Warning badges appear on both accounts  
✅ Cash tooltip explains payment context  
✅ Accounts Payable tooltip explains debt payment context

---

### Test Case 4: Unusual Income Debit (Error Expected)
**Objective**: Verify errors for highly unusual operations

**Steps**:
1. Create a transaction in draft mode:
   - Credit: Cash (Asset account)
   - Amount: $75
   - Debit: Revenue (Income account)
2. View transaction in the list

**Expected Result**:
- ⚠️ Warning on Cash (asset being credited)
- ⚠️ Warning on Revenue (income being debited - soft warning in draft mode)

**Verification**:
✅ Warning badge appears on Revenue  
✅ Tooltip explains: "Income accounts should normally be credited"  
✅ Since it's draft, shown as warning not error

---

### Test Case 5: Unusual Expense Credit (Error Expected)
**Objective**: Verify errors for highly unusual operations

**Steps**:
1. Create a transaction:
   - Credit: Utilities Expense (Expense account)
   - Amount: $30
   - Debit: Cash (Asset account)
2. Mark as non-draft (pending/completed)
3. View transaction in the list

**Expected Result**:
- 🔴 Error on Utilities Expense (expense being credited)
- No issue on Cash (asset being debited is normal)

**Verification**:
✅ Error badge (red) appears on Utilities Expense  
✅ Tooltip explains this is highly unusual  
✅ No warning on Cash

---

### Test Case 6: Account Form - Normal Balance Display
**Objective**: Verify account form shows normal balance explanations

**Steps**:
1. Open account creation form
2. Select "Asset" as account class
3. Read the displayed explanation

**Expected Result**:
- Info box appears with explanation
- Explains that assets have debit normal balance
- Explains what debits and credits mean for assets

**Verification**:
✅ Info alert displays when class selected  
✅ Explanation is clear and accurate  
✅ Changes when different class selected

**Repeat for each account class**: Asset, Expense, Liability, Equity, Income

---

### Test Case 7: Missing Account Class (Graceful Degradation)
**Objective**: Verify no errors when account class is not set

**Steps**:
1. Create an account without setting account class
2. Use it in a transaction
3. View transaction in the list

**Expected Result**:
- No smart validation warnings/errors
- Existing validation (if any) still works
- No console errors or UI breaks

**Verification**:
✅ No validation badges from smart validation  
✅ UI functions normally  
✅ No errors in browser console

---

### Test Case 8: Draft vs Non-Draft Severity
**Objective**: Verify validation is more lenient for drafts

**Steps**:
1. Create a draft transaction with income being debited
2. Note the validation severity
3. Change status to "Pending"
4. Note if severity changes

**Expected Result**:
- Draft: Warning level (⚠️ amber)
- Non-draft: Should still be warning (income/expense get special handling)

**Verification**:
✅ Draft transactions show warnings  
✅ System allows unusual operations  
✅ Explanations provide context

---

### Test Case 9: Tooltip Content Accuracy
**Objective**: Verify tooltip explanations are accurate and helpful

**Steps**:
1. For each validation badge, hover over it
2. Read the tooltip content
3. Verify it matches the account class and operation

**Expected Elements**:
- Clear primary message
- Secondary explanation text
- Context about normal vs contra operations

**Verification**:
✅ All tooltips display properly  
✅ Explanations are accurate  
✅ Text is readable and understandable

---

### Test Case 10: Performance with Many Transactions
**Objective**: Verify validation doesn't slow down UI

**Steps**:
1. Navigate to transactions list with 50+ transactions
2. Scroll through the list
3. Sort columns
4. Filter transactions

**Expected Result**:
- No noticeable lag or slowdown
- Validation badges render quickly
- Tooltips respond immediately on hover

**Verification**:
✅ UI remains responsive  
✅ No lag when scrolling  
✅ Validation indicators render quickly

---

## Edge Cases to Test

### Edge Case 1: Split Transactions
- Test smart validation on split transactions with multiple entries
- Verify each entry is validated independently

### Edge Case 2: Account Without Name
- Test with accounts that have codes but not descriptive names
- Verify validation messages are still clear

### Edge Case 3: Very Large Amounts
- Test with very large transaction amounts
- Verify formatting doesn't break validation display

### Edge Case 4: Special Characters in Account Names
- Test accounts with special characters, emojis, etc.
- Verify validation messages handle them correctly

## Regression Testing

Ensure existing features still work:

1. **Existing Validation**
   - Customer validation still works
   - Document validation still works
   - Closed account warnings still work

2. **Transaction CRUD**
   - Creating transactions still works
   - Editing transactions still works
   - Deleting transactions still works

3. **Account Management**
   - Creating accounts still works
   - Editing accounts still works
   - Account form validation still works

## Browser Testing

Test in multiple browsers:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if available)

## Accessibility Testing

- [ ] All validation indicators have proper ARIA labels
- [ ] Tooltips are keyboard accessible
- [ ] Color blind users can understand severity (icons + colors)
- [ ] Screen readers can announce validation issues

## Reporting Issues

When reporting issues, include:
1. Test case number
2. Steps to reproduce
3. Expected vs actual behavior
4. Screenshots showing the validation issue
5. Browser and version
6. Console errors (if any)

## Success Criteria

All tests pass when:
- ✅ No false positives on normal operations
- ✅ Appropriate warnings on unusual but valid operations
- ✅ Clear explanations in all tooltips
- ✅ No performance degradation
- ✅ Graceful handling of edge cases
- ✅ No regression in existing features
