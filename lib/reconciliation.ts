import { db } from "@/db/drizzle";
import { documents, settings, transactions } from "@/db/schema";
import { and, eq, count } from "drizzle-orm";

export type ReconciliationCondition = "hasReceipt" | "isReviewed" | "isApproved";

/**
 * Check if a transaction meets the reconciliation conditions
 */
export async function isTransactionReconciled(
  transactionId: string,
  userId: string
): Promise<boolean> {
  // Get user settings
  const [userSettings] = await db
    .select()
    .from(settings)
    .where(eq(settings.userId, userId));

  if (!userSettings) return false;

  const conditions: ReconciliationCondition[] = JSON.parse(
    userSettings.reconciliationConditions || '["hasReceipt"]'
  );

  // Get transaction
  const [transaction] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId));

  if (!transaction) return false;

  // Check each condition
  for (const condition of conditions) {
    switch (condition) {
      case "hasReceipt": {
        const [docCount] = await db
          .select({ count: count() })
          .from(documents)
          .where(
            and(
              eq(documents.transactionId, transactionId),
              eq(documents.isDeleted, false)
            )
          );

        if (docCount.count === 0) return false;
        break;
      }

      case "isReviewed": {
        // This would require a field on transactions table for review status
        // For now, we'll skip this check
        break;
      }

      case "isApproved": {
        // This would require a field on transactions table for approval status
        // For now, we'll skip this check
        break;
      }
    }
  }

  return true;
}

/**
 * Check if all child transactions in a split group are reconciled
 */
export async function areSplitTransactionsReconciled(
  splitGroupId: string,
  userId: string
): Promise<boolean> {
  // Get all child transactions in the group
  const childTransactions = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.splitGroupId, splitGroupId),
        eq(transactions.splitType, "child")
      )
    );

  // Check if all are reconciled
  for (const tx of childTransactions) {
    const reconciled = await isTransactionReconciled(tx.id, userId);
    if (!reconciled) return false;
  }

  return true;
}

/**
 * Get reconciliation status details for a transaction
 */
export async function getReconciliationStatus(
  transactionId: string,
  userId: string
): Promise<{
  isReconciled: boolean;
  conditions: {
    name: ReconciliationCondition;
    met: boolean;
  }[];
}> {
  const [userSettings] = await db
    .select()
    .from(settings)
    .where(eq(settings.userId, userId));

  if (!userSettings) {
    return {
      isReconciled: false,
      conditions: [],
    };
  }

  const conditionsList: ReconciliationCondition[] = JSON.parse(
    userSettings.reconciliationConditions || '["hasReceipt"]'
  );

  const [transaction] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId));

  if (!transaction) {
    return {
      isReconciled: false,
      conditions: [],
    };
  }

  const conditionStatus = await Promise.all(
    conditionsList.map(async (condition) => {
      let met = false;

      switch (condition) {
        case "hasReceipt": {
          const [docCount] = await db
            .select({ count: count() })
            .from(documents)
            .where(
              and(
                eq(documents.transactionId, transactionId),
                eq(documents.isDeleted, false)
              )
            );

          met = docCount.count > 0;
          break;
        }

        case "isReviewed": {
          // Would need a reviewed field on transactions
          met = false;
          break;
        }

        case "isApproved": {
          // Would need an approved field on transactions
          met = false;
          break;
        }
      }

      return { name: condition, met };
    })
  );

  const isReconciled = conditionStatus.every((c) => c.met);

  return {
    isReconciled,
    conditions: conditionStatus,
  };
}
