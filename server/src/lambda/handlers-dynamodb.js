import {
	getItem,
	putItem,
	updateItem,
	queryItems,
	scanTable,
	TABLES,
	calculateAge
} from '../db-dynamodb.js';
import { v4 as uuidv4 } from 'uuid';
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

// Extract token from Authorization header (REST API format)
// REST API headers are case-sensitive, check both cases
function extractToken(event) {
	const headers = event.headers || {};
	const authHeader = headers.Authorization || headers.authorization || '';
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
		// REST API: body is a string, need to parse
		const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || '{}');
		const { username, password } = body;

		if (!username || !password) {
			return errorResponse('username and password are required', 400);
		}

		// Query doctors table by username using GSI
		const doctors = await queryItems(
			TABLES.DOCTORS,
			'username = :username',
			{ ':username': username },
			{},
			'username-index'
		);

		if (doctors.length === 0) {
			return errorResponse('Invalid credentials', 401);
		}

		const doctor = doctors[0];

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

// Get medicines handler - returns doctor-specific medicines
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

		// Get doctor's medicines from single row
		const medicineRow = await getItem(TABLES.DOCTOR_ITEMS, { doctor_id: doctorId, item_type: 'M' });
		const medicines = medicineRow && medicineRow.items ? medicineRow.items : [];
		
		medicines.sort((a, b) => a.name.localeCompare(b.name));
		
		return successResponse(medicines);
	} catch (error) {
		console.error('Medicines error:', error);
		return errorResponse('Internal server error', 500);
	}
}

