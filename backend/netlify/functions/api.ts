import serverless from 'serverless-http';
import app from '../../src/app'; // Points to backend/src/app.ts

export const handler = serverless(app);
