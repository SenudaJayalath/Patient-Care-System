const API_BASE = 'https://tlwcqoenh9.execute-api.us-east-1.amazonaws.com/dev';

export async function apiLogin({ username, password }) {
	const res = await fetch(`${API_BASE}/api/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password })
	});
	if (!res.ok) throw new Error('Login failed');
	return await res.json();
}

export async function apiLogout(token) {
	const res = await fetch(`${API_BASE}/api/logout`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!res.ok) throw new Error('Logout failed');
	return await res.json();
}

export async function apiGetMedicines(token) {
	const res = await fetch(`${API_BASE}/api/medicines`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!res.ok) throw new Error('Failed to load medicines');
	return await res.json();
}

export async function apiCreateMedicine(token, { name, brands }) {
	const res = await fetch(`${API_BASE}/api/medicines`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({ name, brands: brands || [] })
	});
	if (!res.ok) throw new Error('Failed to create medicine');
	return await res.json();
}

export async function apiAddBrandToMedicine(token, { medicineId, brand }) {
	const res = await fetch(`${API_BASE}/api/medicines/${medicineId}/brands`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({ brand })
	});
	if (!res.ok) throw new Error('Failed to add brand');
	return await res.json();
}

export async function apiGetInvestigations(token) {
	const res = await fetch(`${API_BASE}/api/investigations`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!res.ok) throw new Error('Failed to load investigations');
	return await res.json();
}

export async function apiCreateInvestigation(token, { name, category }) {
	const res = await fetch(`${API_BASE}/api/investigations`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({ name, category: category || '' })
	});
	if (!res.ok) throw new Error('Failed to create investigation');
	return await res.json();
}

export async function apiCreateVisit(token, { patientId, name, birthday, phoneNumber, nic, gender, pastMedicalHistory, familyHistory, allergies, prescriptions, presentingComplaint, examinationFindings, investigations, bloodPressureReadings, investigationsToDo, notes, generateReferralLetter, referralDoctorName, referralLetterBody }) {
	const res = await fetch(`${API_BASE}/api/visits`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({ 
			patientId: patientId || undefined,
			name, 
			birthday: birthday || undefined,
			phoneNumber: phoneNumber || undefined,
			nic: nic || undefined,
			gender: gender || '',
			pastMedicalHistory: pastMedicalHistory || '',
			familyHistory: familyHistory || '',
			allergies: allergies || '',
			prescriptions,
			presentingComplaint: presentingComplaint || '',
			examinationFindings: examinationFindings || '',
			investigations: investigations || '',
			bloodPressureReadings: bloodPressureReadings || [],
			investigationsToDo: investigationsToDo || [],
			notes: notes || '',
			generateReferralLetter: generateReferralLetter || false,
			referralDoctorName: referralDoctorName || '',
			referralLetterBody: referralLetterBody || ''
		})
	});
	if (!res.ok) throw new Error('Failed to create visit');
	return await res.json();
}

export async function apiUpdateVisit(token, visitId, { prescriptions, presentingComplaint, examinationFindings, investigations, bloodPressureReadings, investigationsToDo, notes, generateReferralLetter, referralDoctorName, referralLetterBody }) {
	const res = await fetch(`${API_BASE}/api/visits/${visitId}`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({ 
			prescriptions,
			presentingComplaint: presentingComplaint || '',
			examinationFindings: examinationFindings || '',
			investigations: investigations || '',
			bloodPressureReadings: bloodPressureReadings || [],
			investigationsToDo: investigationsToDo || [],
			notes: notes || '',
			generateReferralLetter: generateReferralLetter || false,
			referralDoctorName: referralDoctorName || '',
			referralLetterBody: referralLetterBody || ''
		})
	});
	if (!res.ok) throw new Error('Failed to update visit');
	return await res.json();
}

// Search patients - searches are automatically scoped to the current doctor
// The doctor ID is extracted from the JWT token on the backend (secure - cannot be tampered with)
export async function apiSearchPatients(token, { name, nic, phoneNumber, birthday }) {
	const params = new URLSearchParams();
	if (name) params.append('name', name);
	if (nic) params.append('nic', nic);
	if (phoneNumber) params.append('phoneNumber', phoneNumber);
	if (birthday) params.append('birthday', birthday);
	
	const res = await fetch(`${API_BASE}/api/patients/search?${params.toString()}`, {
		headers: { Authorization: `Bearer ${token}` } // Token contains doctorId - backend extracts it
	});
	if (!res.ok) throw new Error('Failed to search patients');
	return await res.json();
}

export async function apiGetPatientById(token, patientId) {
	const res = await fetch(`${API_BASE}/api/patients/${encodeURIComponent(patientId)}`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!res.ok) {
		if (res.status === 404) return null;
		throw new Error('Failed to load patient');
	}
	return await res.json();
}

// Legacy function for backward compatibility - now uses search
export async function apiGetPatientByNic(token, nic) {
	if (!nic) return null;
	const result = await apiSearchPatients(token, { nic });
	if (result.patients && result.patients.length > 0) {
		// Return the first matching patient with full details
		return await apiGetPatientById(token, result.patients[0].patientId);
	}
	return null;
}

// Get drug history for a patient
export async function apiGetDrugHistory(token, patientId) {
	const res = await fetch(`${API_BASE}/api/patients/${encodeURIComponent(patientId)}/drug-history`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!res.ok) {
		if (res.status === 404) return { drugs: [] };
		throw new Error('Failed to load drug history');
	}
	return await res.json();
}

// Update drug history for a patient
export async function apiUpdateDrugHistory(token, patientId, drugs) {
	const res = await fetch(`${API_BASE}/api/patients/${encodeURIComponent(patientId)}/drug-history`, {
		method: 'PUT',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({ drugs })
	});
	if (!res.ok) throw new Error('Failed to update drug history');
	return await res.json();
}