// Create medicine handler - allows doctor to add their own medicine
export async function createMedicineHandler(event) {
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
		const { name, brands } = body;

		if (!name || !name.trim()) {
			return errorResponse('Medicine name is required', 400);
		}

		// Generate unique ID
		const itemId = `med-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		
		const newMedicine = {
			id: itemId,
			name: name.trim(),
			brands: Array.isArray(brands) ? brands : []
		};

		// Get existing medicine row or create new one
		const medicineRow = await getItem(TABLES.DOCTOR_ITEMS, { doctor_id: doctorId, item_type: 'M' });
		
		if (medicineRow) {
			// Update existing row by appending to items list
			const updatedItems = [...(medicineRow.items || []), newMedicine];
			await updateItem(
				TABLES.DOCTOR_ITEMS,
				{ doctor_id: doctorId, item_type: 'M' },
				'SET #items = :items, updated_at = :updated_at',
				{
					':items': updatedItems,
					':updated_at': new Date().toISOString()
				},
				{
					'#items': 'items'
				}
			);
		} else {
			// Create new row
			await putItem(TABLES.DOCTOR_ITEMS, {
				doctor_id: doctorId,
				item_type: 'M',
				items: [newMedicine],
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString()
			});
		}

		return successResponse(newMedicine, 201);
	} catch (error) {
		console.error('Create medicine error:', error);
		return errorResponse('Internal server error', 500);
	}
}

// Add brand to existing medicine handler
export async function addBrandToMedicineHandler(event) {
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
		const { brand } = body;

		if (!brand || !brand.trim()) {
			return errorResponse('Brand name is required', 400);
		}

		// Extract medicineId from path
		const path = event.path || event.rawPath || '';
		console.log('Path:', path);
		const pathParts = path.split('/').filter(p => p); // Remove empty strings
		console.log('Path parts:', pathParts);
		// Path should be: /api/medicines/:medicineId/brands or /medicines/:medicineId/brands
		// After split and filter: ['api', 'medicines', medicineId, 'brands'] or ['medicines', medicineId, 'brands']
		const medicineId = pathParts[0] === 'api' ? pathParts[2] : pathParts[1];
		console.log('Medicine ID:', medicineId);

		if (!medicineId || medicineId === 'brands') {
			return errorResponse('Medicine ID is required', 400);
		}

		// Get existing medicine row
		const medicineRow = await getItem(TABLES.DOCTOR_ITEMS, { doctor_id: doctorId, item_type: 'M' });
		
		if (!medicineRow || !medicineRow.items) {
			return errorResponse('No medicines found', 404);
		}

		// Find the medicine and add brand
		const updatedItems = medicineRow.items.map(med => {
			if (med.id === medicineId) {
				const currentBrands = med.brands || [];
				// Check if brand already exists (case-insensitive)
				if (currentBrands.some(b => b.toLowerCase() === brand.trim().toLowerCase())) {
					return med; // Brand already exists, don't add duplicate
				}
				return {
					...med,
					brands: [...currentBrands, brand.trim()]
				};
			}
			return med;
		});

		// Check if medicine was found
		const updatedMedicine = updatedItems.find(m => m.id === medicineId);
		if (!updatedMedicine) {
			return errorResponse('Medicine not found', 404);
		}

		// Update the row
		await updateItem(
			TABLES.DOCTOR_ITEMS,
			{ doctor_id: doctorId, item_type: 'M' },
			'SET #items = :items, updated_at = :updated_at',
			{
				':items': updatedItems,
				':updated_at': new Date().toISOString()
			},
			{
				'#items': 'items'
			}
		);

		return successResponse(updatedMedicine);
	} catch (error) {
		console.error('Add brand error:', error);
		return errorResponse('Internal server error', 500);
	}
}

// Get investigations handler - returns doctor-specific investigations
export async function investigationsHandler(event) {
	try {
		const token = extractToken(event);
		if (!token) {
			return errorResponse('Unauthorized', 401);
		}

		const doctorId = await verifyToken(token);
		if (!doctorId) {
			return errorResponse('Unauthorized', 401);
		}

		// Get doctor's investigations from single row
		const investigationRow = await getItem(TABLES.DOCTOR_ITEMS, { doctor_id: doctorId, item_type: 'I' });
		const investigations = investigationRow && investigationRow.items ? investigationRow.items : [];
		
		investigations.sort((a, b) => a.name.localeCompare(b.name));
		
		return successResponse(investigations);
	} catch (error) {
		console.error('Investigations error:', error);
		return errorResponse('Internal server error', 500);
	}
}

// Create investigation handler - allows doctor to add their own investigation
export async function createInvestigationHandler(event) {
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
		const { name, category } = body;

		if (!name || !name.trim()) {
			return errorResponse('Investigation name is required', 400);
		}

		// Generate unique ID
		const itemId = `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		
		const newInvestigation = {
			id: itemId,
			name: name.trim(),
			category: category ? category.trim() : ''
		};

		// Get existing investigation row or create new one
		const investigationRow = await getItem(TABLES.DOCTOR_ITEMS, { doctor_id: doctorId, item_type: 'I' });
		
		if (investigationRow) {
			// Update existing row by appending to items list
			const updatedItems = [...(investigationRow.items || []), newInvestigation];
			await updateItem(
				TABLES.DOCTOR_ITEMS,
				{ doctor_id: doctorId, item_type: 'I' },
				'SET #items = :items, updated_at = :updated_at',
				{
					':items': updatedItems,
					':updated_at': new Date().toISOString()
				},
				{
					'#items': 'items'
				}
			);
		} else {
			// Create new row
			await putItem(TABLES.DOCTOR_ITEMS, {
				doctor_id: doctorId,
				item_type: 'I',
				items: [newInvestigation],
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString()
			});
		}

		return successResponse(newInvestigation, 201);
	} catch (error) {
		console.error('Create investigation error:', error);
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

		// REST API: body is a string, need to parse
		const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || '{}');
		const { 
			patientId, // Optional - if provided, use existing patient
			name, 
			birthday, // YYYY-MM-DD format
			phoneNumber,
			nic, // Optional
			gender, 
			pastMedicalHistory, 
			familyHistory, 
			allergies, 
			prescriptions, 
			presentingComplaint, 
			examinationFindings, 
			investigations, 
			bloodPressureReadings, // Array of blood pressure readings
			investigationsToDo, // Array of investigations to do
			notes, 
			generateReferralLetter, 
			referralDoctorName, 
			referralLetterBody 
		} = body;

		if (!name || !Array.isArray(prescriptions)) {
			return errorResponse('name and prescriptions (array) are required', 400);
		}

		// Calculate age from birthday if provided
		let age = null;
		if (birthday) {
			age = calculateAge(birthday);
		}
		
		// If prescriptions array is empty, this is a patient info update only (no visit created)
		const isPatientUpdateOnly = prescriptions.length === 0;

		// Validate prescriptions structure (only if prescriptions are provided)
		if (!isPatientUpdateOnly) {
			for (const p of prescriptions) {
				if (!p.medicineId) {
					return errorResponse('Each prescription must have medicineId', 400);
				}
			}
		}

		const visitTimestamp = new Date().toISOString();
		const visitId = uuidv4();

		// Get or create patient
		// Table uses composite key: doctor_id (PK) + patient_id (SK)
		let patient;
		let finalPatientId;
		let finalNic;

		if (patientId) {
			// Use existing patient - lookup by composite key
			finalPatientId = patientId;
			patient = await getItem(TABLES.PATIENTS, { doctor_id: doctorId, patient_id: finalPatientId });
			if (!patient) {
				return errorResponse('Patient not found', 404);
			}
			finalNic = patient.nic || nic || '';
		} else {
			// Create new patient or find by searching
			finalPatientId = uuidv4(); // Generate new patient_id
			// New patient with provided NIC
			patient = null;
			finalNic = nic;
			// // If NIC is provided, try to find existing patient by scanning
			// if (nic) {
			// 	// Search for patient by NIC within this doctor's patients
			// 	const allPatients = await scanTable(
			// 		TABLES.PATIENTS,
			// 		'doctor_id = :doctor_id',
			// 		{ ':doctor_id': doctorId }
			// 	);
			// 	const existingPatient = allPatients.find(p => p.nic === nic);
			// 	if (existingPatient) {
			// 		patient = existingPatient;
			// 		finalPatientId = existingPatient.patient_id;
			// 		finalNic = nic;
			// 	} else {
			// 		// New patient with provided NIC
			// 		patient = null;
			// 		finalNic = nic;
			// 	}
			// } else {
			// 	// New patient without NIC
			// 	patient = null;
			// 	finalNic = null; // NIC is optional
			// }
		}

		// If this is a patient update only (no prescriptions), skip visit creation
		if (isPatientUpdateOnly) {
			if (!patient) {
				return errorResponse('Patient not found', 404);
			}
			
			// Build update expression dynamically
			const updateFields = [];
			const updateValues = { ':updated_at': visitTimestamp };
			const updateNames = {};

			if (name) {
				updateFields.push('#name = :name');
				updateValues[':name'] = name;
				updateNames['#name'] = 'name';
			}
			if (birthday !== undefined) {
				updateFields.push('birthday = :birthday');
				updateValues[':birthday'] = birthday || null;
				if (age !== null) {
					updateFields.push('age = :age');
					updateValues[':age'] = age;
				}
			}
			if (phoneNumber !== undefined) {
				updateFields.push('phone_number = :phone_number');
				updateValues[':phone_number'] = phoneNumber || '';
			}
			if (nic !== undefined && nic !== finalNic) {
				// Can't change NIC (it's the primary key), so ignore
			}
			if (gender !== undefined) {
				updateFields.push('gender = :gender');
				updateValues[':gender'] = gender || '';
			}
			if (pastMedicalHistory !== undefined) {
				updateFields.push('pastMedicalHistory = :pastMedicalHistory');
				updateValues[':pastMedicalHistory'] = pastMedicalHistory || '';
			}
			if (familyHistory !== undefined) {
				updateFields.push('familyHistory = :familyHistory');
				updateValues[':familyHistory'] = familyHistory || '';
			}
			if (allergies !== undefined) {
				updateFields.push('allergies = :allergies');
				updateValues[':allergies'] = allergies || '';
			}

			if (updateFields.length > 0) {
				updateFields.push('updated_at = :updated_at');
				const updateExpr = `SET ${updateFields.join(', ')}`;
				await updateItem(
					TABLES.PATIENTS,
					{ doctor_id: doctorId, patient_id: finalPatientId }, // Composite key
					updateExpr,
					updateValues,
					updateNames
				);
			}
			
			// Return updated patient info
			const updatedPatient = await getItem(TABLES.PATIENTS, { doctor_id: doctorId, patient_id: finalPatientId });
			return successResponse({ 
				patient: { 
					nic: finalNic, 
					name: updatedPatient?.name || name, 
					birthday: updatedPatient?.birthday || birthday || null,
					phoneNumber: updatedPatient?.phone_number || phoneNumber || '',
					age: updatedPatient?.age || age,
					gender: updatedPatient?.gender || gender || '',
					pastMedicalHistory: updatedPatient?.pastMedicalHistory || pastMedicalHistory || '',
					familyHistory: updatedPatient?.familyHistory || familyHistory || '',
					allergies: updatedPatient?.allergies || allergies || ''
				}
			});
		}

		// Always create a new visit - allow multiple visits per day
		// Each visit is unique by timestamp, so doctors can add multiple visits on the same day

		// Create or update patient
		if (!patient) {
			// Create new patient - all fields optional except name
			// Composite key: doctor_id (PK) + patient_id (SK)
			patient = {
				doctor_id: doctorId, // Partition Key
				patient_id: finalPatientId, // Sort Key
				nic: finalNic || null, // Optional
				name,
				birthday: birthday || null, // Optional
				phone_number: phoneNumber || null, // Optional
				age: age || null, // Optional (calculated from birthday if provided)
				gender: gender || '',
				pastMedicalHistory: pastMedicalHistory || '',
				familyHistory: familyHistory || '',
				allergies: allergies || '',
				created_at: visitTimestamp,
				updated_at: visitTimestamp
			};
			await putItem(TABLES.PATIENTS, patient);
		} else {
			// Update patient info (including new fields)
			const updateFields = [];
			const updateValues = { ':updated_at': visitTimestamp };
			const updateNames = {};

			if (name && name !== patient.name) {
				updateFields.push('#name = :name');
				updateValues[':name'] = name;
				updateNames['#name'] = 'name';
			}
			if (birthday !== undefined && birthday !== patient.birthday) {
				updateFields.push('birthday = :birthday');
				updateValues[':birthday'] = birthday || null;
				if (age !== null) {
					updateFields.push('age = :age');
					updateValues[':age'] = age;
				}
			}
			if (phoneNumber !== undefined && phoneNumber !== patient.phone_number) {
				updateFields.push('phone_number = :phone_number');
				updateValues[':phone_number'] = phoneNumber || '';
			}
			if (gender !== undefined && gender !== patient.gender) {
				updateFields.push('gender = :gender');
				updateValues[':gender'] = gender || '';
			}
			if (pastMedicalHistory !== undefined) {
				updateFields.push('pastMedicalHistory = :pastMedicalHistory');
				updateValues[':pastMedicalHistory'] = pastMedicalHistory || '';
			}
			if (familyHistory !== undefined) {
				updateFields.push('familyHistory = :familyHistory');
				updateValues[':familyHistory'] = familyHistory || '';
			}
			if (allergies !== undefined) {
				updateFields.push('allergies = :allergies');
				updateValues[':allergies'] = allergies || '';
			}

			if (updateFields.length > 0) {
				updateFields.push('updated_at = :updated_at');
				const updateExpr = `SET ${updateFields.join(', ')}`;
				await updateItem(
					TABLES.PATIENTS,
					{ doctor_id: doctorId, patient_id: finalPatientId }, // Composite key
					updateExpr,
					updateValues,
					updateNames
				);
				// Refresh patient data
				patient = await getItem(TABLES.PATIENTS, { doctor_id: doctorId, patient_id: finalPatientId });
			}
		}

		// Get doctor's medicines for response
		const medicineRow = await getItem(TABLES.DOCTOR_ITEMS, { doctor_id: doctorId, item_type: 'M' });
		const medicines = medicineRow && medicineRow.items ? medicineRow.items : [];
		const medicineMap = new Map(medicines.map(m => [m.id, m]));

		// Create new visit
		const visit = {
			id: visitId,
			patient_id: finalPatientId, // Use patient_id instead of patient_nic
			date: visitTimestamp,
			doctor_id: doctorId,
			notes: notes || '',
			presentingComplaint: presentingComplaint || '',
			examinationFindings: examinationFindings || '',
			investigations: Array.isArray(investigations) ? investigations : (investigations ? [{ investigationName: investigations, result: '', date: '' }] : []),
			bloodPressureReadings: Array.isArray(bloodPressureReadings) ? bloodPressureReadings : [],
			investigationsToDo: Array.isArray(investigationsToDo) ? investigationsToDo : [],
			prescriptions: prescriptions.map(p => ({
				medicine_id: p.medicineId,
				brand: p.brand || '', // Brand name (predefined or custom)
				dosage: p.dosage || '',
				duration: p.duration || '',
				durationUnit: p.durationUnit || 'weeks'
			})),
			referralLetter: generateReferralLetter ? {
				referralDoctorName: referralDoctorName || '',
				referralLetterBody: referralLetterBody || ''
			} : null,
			created_at: visitTimestamp
		};

		await putItem(TABLES.VISITS, visit);

		const visitResponse = {
			id: visitId,
			date: visitTimestamp,
			notes: notes || '',
			presentingComplaint: presentingComplaint || '',
			examinationFindings: examinationFindings || '',
			investigations: Array.isArray(investigations) ? investigations : (investigations ? [{ investigationName: investigations, result: '', date: '' }] : []),
			bloodPressureReadings: Array.isArray(bloodPressureReadings) ? bloodPressureReadings : [],
			investigationsToDo: Array.isArray(investigationsToDo) ? investigationsToDo : [],
			prescriptions: prescriptions.map(p => {
				const med = medicineMap.get(p.medicineId);
				return med ? { 
					...med, 
					brand: p.brand || '',
					dosage: p.dosage || '',
					duration: p.duration || '',
					durationUnit: p.durationUnit || 'weeks'
				} : null;
			}).filter(Boolean),
			referralLetter: generateReferralLetter ? {
				referralDoctorName: referralDoctorName || '',
				referralLetterBody: referralLetterBody || ''
			} : null
		};

		// Return updated patient info
		const updatedPatient = await getItem(TABLES.PATIENTS, { doctor_id: doctorId, patient_id: finalPatientId });
		return successResponse({ 
			patient: { 
				patientId: finalPatientId,
				nic: updatedPatient?.nic || finalNic || null, 
				name: updatedPatient?.name || name, 
				birthday: updatedPatient?.birthday || birthday || null,
				phoneNumber: updatedPatient?.phone_number || phoneNumber || '',
				age: updatedPatient?.age || age,
				gender: updatedPatient?.gender || gender || '',
				pastMedicalHistory: updatedPatient?.pastMedicalHistory || pastMedicalHistory || '',
				familyHistory: updatedPatient?.familyHistory || familyHistory || '',
				allergies: updatedPatient?.allergies || allergies || ''
			}, 
			visit: visitResponse 
		}, 201);
	} catch (error) {
		console.error('Create visit error:', error);
		if (error.name === 'ConditionalCheckFailedException') {
			return errorResponse('A visit already exists for this patient, doctor, and date', 409);
		}
		return errorResponse('Internal server error', 500);
	}
}

