import pg from 'pg';
const { Pool } = pg;

// Database connection pool for Lambda
// In Lambda, connections are reused across invocations
let pool = null;

export function getPool() {
	if (!pool) {
		pool = new Pool({
			host: process.env.DB_HOST,
			port: process.env.DB_PORT || 5432,
			database: process.env.DB_NAME,
			user: process.env.DB_USER,
			password: process.env.DB_PASSWORD,
			ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
			max: 2, // Lambda-friendly connection limit
			idleTimeoutMillis: 30000,
			connectionTimeoutMillis: 2000
		});
	}
	return pool;
}

// Helper to execute queries with error handling
export async function query(text, params) {
	const pool = getPool();
	try {
		const result = await pool.query(text, params);
		return result;
	} catch (error) {
		console.error('Database query error:', error);
		throw error;
	}
}

// Close pool (useful for testing or graceful shutdown)
export async function closePool() {
	if (pool) {
		await pool.end();
		pool = null;
	}
}

