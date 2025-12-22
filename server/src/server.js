import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// In-memory "database"
const database = {
	users: [
		{ id: 'u1', username: 'doctor1', password: 'pass123', name: 'Dr. Smith' }
	],
	authTokens: new Set(),
	medicines: [
		{ id: 'med-1', name: 'Paracetamol 500mg' },
		{ id: 'med-2', name: 'Amoxicillin 250mg' },
		{ id: 'med-3', name: 'Ibuprofen 200mg' },
		{ id: 'med-4', name: 'Cetirizine 10mg' },
		{ id: 'med-5', name: 'Omeprazole 20mg' },
		{ id: 'med-6', name: 'Aspirin 100mg' },
		{ id: 'med-7', name: 'Metformin 500mg' },
		{ id: 'med-8', name: 'Amlodipine 5mg' },
		{ id: 'med-9', name: 'Atorvastatin 20mg' },
		{ id: 'med-10', name: 'Losartan 50mg' }
	],
	// patients keyed by NIC
	patients: new Map()
};

function createTokenForUser(username) {
	return `fake-jwt-${username}-${uuidv4()}`;
}

function authMiddleware(req, res, next) {
	const authHeader = req.headers.authorization || '';
	const parts = authHeader.split(' ');
	if (parts.length === 2 && parts[0] === 'Bearer') {
		const token = parts[1];
		if (database.authTokens.has(token)) {
			req.token = token;
			return next();
		}
	}
	return res.status(401).json({ error: 'Unauthorized' });
}

app.get('/', (req, res) => {
	res.json({ message: 'Doctor Visit Logger API', version: '1.0.0', endpoints: ['/api/health', '/api/login', '/api/medicines', '/api/visits', '/api/patients/:nic'] });
});

app.get('/api/health', (req, res) => {
	res.json({ ok: true });
});

// Login
app.post('/api/login', (req, res) => {
	const { username, password } = req.body || {};
	if (!username || !password) {
		return res.status(400).json({ error: 'username and password are required' });
	}
	const user = database.users.find(u => u.username === username && u.password === password);
	if (!user) {
		return res.status(401).json({ error: 'Invalid credentials' });
	}
	const token = createTokenForUser(username);
	database.authTokens.add(token);
	res.json({ token, user: { id: user.id, username: user.username, name: user.name } });
});

// Helpful message for GET requests to login
app.get('/api/login', (req, res) => {
	res.status(405).json({ error: 'Method not allowed. Use POST to /api/login with { username, password } in the request body.' });
});

// Logout
app.post('/api/logout', authMiddleware, (req, res) => {
	if (req.token) {
		database.authTokens.delete(req.token);
	}
	res.json({ ok: true });
});

// Medicines
app.get('/api/medicines', authMiddleware, (req, res) => {
	res.json(database.medicines);
});

// Create a visit
app.post('/api/visits', authMiddleware, (req, res) => {
	const { nic, name, age, prescriptions, notes } = req.body || {};
	if (!nic || !name || typeof age !== 'number' || !Array.isArray(prescriptions)) {
		return res.status(400).json({ error: 'nic, name, age (number), prescriptions (array) are required' });
	}
	// Validate prescriptions structure
	for (const p of prescriptions) {
		if (!p.medicineId || !p.amount) {
			return res.status(400).json({ error: 'Each prescription must have medicineId and amount' });
		}
	}
	const visit = {
		id: uuidv4(),
		date: new Date().toISOString(),
		prescriptions: prescriptions.map(p => ({ medicineId: p.medicineId, amount: p.amount })),
		notes: notes || ''
	};
	let patient = database.patients.get(nic);
	if (!patient) {
		patient = { nic, name, age, visits: [] };
		database.patients.set(nic, patient);
	} else {
		// Update latest known name/age in case they changed
		patient.name = name;
		patient.age = age;
	}
	patient.visits.push(visit);
	return res.status(201).json({ patient });
});

// Get patient by NIC with resolved prescriptions
app.get('/api/patients/:nic', authMiddleware, (req, res) => {
	const { nic } = req.params;
	const patient = database.patients.get(nic);
	if (!patient) {
		return res.status(404).json({ error: 'Patient not found' });
	}
	const medicineById = new Map(database.medicines.map(m => [m.id, m]));
	const visits = patient.visits.map(v => {
		// Handle both old format (prescriptionIds) and new format (prescriptions)
		if (v.prescriptions) {
			// New format: prescriptions array with medicineId and amount
			return {
				...v,
				prescriptions: v.prescriptions.map(p => {
					const med = medicineById.get(p.medicineId);
					return med ? { ...med, amount: p.amount } : null;
				}).filter(Boolean)
			};
		} else if (v.prescriptionIds) {
			// Old format: just IDs (for backward compatibility)
			return {
				...v,
				prescriptions: v.prescriptionIds.map(id => medicineById.get(id)).filter(Boolean)
			};
		}
		return { ...v, prescriptions: [] };
	});
	return res.json({ ...patient, visits });
});

app.listen(PORT, () => {
	console.log(`Server listening on http://localhost:${PORT}`);
});