export async function updateVisitHandler(event) {
	try {
		const token = extractToken(event);
		if (!token) {
			return errorResponse('Unauthorized', 401);
		}

		const doctorId = await verifyToken(token);
		if (!doctorId) {
			return errorResponse('Unauthorized', 401);
		}

		const visitId = event.pathParameters?.id;
		if (!visitId) {
			return errorResponse('Visit ID is required', 400);
		}

		// Get existing visit using GSI on id field
		const visits = await queryItems(
			TABLES.VISITS,
			'id = :id',
			{ ':id': visitId },
			{},
			'visit-id-index'
		);
		
		if (!visits || visits.length === 0) {
			return errorResponse('Visit not found', 404);
		}
		
		const existingVisit = visits[0];

		if (existingVisit.doctor_id !== doctorId) {
			return errorResponse('Unauthorized to update this visit', 403);
		}

		const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || '{}');
		const { 
			prescriptions, 
			presentingComplaint, 
			examinationFindings, 
			investigations, 
			bloodPressureReadings,
			investigationsToDo,
			notes, 
			generateReferralLetter, 
			referralDoctorName, 
			referralLetterBody 
		} = body;

		if (!Array.isArray(prescriptions)) {
			return errorResponse('prescriptions (array) is required', 400);
		}

		// Validate prescriptions structure
		for (const p of prescriptions) {
			if (!p.medicineId) {
				return errorResponse('Each prescription must have medicineId', 400);
			}
		}

		// Update visit
		const updatedVisit = {
			...existingVisit,
			notes: notes || '',
			presentingComplaint: presentingComplaint || '',
			examinationFindings: examinationFindings || '',
			investigations: Array.isArray(investigations) ? investigations : (investigations ? [{ investigationName: investigations, result: '', date: '' }] : []),
			bloodPressureReadings: Array.isArray(bloodPressureReadings) ? bloodPressureReadings : [],
			investigationsToDo: Array.isArray(investigationsToDo) ? investigationsToDo : [],
			prescriptions: prescriptions.map(p => ({
				medicine_id: p.medicineId,
				brand: p.brand || '',
				dosage: p.dosage || '',
				duration: p.duration || '',
				durationUnit: p.durationUnit || 'months'
			})),
			referralLetter: generateReferralLetter ? {
				referralDoctorName: referralDoctorName || '',
				referralLetterBody: referralLetterBody || ''
			} : null,
			updated_at: new Date().toISOString()
		};

		await putItem(TABLES.VISITS, updatedVisit);

		return successResponse({ 
			message: 'Visit updated successfully',
			visit: {
				id: visitId,
				date: updatedVisit.date
			}
		}, 200);
	} catch (error) {
		console.error('Update visit error:', error);
		return errorResponse('Failed to update visit: ' + error.message, 500);
	}
}

