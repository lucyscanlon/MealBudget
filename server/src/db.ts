import pg from 'pg';

const pool = process.env.DATABASE_URL
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : new pg.Pool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER || 'wlt',
      password: process.env.DB_PASSWORD || 'wlt_dev',
      database: process.env.DB_NAME || 'weight_loss_tracker',
    });

export default pool;
