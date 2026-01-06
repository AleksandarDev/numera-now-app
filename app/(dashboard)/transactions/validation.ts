import { ResponseType } from "./columns";

export type ValidationIssue = {
  type: "customer" | "account" | "account-closed";
  message: string;
  severity: "warning" | "error";
};

/**
 * Validates a transaction and returns any validation issues found.
 * This centralized validation logic makes it easy to add, update, or adjust validation rules.
 */
export function validateTransaction(transaction: ResponseType): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Customer validation: Check if transaction has a customer reference but no linked customer
  const hasPayee = !!transaction.payee;
  const hasCustomer = !!transaction.payeeCustomerName;
  
  if (hasPayee && !hasCustomer) {
    issues.push({
      type: "customer",
      message: "Customer not linked. This transaction has a payee but no associated customer record.",
      severity: "warning",
    });
  } else if (!hasPayee && !hasCustomer) {
    issues.push({
      type: "customer",
      message: "No customer information. This transaction has no payee or customer data.",
      severity: "warning",
    });
  }

  // Account validation: Check if any accounts involved are closed/inactive
  if (transaction.account && transaction.accountIsOpen === false) {
    issues.push({
      type: "account-closed",
      message: `Account "${transaction.account}" is closed/inactive.`,
      severity: "warning",
    });
  }

  if (transaction.creditAccount && transaction.creditAccountIsOpen === false) {
    issues.push({
      type: "account-closed",
      message: `Credit account "${transaction.creditAccount}" is closed/inactive.`,
      severity: "warning",
    });
  }

  if (transaction.debitAccount && transaction.debitAccountIsOpen === false) {
    issues.push({
      type: "account-closed",
      message: `Debit account "${transaction.debitAccount}" is closed/inactive.`,
      severity: "warning",
    });
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
  if (issues.length === 0) return "";
  
  return issues.map(issue => issue.message).join("\n");
}