// Search patients handler - multi-criteria search
// IMPORTANT: All patient searches are scoped to the current doctor (from JWT token)
export async function searchPatientsHandler(event) {
	try {
		const token = extractToken(event);
		if (!token) {
			return errorResponse('Unauthorized', 401);
		}

		// Extract doctor ID from JWT token - this ensures search is scoped to current doctor
		const doctorId = await verifyToken(token);
		if (!doctorId) {
			return errorResponse('Unauthorized', 401);
		}

		// Get query parameters
		const queryParams = event.queryStringParameters || {};
		const { name, nic, phoneNumber, birthday } = queryParams;

		// At least one search criteria is required
		if (!name && !nic && !phoneNumber && !birthday) {
			return errorResponse('At least one search criteria (name, nic, phoneNumber, or birthday) is required', 400);
		}

		// Scan patients table and filter by doctor_id
		// Note: Since patients table uses NIC as PK, we need to scan and filter
		const allPatients = await scanTable(
			TABLES.PATIENTS,
			'doctor_id = :doctor_id',
			{ ':doctor_id': doctorId }
		);

		// Filter by search criteria (case-insensitive partial match)
		let filteredPatients = allPatients;

		if (name) {
			const nameLower = name.toLowerCase().trim();
			filteredPatients = filteredPatients.filter(p => 
				p.name && p.name.toLowerCase().includes(nameLower)
			);
		}

		if (nic) {
			const nicLower = nic.toLowerCase().trim();
			filteredPatients = filteredPatients.filter(p => 
				p.nic && p.nic.toLowerCase().includes(nicLower)
			);
		}

		if (phoneNumber) {
			const phoneClean = phoneNumber.replace(/\D/g, ''); // Remove non-digits
			filteredPatients = filteredPatients.filter(p => {
				if (!p.phone_number) return false;
				const patientPhoneClean = p.phone_number.replace(/\D/g, '');
				return patientPhoneClean.includes(phoneClean);
			});
		}

		if (birthday) {
			// Exact match on birthday (YYYY-MM-DD format)
			filteredPatients = filteredPatients.filter(p => 
				p.birthday === birthday
			);
		}

		// Deduplicate patients using composite key from available fields
		// Priority: NIC > phone_number > (name + birthday) > name alone
		const uniquePatientsMap = new Map();
		
		filteredPatients.forEach(p => {
			// Create a unique key from available fields
			let uniqueKey = null;
			
			// Priority 1: Use NIC if available (most specific)
			if (p.nic && p.nic.trim()) {
				uniqueKey = `nic:${p.nic.toLowerCase().trim()}`;
			}
			// Priority 2: Use phone number if available (normalize by removing non-digits)
			else if (p.phone_number && p.phone_number.trim()) {
				const phoneClean = p.phone_number.replace(/\D/g, '');
				if (phoneClean) {
					uniqueKey = `phone:${phoneClean}`;
				}
			}
			// Priority 3: Use name + birthday combination if both available
			else if (p.name && p.name.trim() && p.birthday && p.birthday.trim()) {
				uniqueKey = `name_birthday:${p.name.toLowerCase().trim()}_${p.birthday}`;
			}
			// Priority 4: Use name alone as fallback (least specific, but better than nothing)
			else if (p.name && p.name.trim()) {
				uniqueKey = `name:${p.name.toLowerCase().trim()}`;
			}
			
			// Only add if we have a valid unique key and haven't seen it before
			if (uniqueKey && !uniquePatientsMap.has(uniqueKey)) {
				uniquePatientsMap.set(uniqueKey, p);
			}
		});

		// Format response
		const patients = Array.from(uniquePatientsMap.values()).map(p => ({
			patientId: p.patient_id || p.nic, // Use patient_id if exists, otherwise NIC
			nic: p.nic || '',
			name: p.name || '',
			birthday: p.birthday || null,
			phoneNumber: p.phone_number || '',
			age: p.age || (p.birthday ? calculateAge(p.birthday) : null),
			gender: p.gender || ''
		}));

		return successResponse({ patients });
	} catch (error) {
		console.error('Search patients error:', error);
		return errorResponse('Internal server error', 500);
	}
}

