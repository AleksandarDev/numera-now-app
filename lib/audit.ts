import type { db } from '../db/drizzle.ts';
import { auditEvents } from '../db/schema.ts';
import {
    type AuditEventInput,
    buildAuditEventValues,
    runAuditedMutation,
} from './audit-core.ts';

export * from './audit-core.ts';

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
