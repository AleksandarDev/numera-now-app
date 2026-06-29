import type { db } from '../db/drizzle';
import { auditEvents } from '../db/schema';
import {
    type AuditEventInput,
    buildAuditEventValues,
    runAuditedMutation,
} from './audit-core';

export * from './audit-core';

type AuditDb = typeof db;

export const writeAuditEvent = async (
    database: Pick<AuditDb, 'insert'>,
    input: AuditEventInput,
) => {
    const [event] = await database
        .insert(auditEvents)
        .values(buildAuditEventValues(input))
        .returning();

    return event;
};

export const withAuditTransaction = async <Result>(
    database: Partial<{
        transaction: <TransactionResult>(
            callback: (tx: AuditDb) => Promise<TransactionResult>,
        ) => Promise<TransactionResult>;
    }>,
    callback: (tx: AuditDb) => Promise<Result>,
) => runAuditedMutation(database, callback);
