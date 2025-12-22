import { query, getPool } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Helper to format Lambda response
function successResponse(data, statusCode = 200) {
	return {
		statusCode,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Headers': 'Content-Type,Authorization',
			'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
		},
		body: JSON.stringify(data)
	};
}

function errorResponse(message, statusCode = 400) {
	return {
		statusCode,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*'
		},
		body: JSON.stringify({ error: message })
	};
}

// Extract token from Authorization header
function extractToken(event) {
	const authHeader = event.headers?.Authorization || event.headers?.authorization || '';
	const parts = authHeader.split(' ');
	if (parts.length === 2 && parts[0] === 'Bearer') {
		return parts[1];
	}
	return null;
}

// Verify JWT token and get doctor ID
async function verifyToken(token) {
	try {
		const decoded = jwt.verify(token, JWT_SECRET);
		return decoded.doctorId;
	} catch (error) {
		return null;
	}
}

// Health check
export async function healthHandler(event) {
	return successResponse({ ok: true });
}

// Root endpoint
export async function rootHandler(event) {
	return successResponse({
		message: 'Doctor Visit Logger API',
		version: '1.0.0',
		endpoints: ['/api/health', '/api/login', '/api/medicines', '/api/visits', '/api/patients/:nic']
	});
}

// Login handler
export async function loginHandler(event) {
	try {
		const body = JSON.parse(event.body || '{}');
		const { username, password } = body;

		if (!username || !password) {
			return errorResponse('username and password are required', 400);
		}

		// Find doctor by username
		const result = await query(
			'SELECT id, username, password_hash, name FROM doctors WHERE username = $1',
			[username]
		);

		if (result.rows.length === 0) {
			return errorResponse('Invalid credentials', 401);
		}

		const doctor = result.rows[0];

		// Verify password (in production, use bcrypt.compare)
		// For now, simple comparison - replace with bcrypt.compare(password, doctor.password_hash) in production
		if (password !== doctor.password_hash) {
			return errorResponse('Invalid credentials', 401);
		}

		// Generate JWT token
		const token = jwt.sign(
			{ doctorId: doctor.id, username: doctor.username },
			JWT_SECRET,
			{ expiresIn: '24h' }
		);

		return successResponse({
			token,
			user: {
				id: doctor.id,
				username: doctor.username,
				name: doctor.name
			}
		});
	} catch (error) {
		console.error('Login error:', error);
		return errorResponse('Internal server error', 500);
	}
}

// Get medicines handler
export async function medicinesHandler(event) {
	try {
		const token = extractToken(event);
		if (!token) {
			return errorResponse('Unauthorized', 401);
		}

		const doctorId = await verifyToken(token);
		if (!doctorId) {
			return errorResponse('Unauthorized', 401);
		}

		const result = await query('SELECT id, name FROM medicines ORDER BY name');
		return successResponse(result.rows);
	} catch (error) {
		console.error('Medicines error:', error);
		return errorResponse('Internal server error', 500);
	}
}

