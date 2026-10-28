// Vercel serverless entry. All /api/* requests are rewritten here by vercel.json.
import { createApp } from '../src/app.js';

const app = createApp();

export default app;
