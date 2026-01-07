import { ResponseType } from "./columns";

export type ValidationIssue = {
  type: "customer" | "account" | "account-closed" | "documents";
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

  // Account type validation: Check if credit/debit accounts match their type requirements
  if (transaction.creditAccount && transaction.creditAccountType === "debit") {
    issues.push({
      type: "account",
      message: `Credit account "${transaction.creditAccount}" is debit-only and should not be used as a credit account.`,
      severity: "error",
    });
  }

  if (transaction.debitAccount && transaction.debitAccountType === "credit") {
    issues.push({
      type: "account",
      message: `Debit account "${transaction.debitAccount}" is credit-only and should not be used as a debit account.`,
      severity: "error",
    });
  }

  // Document validation: Check if all required documents are attached
  // Only warn if transaction is not in draft status and has required document types defined
  if (transaction.status !== "draft" && 
      transaction.requiredDocumentTypes !== undefined && 
      transaction.requiredDocumentTypes > 0 && 
      !transaction.hasAllRequiredDocuments) {
    const missing = transaction.requiredDocumentTypes - (transaction.attachedRequiredTypes ?? 0);
    issues.push({
      type: "documents",
      message: `Missing ${missing} required document type${missing > 1 ? "s" : ""}. Attach required documents before completing this transaction.`,
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

/**
 * Checks if a transaction has missing required documents.
 */
export function hasMissingRequiredDocuments(transaction: ResponseType): boolean {
  return (
    transaction.status !== "draft" &&
    transaction.requiredDocumentTypes !== undefined &&
    transaction.requiredDocumentTypes > 0 &&
    !transaction.hasAllRequiredDocuments
  );
}
