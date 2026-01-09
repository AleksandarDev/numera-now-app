# F004: Replace Categories with Tags

## Overview

Replace the single-select category system with a flexible multi-select tag system. Tags provide more flexibility for organizing and filtering transactions, allowing users to apply multiple labels to a single transaction.

## User Story

As a user, I want to assign multiple tags to my transactions so that I can organize and filter them in more flexible ways than a single category allows.

---

## Current Implementation (Categories)

### Schema

```typescript
// Single category per transaction
export const categories = pgTable('categories', {
    id: text('id').primaryKey(),
    plaidId: text('plaid_id'),
    name: text('name').notNull(),
    userId: text('user_id').notNull(),
});

// Transaction has single categoryId
transactions.categoryId → categories.id (one-to-one)
```

### Features

| Feature | Status |
|---------|--------|
| CRUD operations | ✅ |
| Single category per transaction | ✅ |
| Category suggestions based on customer | ✅ |
| Category in transaction list | ✅ |
| Category filtering (summary) | ✅ |
| Category column sorting | ✅ |

### Files Affected

| Location | Files |
|----------|-------|
| Schema | [schema.ts](../db/schema.ts) |
| API | `features/categories/api/*` (6 files) |
| Components | `features/categories/components/*` (3 files) |
| Hooks | `features/categories/hooks/*` |
| Transaction forms | `unified-transaction-form.tsx`, `unified-edit-transaction-form.tsx` |
| Transaction list | `columns.tsx`, `category-column.tsx` |
| Summary | `summaryRoutes.ts` |
| Suggested categories | `use-get-suggested-categories.ts` |

---

## Proposed Implementation (Tags)

### Schema Changes

```typescript
// Tags table (replaces categories)
export const tags = pgTable('tags', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    color: text('color'), // Optional hex color for visual distinction
    userId: text('user_id').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    index('tags_userid_idx').on(table.userId),
    index('tags_name_idx').on(table.name),
]);

// Junction table for many-to-many relationship
export const transactionTags = pgTable('transaction_tags', {
    id: text('id').primaryKey(),
    transactionId: text('transaction_id')
        .notNull()
        .references(() => transactions.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
        .notNull()
        .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
}, (table) => [
    index('transaction_tags_transactionid_idx').on(table.transactionId),
    index('transaction_tags_tagid_idx').on(table.tagId),
    // Unique constraint to prevent duplicate tag assignments
    unique('transaction_tags_unique').on(table.transactionId, table.tagId),
]);
```

### Key Differences from Categories

| Aspect | Categories | Tags |
|--------|------------|------|
| Relationship | One-to-one | Many-to-many |
| Selection | Single select dropdown | Multi-select with chips |
| Display | Single text | Multiple badges/chips |
| Storage | `categoryId` on transaction | Junction table |
| Visual | Plain text | Optional colors |

---

## Implementation Checklist

### Phase 1: Schema & Backend

- [ ] Create `tags` table (migration)
- [ ] Create `transaction_tags` junction table (migration)
- [ ] Add Drizzle relations for tags
- [ ] Create tags API routes:
  - [ ] GET `/api/tags` - list all tags
  - [ ] GET `/api/tags/:id` - get single tag
  - [ ] POST `/api/tags` - create tag
  - [ ] PATCH `/api/tags/:id` - update tag
  - [ ] DELETE `/api/tags/:id` - delete tag
  - [ ] POST `/api/tags/bulk-delete` - bulk delete
- [ ] Update transaction routes to handle tags array
- [ ] Update transaction create/edit to accept `tagIds: string[]`
- [ ] Create suggested tags endpoint (based on customer history)

### Phase 2: Frontend - Tag Management

- [ ] Create `features/tags/` folder structure:

  ```
  features/tags/
  ├── api/
  │   ├── use-get-tags.ts
  │   ├── use-get-tag.ts
  │   ├── use-create-tag.ts
  │   ├── use-edit-tag.ts
  │   ├── use-delete-tag.ts
  │   └── use-bulk-delete-tags.ts
  ├── components/
  │   ├── tag-form.tsx
  │   ├── tag-badge.tsx
  │   ├── tag-multi-select.tsx
  │   ├── new-tag-sheet.tsx
  │   └── edit-tag-sheet.tsx
  └── hooks/
      ├── use-new-tag.ts
      └── use-open-tag.ts
  ```

