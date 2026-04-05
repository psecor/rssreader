declare module 'connect-pg-simple' {
  import { Store } from 'express-session';
  import { Pool } from 'pg';

  interface PgSessionOptions {
    pool?: Pool;
    tableName?: string;
    createTableIfMissing?: boolean;
    ttl?: number; // Time to live in seconds
  }

  function pgSession(session: any): {
    new (options: PgSessionOptions): Store;
  };

  export = pgSession;
}
