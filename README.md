# Finance Platform

Welcome to my Finance Platform project! This platform is designed to help you manage your personal or business finances effectively. With this Finance SaaS Platform, you can track your income and expenses, categorize transactions, assign them to specific accounts, and import transactions using a CSV file. Additionally, it integrates with Plaid to connect to your bank account and uses Lemon Squeezy for monetization.

## Features

- **Track Income and Expenses:** Monitor your financial transactions with ease.
- **Categorize Transactions:** Organize your transactions by categories for better clarity.
- **Account Management:** Assign transactions to specific accounts.
- **CSV Import:** Import transactions from CSV files for quick data entry.
- **Open Finances:** Share selected financial metrics publicly with customizable embeddable transparency pages.
- (Planned) **Bank Integration:** Connect to your bank account using Plaid.
- (Planned) **Monetization:** Monetize your platform using Lemon Squeezy.

## Tech Stack

- **Frontend:** Next.js, React
- **Backend:** Hono.js
- **CSV Upload:** Integrated CSV upload functionality
- **Database:** [Neon PostgreSQL](https://neon.tech)
- (Planned) **Bank Integration:** Plaid
- (Planned) **Payment Processing:** Lemon Squeezy

## Prerequisites

- [Node.js (^v22.6.0)](https://nodejs.org/en)
- [pnpm](https://pnpm.io/installation)
- [Vercel CLI](https://vercel.com/docs/cli)

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/AleksandarDev/numera-now-app.git
   cd numera-now-app
   ```

2. **Install dependencies:**

   ```bash
   pnpm i
   ```

3. **Set up environment variables:**

   Link the app to Vercel project and pull development environmental variables to `.env` file from Vercel.

   ```env
   vercel link
   vercel env pull .env
   ```

4. **Run the application:**

   ```bash
   pnpm dev
   ```

## Usage

1. **Track Income and Expenses:**

   - Add your income and expense transactions manually or import them from a CSV file.

2. **Categorize Transactions:**

   - Assign categories to your transactions for better organization.

3. **Account Management:**

   - Create and manage different accounts, assigning transactions to the appropriate accounts.

4. **CSV Import:**

   - Import transactions using a CSV file by navigating to the import section and uploading your file.

5. **Open Finances:**

   - Share selected financial metrics publicly with an embeddable transparency page. Configure what data to expose from Settings, and embed the page on your website to demonstrate financial transparency. See [Open Finances Documentation](docs/OPEN_FINANCES.md) for details.

6. (Planned) **Bank Integration:**

   - Connect your bank account using Plaid to automatically import and sync transactions.

7. (Planned) **Monetization:**

   - Monetize your platform by integrating Lemon Squeezy for payment processing.

## Database Branching & Migrations

This project uses **Neon PostgreSQL** with automated database branching for preview deployments and migrations.

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        Git Workflow                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  feature-branch ──► PR Created ──► Vercel Preview Deployment    │
│       │                                    │                     │
│       │              Neon branch auto-created + migrations ◄────┘
│       │                                                          │
│       ▼                                                          │
│  Merge to main ──► Vercel Production Build ──► Production DB    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Environments

| Environment | Database Branch | When Migrations Run |
|-------------|----------------|---------------------|
| **Production** | `main` (default) | During Vercel production build |
| **Preview** | Auto-created by Neon integration | During Vercel preview build |
| **Development** | Local via `.env` | Manual via `pnpm db:migrate` |

### Database Commands

```bash
# Generate migration files from schema changes
pnpm db:generate

# Apply migrations to current DATABASE_URL
pnpm db:migrate

# Open Drizzle Studio to browse database
pnpm db:studio
```

### Required Setup

#### Vercel + Neon Integration

The [Neon Vercel Integration](https://vercel.com/integrations/neon) handles all environments automatically:

- Creates a database branch for each preview deployment
- Provides `DATABASE_URL` environment variable for all environments
- Runs migrations via `vercel-build` script before each deployment
- Cleans up preview branches when deployments are removed

#### Development Workflow

1. Make schema changes in `db/schema.ts`
2. Generate migrations: `pnpm db:generate`
3. Test locally: `pnpm db:migrate`
4. Commit migration files in `drizzle/`
5. Open PR → Preview deployment with its own database branch (automatic)
6. Merge → Production database migrated during Vercel build

### Migration Files

Migration files are stored in `drizzle/` and should be committed to version control. Never edit migration files after they've been applied to production.
