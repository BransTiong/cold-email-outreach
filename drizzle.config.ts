import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Next reads .env.local for the app; load it here too so drizzle-kit picks up
// the same DATABASE_URL (falling back to .env).
dotenv.config({ path: '.env.local' });
dotenv.config();

export default defineConfig({
  out: './drizzle',
  schema: './db/schema',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
