# Finance Platform

Welcome to my Finance Platform project! This platform is designed to help you manage your personal or business finances effectively. With this Finance SaaS Platform, you can track your income and expenses, categorize transactions, assign them to specific accounts, and import transactions using a CSV file. Additionally, it integrates with Plaid to connect to your bank account and uses Lemon Squeezy for monetization.

## Features

- **Track Income and Expenses:** Monitor your financial transactions with ease.
- **Categorize Transactions:** Organize your transactions by categories for better clarity.
- **Account Management:** Assign transactions to specific accounts.
- **CSV Import:** Import transactions from CSV files for quick data entry.
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

5. (Planned) **Bank Integration:**

   - Connect your bank account using Plaid to automatically import and sync transactions.

6. (Planned) **Monetization:**

   - Monetize your platform by integrating Lemon Squeezy for payment processing.