// Get patient by patientId handler
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

		// Support both patientId (new) and nic (legacy) for backward compatibility
		const patientId = event.pathParameters?.patientId;
		const nic = event.pathParameters?.nic;
		
		let patient;
		
		if (patientId) {
			// Look up by patientId using composite key
			patient = await getItem(TABLES.PATIENTS, { doctor_id: doctorId, patient_id: patientId });
			if (!patient) {
				return errorResponse('Patient not found', 404);
			}
		} else if (nic) {
			// Legacy: Look up by NIC (scan and filter)
			const allPatients = await scanTable(
				TABLES.PATIENTS,
				'doctor_id = :doctor_id',
				{ ':doctor_id': doctorId }
			);
			patient = allPatients.find(p => p.nic === nic);
			if (!patient) {
				return errorResponse('Patient not found', 404);
			}
		} else {
			return errorResponse('patientId or nic parameter is required', 400);
		}

		// Get visits for this patient
		const visits = await queryItems(
			TABLES.VISITS,
			'patient_id = :patient_id',
			{ ':patient_id': patient.patient_id }
		);

		// Filter visits by doctor_id and get doctor's medicines
		const medicineRow = await getItem(TABLES.DOCTOR_ITEMS, { doctor_id: doctorId, item_type: 'M' });
		const medicines = medicineRow && medicineRow.items ? medicineRow.items : [];
		const medicineMap = new Map(medicines.map(m => [m.id, m]));

		const filteredVisits = visits
			.filter(v => v.doctor_id === doctorId)
			.sort((a, b) => new Date(b.date) - new Date(a.date))
			.map(v => ({
				id: v.id,
				date: v.date,
				notes: v.notes || '',
				presentingComplaint: v.presentingComplaint || '',
				examinationFindings: v.examinationFindings || '',
				investigations: Array.isArray(v.investigations) ? v.investigations : (v.investigations ? [{ investigationName: v.investigations, result: '', date: '' }] : []),
				investigationsToDo: Array.isArray(v.investigationsToDo) ? v.investigationsToDo : [],
				bloodPressureReadings: Array.isArray(v.bloodPressureReadings) ? v.bloodPressureReadings : [],
				prescriptions: (v.prescriptions || []).map(p => {
					const med = medicineMap.get(p.medicine_id);
					return med ? { 
						...med, 
						brand: p.brand || '',
						dosage: p.dosage || '',
						duration: p.duration || '',
						durationUnit: p.durationUnit || 'weeks'
					} : null;
				}).filter(Boolean),
				referralLetter: v.referralLetter || null
			}));

		return successResponse({
			patientId: patient.patient_id,
			nic: patient.nic || null,
			name: patient.name,
			birthday: patient.birthday || null,
			phoneNumber: patient.phone_number || '',
			age: patient.age || (patient.birthday ? calculateAge(patient.birthday) : null),
			gender: patient.gender || '',
			pastMedicalHistory: patient.pastMedicalHistory || '',
			familyHistory: patient.familyHistory || '',
			allergies: patient.allergies || '',
			visits: filteredVisits
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

// Get drug history handler
export async function getDrugHistoryHandler(event) {
	try {
		const token = extractToken(event);
		if (!token) {
			return errorResponse('Unauthorized', 401);
		}

		const doctorId = await verifyToken(token);
		if (!doctorId) {
			return errorResponse('Unauthorized', 401);
		}

		const patientId = event.pathParameters?.patientId;
		if (!patientId) {
			return errorResponse('patientId parameter is required', 400);
		}

		// Get patient record (which contains drug history)
		const patient = await getItem(TABLES.PATIENTS, { 
			doctor_id: doctorId, 
			patient_id: patientId 
		});

		// Return empty array if no patient or no drug history exists
		const drugs = patient?.drug_history || [];
		
		return successResponse({ drugs });
	} catch (error) {
		console.error('Get drug history error:', error);
		return errorResponse('Internal server error', 500);
	}
}

// Update drug history handler
export async function updateDrugHistoryHandler(event) {
	try {
		const token = extractToken(event);
		if (!token) {
			return errorResponse('Unauthorized', 401);
		}

		const doctorId = await verifyToken(token);
		if (!doctorId) {
			return errorResponse('Unauthorized', 401);
		}

		const patientId = event.pathParameters?.patientId;
		if (!patientId) {
			return errorResponse('patientId parameter is required', 400);
		}

		// REST API: body is a string, need to parse
		const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || '{}');
		const { drugs } = body;

		if (!Array.isArray(drugs)) {
			return errorResponse('drugs must be an array', 400);
		}

		// Validate each drug entry
		for (const drug of drugs) {
			if (!drug.medicine_id || !drug.medicine_name) {
				return errorResponse('Each drug must have medicine_id and medicine_name', 400);
			}
		}

		// Check if patient exists
		const patient = await getItem(TABLES.PATIENTS, { 
			doctor_id: doctorId, 
			patient_id: patientId 
		});

		if (!patient) {
			return errorResponse('Patient not found', 404);
		}

		const timestamp = new Date().toISOString();

		// Update patient record with drug history
		await updateItem(
			TABLES.PATIENTS,
			{ doctor_id: doctorId, patient_id: patientId },
			'SET drug_history = :drug_history, updated_at = :updated_at',
			{
				':drug_history': drugs,
				':updated_at': timestamp
			}
		);

		return successResponse({ drugs }, 200);
	} catch (error) {
		console.error('Update drug history error:', error);
		return errorResponse('Internal server error', 500);
	}
}