// Create visit handler
export async function createVisitHandler(event) {
	try {
		const token = extractToken(event);
		if (!token) {
			return errorResponse('Unauthorized', 401);
		}

		const doctorId = await verifyToken(token);
		if (!doctorId) {
			return errorResponse('Unauthorized', 401);
		}

		const body = JSON.parse(event.body || '{}');
		const { nic, name, age, prescriptions, notes } = body;

		if (!nic || !name || typeof age !== 'number' || !Array.isArray(prescriptions)) {
			return errorResponse('nic, name, age (number), prescriptions (array) are required', 400);
		}

		// Validate prescriptions structure
		for (const p of prescriptions) {
			if (!p.medicineId || !p.amount) {
				return errorResponse('Each prescription must have medicineId and amount', 400);
			}
		}

		// Start transaction
		const client = await getPool().connect();
		try {
			await client.query('BEGIN');

			// Get or create patient
			let patientResult = await client.query('SELECT * FROM patients WHERE nic = $1', [nic]);
			if (patientResult.rows.length === 0) {
				await client.query(
					'INSERT INTO patients (nic, name, age) VALUES ($1, $2, $3)',
					[nic, name, age]
				);
			} else {
				// Update patient info
				await client.query(
					'UPDATE patients SET name = $1, age = $2, updated_at = CURRENT_TIMESTAMP WHERE nic = $3',
					[name, age, nic]
				);
			}

			// Use current timestamp for visit date
			const visitTimestamp = new Date().toISOString(); // Full timestamp for date field

			// Check if visit already exists for this patient, doctor, and date (using DATE() function)
			const existingVisit = await client.query(
				'SELECT id FROM visits WHERE patient_nic = $1 AND doctor_id = $2 AND DATE(date) = DATE($3)',
				[nic, doctorId, visitTimestamp]
			);

			let visitId;
			if (existingVisit.rows.length > 0) {
				// Update existing visit
				visitId = existingVisit.rows[0].id;
				await client.query(
					'UPDATE visits SET notes = $1 WHERE id = $2',
					[notes || '', visitId]
				);
				// Delete old prescriptions
				await client.query('DELETE FROM prescriptions WHERE visit_id = $1', [visitId]);
			} else {
				// Create new visit
				visitId = uuidv4();
				await client.query(
					'INSERT INTO visits (id, patient_nic, doctor_id, date, notes, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
					[visitId, nic, doctorId, visitTimestamp, notes || '', visitTimestamp]
				);
			}

			// Insert prescriptions
			for (const p of prescriptions) {
				await client.query(
					'INSERT INTO prescriptions (id, visit_id, medicine_id, amount) VALUES ($1, $2, $3, $4)',
					[uuidv4(), visitId, p.medicineId, p.amount]
				);
			}

			await client.query('COMMIT');

			// Fetch the created visit with prescriptions
			const visitResult = await client.query(
				`SELECT v.id, v.date, v.notes, v.created_at,
					json_agg(
						json_build_object(
							'id', m.id,
							'name', m.name,
							'amount', p.amount
						)
					) FILTER (WHERE p.id IS NOT NULL) as prescriptions
				FROM visits v
				LEFT JOIN prescriptions p ON v.id = p.visit_id
				LEFT JOIN medicines m ON p.medicine_id = m.id
				WHERE v.id = $1
				GROUP BY v.id, v.date, v.notes, v.created_at`,
				[visitId]
			);

			const visit = visitResult.rows[0];
			const visitResponse = {
				id: visit.id,
				date: visit.date || visit.created_at, // Use date timestamp (now TIMESTAMP type)
				notes: visit.notes,
				prescriptions: visit.prescriptions || []
			};

			return successResponse({ patient: { nic, name, age }, visit: visitResponse }, 201);
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally {
			client.release();
		}
	} catch (error) {
		console.error('Create visit error:', error);
		if (error.code === '23505') { // Unique violation
			return errorResponse('A visit already exists for this patient, doctor, and date', 409);
		}
		return errorResponse('Internal server error', 500);
	}
}

// Get patient by NIC handler
export async function getPatientHandler(event) {
	try {
		const token = extractToken(event);
		if (!token) {
			return errorResponse('Unauthorized', 401);
		}

		const doctorId = await verifyToken(token);
		if (!doctorId) {
			return errorResponse('Unauthorized', 401);
		}

		const nic = event.pathParameters?.nic;
		if (!nic) {
			return errorResponse('NIC parameter is required', 400);
		}

		// Get patient
		const patientResult = await query('SELECT * FROM patients WHERE nic = $1', [nic]);
		if (patientResult.rows.length === 0) {
			return errorResponse('Patient not found', 404);
		}

		const patient = patientResult.rows[0];

		// Get visits for this patient and doctor with prescriptions
		const visitsResult = await query(
			`SELECT v.id, v.date, v.notes, v.created_at,
				json_agg(
					json_build_object(
						'id', m.id,
						'name', m.name,
						'amount', p.amount
					)
				) FILTER (WHERE p.id IS NOT NULL) as prescriptions
			FROM visits v
			LEFT JOIN prescriptions p ON v.id = p.visit_id
			LEFT JOIN medicines m ON p.medicine_id = m.id
			WHERE v.patient_nic = $1 AND v.doctor_id = $2
			GROUP BY v.id, v.date, v.notes, v.created_at
			ORDER BY v.date DESC, v.created_at DESC`,
			[nic, doctorId]
		);

		const visits = visitsResult.rows.map(v => ({
			id: v.id,
			date: v.date || v.created_at, // Use date timestamp (now TIMESTAMP type)
			notes: v.notes,
			prescriptions: v.prescriptions || []
		}));

		return successResponse({
			...patient,
			visits
		});
	} catch (error) {
		console.error('Get patient error:', error);
		return errorResponse('Internal server error', 500);
	}
}

// Logout handler (optional - with JWT, logout is client-side)
export async function logoutHandler(event) {
	return successResponse({ ok: true });
}