- [ ] Create tag management page (optional, or inline creation)
- [ ] Create `TagMultiSelect` component (multi-select with create capability)
- [ ] Create `TagBadge` component (displays tag with optional color)

### Phase 3: Transaction Form Updates

- [ ] Update `UnifiedTransactionForm`:
  - [ ] Replace category `Select` with `TagMultiSelect`
  - [ ] Update form values type: `categoryId` → `tagIds: string[]`
  - [ ] Update validation (optional tags)
- [ ] Update `UnifiedEditTransactionForm`:
  - [ ] Same changes as above
  - [ ] Load existing tags for transaction
- [ ] Update suggested tags logic
- [ ] Update quick-assign suggestions for tags

### Phase 4: Transaction List Updates

- [ ] Update transaction columns:
  - [ ] Replace `CategoryColumn` with `TagsColumn`
  - [ ] Display multiple tag badges
- [ ] Update transaction query to include tags
- [ ] Update filtering to support tag filtering

### Phase 5: Summary & Reports

- [ ] Update summary routes to aggregate by tags
- [ ] Update spending pie chart to show tag breakdown
- [ ] Handle transactions with multiple tags (avoid double-counting)

### Phase 6: Migration & Cleanup

- [ ] Create data migration script:
  - [ ] For each transaction with `categoryId`:
    - [ ] Create corresponding tag if not exists
    - [ ] Create `transaction_tags` entry
  - [ ] Preserve category names as tag names
- [ ] Remove old category code after migration verified:
  - [ ] Remove `categories` table
  - [ ] Remove `categoryId` from transactions
  - [ ] Remove `features/categories/` folder
  - [ ] Remove category-related imports

---

## API Changes

### Tags Endpoints

```typescript
// GET /api/tags
Response: { data: Array<{ id, name, color, userId, createdAt }> }

// POST /api/tags
Body: { name: string, color?: string }
Response: { data: { id, name, color } }

// PATCH /api/tags/:id
Body: { name?: string, color?: string }
Response: { data: { id, name, color } }

// DELETE /api/tags/:id
Response: { data: { id } }
```

### Transaction Endpoints (Updated)

```typescript
// POST /api/transactions (create)
Body: {
    ...existingFields,
    tagIds?: string[], // Replaces categoryId
}

// PATCH /api/transactions/:id (update)
Body: {
    ...existingFields,
    tagIds?: string[], // Replaces categoryId
}

// GET /api/transactions
Response: {
    data: Array<{
        ...existingFields,
        tags: Array<{ id, name, color }>, // Replaces category/categoryId
    }>
}
```

---

## UI Components

### TagMultiSelect

```tsx
type TagMultiSelectProps = {
    value: string[];
    onChange: (tagIds: string[]) => void;
    options: Array<{ id: string; name: string; color?: string }>;
    onCreate?: (name: string) => void;
    disabled?: boolean;
    placeholder?: string;
    suggestedTagIds?: string[];
};
```

Features:

- Multi-select dropdown with checkboxes
- Selected tags shown as removable chips
- Inline tag creation (type and press Enter)
- Suggested tags highlighted at top
- Optional color indicators

### TagBadge

```tsx
type TagBadgeProps = {
    name: string;
    color?: string;
    onRemove?: () => void;
    onClick?: () => void;
    size?: 'sm' | 'md';
};
```

### TagsColumn (Transaction List)

```tsx
type TagsColumnProps = {
    transactionId: string;
    tags: Array<{ id: string; name: string; color?: string }>;
};
```

Display:

- Show first 2-3 tags as badges
- "+N more" indicator if additional tags
- Click to expand/edit

---

## Migration Strategy (Using Drizzle)

### Step 1: Add New Schema (Keep Categories)

1. Add `tags` and `transactionTags` tables to `db/schema.ts`
2. Keep existing `categories` table and `categoryId` field
3. Run `pnpm drizzle-kit generate` → creates migration file
4. Run `pnpm drizzle-kit migrate` → applies migration
5. Deploy code (tags coexist with categories)

### Step 2: Data Migration Script

Run a one-time script to migrate data:

