import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// Initialize database tables
export async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'member',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS leads (
      id VARCHAR(100) PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255),
      title VARCHAR(255),
      company VARCHAR(255),
      company_size VARCHAR(100),
      industry VARCHAR(255),
      linkedin_url TEXT,
      pain_signal TEXT,
      notes TEXT,
      status VARCHAR(50) DEFAULT 'not_contacted',
      assigned_to INTEGER REFERENCES users(id),
      imported_at TIMESTAMP DEFAULT NOW(),
      last_drafted_at TIMESTAMP,
      last_sent_at TIMESTAMP,
      sequence_step INTEGER DEFAULT 0,
      source VARCHAR(255)
    );

    CREATE TABLE IF NOT EXISTS drafts (
      id VARCHAR(100) PRIMARY KEY,
      lead_id VARCHAR(100) REFERENCES leads(id) ON DELETE SET NULL,
      type VARCHAR(50),
      category VARCHAR(100),
      recipient VARCHAR(255),
      recipient_title VARCHAR(255),
      recipient_email VARCHAR(255),
      subject TEXT,
      body TEXT,
      research_notes TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      sequence_step INTEGER,
      total_steps INTEGER,
      day INTEGER,
      modality VARCHAR(50),
      scheduled_time VARCHAR(100),
      assigned_to INTEGER REFERENCES users(id),
      meta JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      sent_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS voice_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      custom_instructions TEXT DEFAULT '',
      use_custom BOOLEAN DEFAULT false,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS email_examples (
      id VARCHAR(100) PRIMARY KEY,
      subject TEXT,
      body TEXT,
      recipient VARCHAR(255),
      category VARCHAR(100),
      performance VARCHAR(255),
      added_at TIMESTAMP DEFAULT NOW()
    );

    -- Insert default voice config if not exists
    INSERT INTO voice_config (id, custom_instructions, use_custom)
    VALUES (1, '', false)
    ON CONFLICT (id) DO NOTHING;
  `);

  console.log("✅ Database tables initialized");
}

export default pool;
