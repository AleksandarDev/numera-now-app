import { Hono } from 'hono';
import { handle } from 'hono/vercel';

import accountsRoutes from './accountsRoutes';
import categoriesRoutes from './categoriesRoutes';
import customersRoutes from './customersRoutes';
import documentsRoutes from './documentsRoutes';
import documentTypesRoutes from './documentTypesRoutes';
import settingsRoutes from './settingsRoutes';
import summaryRoutes from './summaryRoutes';
import transactionsRoutes from './transactionsRoutes';

const app = new Hono().basePath('/api');

const routes = app
    .route('/accounts', accountsRoutes)
    .route('/categories', categoriesRoutes)
    .route('/customers', customersRoutes)
    .route('/summary', summaryRoutes)
    .route('/transactions', transactionsRoutes)
    .route('/settings', settingsRoutes)
    .route('/documents', documentsRoutes)
    .route('/document-types', documentTypesRoutes);

export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);

export type AppType = typeof routes;