```typescript
// scripts/migrate-categories-to-tags.ts
import { db } from '@/db/drizzle';
import { categories, tags, transactions, transactionTags } from '@/db/schema';
import { createId } from '@paralleldrive/cuid2';
import { eq, isNotNull } from 'drizzle-orm';

async function migrateCategoriesToTags() {
    console.log('Starting category → tag migration...');
    
    // 1. Get all unique categories
    const allCategories = await db.select().from(categories);
    console.log(`Found ${allCategories.length} categories`);
    
    // 2. Create tags for each category
    const categoryToTagMap = new Map<string, string>();
    for (const category of allCategories) {
        const tagId = createId();
        await db.insert(tags).values({
            id: tagId,
            name: category.name,
            userId: category.userId,
        });
        categoryToTagMap.set(category.id, tagId);
        console.log(`Created tag "${category.name}" → ${tagId}`);
    }
    
    // 3. Link transactions to tags
    const txWithCategories = await db
        .select({ id: transactions.id, categoryId: transactions.categoryId })
        .from(transactions)
        .where(isNotNull(transactions.categoryId));
    
    console.log(`Migrating ${txWithCategories.length} transaction-category links...`);
    
    for (const tx of txWithCategories) {
        if (tx.categoryId) {
            const tagId = categoryToTagMap.get(tx.categoryId);
            if (tagId) {
                await db.insert(transactionTags).values({
                    id: createId(),
                    transactionId: tx.id,
                    tagId: tagId,
                });
            }
        }
    }
    
    console.log('✅ Migration complete!');
}

migrateCategoriesToTags()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
```

Run with:
```bash
npx tsx scripts/migrate-categories-to-tags.ts
```

### Step 3: Update Application Code

1. Update transaction forms to use tags
2. Update transaction lists to display tags
3. Update summary/reports to use tags
4. Verify all features work with tags

### Step 4: Remove Categories (After Verification)

1. Remove `categories` table from schema
2. Remove `categoryId` field from transactions
3. Run `pnpm drizzle-kit generate` → creates DROP migration
4. Run `pnpm drizzle-kit migrate` → removes old tables
5. Delete `features/categories/` folder
6. Remove category imports from codebase

---

## Drizzle Migrations Generated

### Migration 1: Add Tags Tables

```sql
-- drizzle/0024_add_tags.sql (generated by drizzle-kit)
CREATE TABLE IF NOT EXISTS "tags" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "color" text,
    "user_id" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "transaction_tags" (
    "id" text PRIMARY KEY NOT NULL,
    "transaction_id" text NOT NULL,
    "tag_id" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "transaction_tags_transaction_id_transactions_id_fk" 
        FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") 
        ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "transaction_tags_tag_id_tags_id_fk" 
        FOREIGN KEY ("tag_id") REFERENCES "tags"("id") 
        ON DELETE cascade ON UPDATE no action,
    CONSTRAINT "transaction_tags_unique" UNIQUE("transaction_id", "tag_id")
);

CREATE INDEX IF NOT EXISTS "tags_userid_idx" ON "tags" ("user_id");
CREATE INDEX IF NOT EXISTS "tags_name_idx" ON "tags" ("name");
CREATE INDEX IF NOT EXISTS "transaction_tags_transactionid_idx" 
    ON "transaction_tags" ("transaction_id");
CREATE INDEX IF NOT EXISTS "transaction_tags_tagid_idx" 
    ON "transaction_tags" ("tag_id");
```

### Migration 2: Remove Categories (After Data Migration)

```sql
-- drizzle/0025_remove_categories.sql (generated by drizzle-kit)
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "category_id";
DROP TABLE IF EXISTS "categories";
DROP INDEX IF EXISTS "transactions_categoryid_idx";
DROP INDEX IF EXISTS "categories_userid_idx";
```

---

## Acceptance Criteria

- [ ] Tags table created with name and optional color
- [ ] Junction table links transactions to multiple tags
- [ ] Tag CRUD operations work (create, read, update, delete)
- [ ] Transaction forms allow multi-select tags
- [ ] Transaction list displays multiple tags per transaction
- [ ] Tag suggestions work based on customer history
- [ ] Quick-assign suggestions work for tags
- [ ] Summary/reports handle multi-tag transactions correctly
- [ ] Existing category data migrated to tags
- [ ] Old category code removed after migration
- [ ] No data loss during migration

---

## Out of Scope (Future)

- Tag hierarchies/nesting
- Tag groups/namespaces
- Tag-based automation rules
- Tag icons (beyond colors)
- Tag sharing between users
- Predefined tag templates
