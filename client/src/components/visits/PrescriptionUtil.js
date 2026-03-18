export function buildPrescriptionHTML({ doctorName, patient, visit, medicines, notes, presentingComplaint, examinationFindings, investigations, investigationsToDo, allergies, weightReadings }) {
	const styles = `
		<style>
			@page { 
				size: A5;
				margin: 10mm;
			}
			body { 
				font-family: 'Times New Roman', Times, serif; 
				color: #000; 
				padding: 0;
				margin: 0;
				font-size: 16px;
				line-height: 1.4;
			}
			.prescription-container {
				max-width: 148mm;
				margin: 0 auto;
				padding: 10mm;
				padding-top: 3mm;
				background: white;
			}
			.date-line {
				font-size: 15px;
				text-align: left;
			}
			.date-signature-container {
				display: flex;
				justify-content: space-between;
				align-items: flex-end;
				margin-top: 45px;
			}
			.patient-info-wrapper {
				display: flex;
				justify-content: space-between;
				align-items: flex-start;
				margin-bottom: 10px;
				gap: 5px;
				min-height: 60px;
			}
			.patient-info { 
				flex: 0 0 auto;
				min-width: 36%;
				font-size: 16px;
				line-height: 1.5;
			}
			.patient-info div {
				margin-bottom: 2px;
			}
			.past-medical-history {
				flex: 1;
				max-width: 60%;
				font-size: 13px;
				line-height: 1.4;
				text-align: right;
				padding-left: 5px;
				word-wrap: break-word;
				overflow-wrap: break-word;
			}
			.past-medical-history-label {
				font-weight: 600;
				margin-bottom: 4px;
				font-size: 14px;
			}
			.blood-pressure-section {
				font-size: 13px;
				color: #333;
				margin-top: 6px;
			}
			.weight-section {
				font-size: 13px;
				color: #333;
				margin-top: 4px;
			}
			.allergies-section {
				font-size: 13px;
				color: #333;
				margin-top: 12px;
				padding-top: 8px;
				border-top: 1px solid #e0e0e0;
			}
			.allergies-label {
				font-weight: 600;
				margin-bottom: 4px;
				font-size: 14px;
			}
			.clinical-info {
				margin-bottom: 12px;
				line-height: 1.5;
			}
			.divider {
				border-top: 1px solid #000;
				margin: 10px 0;
			}
			.section-title { 
				font-size: 17px;
				font-weight: 600;
				margin: 10px 0 8px 0;
			}
			.treatment-list {
				list-style-position: outside;
				padding-left: 20px;
				margin: 8px 0;
			}
			.treatment-list li {
				margin-bottom: 4px;
				line-height: 1.4;
				break-inside: avoid;
			}
			.investigation-results {
				margin-bottom: 8px;
				font-size: 15px;
				line-height: 1.5;
			}
			.investigation-results .inv-label {
				font-weight: 600;
			}
			.two-column-grid {
				display: flex;
				gap: 10px;
			}
			.two-column-grid .treatment-col {
				flex: 1;
				min-width: 0;
			}
			.two-column-grid .treatment-list {
				margin-top: 0;
			}
			.notes-section {
				margin-top: 12px;
				font-style: italic;
			}
			.doctor-signature {
				text-align: right;
			}
			.doctor-name {
				font-weight: 700;
				font-size: 17px;
				margin-bottom: 3px;
			}
			.doctor-credentials {
				font-size: 13px;
				color: #333;
			}
			.investigations-section {
				margin-top: 15px;
				padding-top: 10px;
				border-top: 1px solid #000;
			}
			.footer {
				margin-top: 20px;
				padding-top: 10px;
				border-top: 1px solid #000;
				font-size: 12px;
				text-align: center;
			}
			@media print {
				body { padding: 0; }
				.prescription-container { padding: 8mm; padding-top: 3mm; }
			}
		</style>
	`;
	const formatMedicine = (m) => {
		const dosage = m.dosage ? ` ${escapeHtml(m.dosage)}` : '';
		const duration = m.duration && m.durationUnit 
			? m.durationUnit === 'sos' 
				? ` ${escapeHtml(m.duration)} SOS`
				: ` for ${escapeHtml(m.duration)} ${escapeHtml(m.durationUnit === 'weeks' ? 'weeks' : m.durationUnit === 'days' ? 'days' : 'months')}`
			: m.durationUnit === 'sos' ? ' SOS' : '';
		const displayName = m.brand && m.brand.trim()
			? `${escapeHtml(m.brand)}${dosage}${duration}`
			: `${escapeHtml(m.name)}${dosage}${duration}`;
		return `<li>${displayName}</li>`;
	};

	// Split medicines into two columns when count exceeds 8
	// Each column holds max 8 medicines, but if total > 16, divide evenly
	const MAX_PER_COLUMN = 8;
	const useTwoColumns = medicines.length > MAX_PER_COLUMN;
	
	let treatmentHtml = '';
	if (medicines.length > 0) {
		if (useTwoColumns) {
			// Split evenly into two columns (e.g. 18 → 9+9, 12 → 6+6)
			const half = Math.ceil(medicines.length / 2);
			const leftMeds = medicines.slice(0, half);
			const rightMeds = medicines.slice(half);
			const leftHtml = leftMeds.map(formatMedicine).join('');
			const rightHtml = rightMeds.map(formatMedicine).join('');
			treatmentHtml = `
				<div class="section-title">Treatment:</div>
				<div class="two-column-grid">
					<div class="treatment-col">
						<ol class="treatment-list" start="1">
							${leftHtml}
						</ol>
					</div>
					<div class="treatment-col">
						<ol class="treatment-list" start="${half + 1}">
							${rightHtml}
						</ol>
					</div>
				</div>`;
		} else {
			const medicinesList = medicines.map(formatMedicine).join('');
			treatmentHtml = `
				<div class="section-title">Treatment:</div>
				<ol class="treatment-list">
					${medicinesList}
				</ol>`;
		}
	}
	
	// Build investigation results from THIS visit's date only (those with a result)
	const visitDateStr = visit.date ? new Date(visit.date).toISOString().slice(0, 10) : '';
	const investigationResultItems = (investigations || []).filter(inv => {
		if (!inv.investigationName || !inv.result || !inv.result.trim()) return false;
		// Only include investigations from the same day as this visit
		if (!inv.date) return false;
		const invDateStr = new Date(inv.date).toISOString().slice(0, 10);
		return invDateStr === visitDateStr;
	});
	const investigationResultsHtml = investigationResultItems.length > 0
		? `<div class="investigation-results">
			<span class="inv-label">Investigations:</span> ${investigationResultItems.map(inv => `${escapeHtml(inv.investigationName)}- ${escapeHtml(inv.result)}`).join(', ')}
		</div>`
		: '';

	const dateStr = new Date(visit.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
	
	// Parse allergies - can be JSON string or plain text
	let allergiesList = [];
	if (allergies) {
		try {
			const parsed = JSON.parse(allergies);
			if (Array.isArray(parsed)) {
				allergiesList = parsed.map(a => {
					if (a.type === 'medicine' && a.medicineName) {
						return `${escapeHtml(a.medicineName)} (medicine)`;
					} else if (a.type === 'other' && a.text) {
						return escapeHtml(a.text);
					}
					return '';
				}).filter(Boolean);
			}
		} catch {
			// If not JSON, treat as plain text
			if (typeof allergies === 'string' && allergies.trim()) {
				allergiesList = [escapeHtml(allergies.trim())];
			}
		}
	}
	
	const allergiesHtml = allergiesList.length > 0
		? `<div class="allergies-section">
			<span class="allergies-label">Allergies:</span> ${allergiesList.join(', ')}
		</div>`
		: '';
		
	// Get blood pressure reading for THIS visit's date only
	const visitDay = visit.date ? new Date(visit.date).toISOString().slice(0, 10) : '';
	const bpForVisit = (visit.bloodPressureReadings || []).filter(bp => {
		if (!bp.reading || !bp.date) return false;
		return new Date(bp.date).toISOString().slice(0, 10) === visitDay;
	});
	const mostRecentBP = bpForVisit.length > 0 ? bpForVisit[bpForVisit.length - 1] : null;

	// Get weight reading for THIS visit's date only
	const weightForVisit = (weightReadings || []).filter(w => {
		if (!w.weight || !w.date) return false;
		return new Date(w.date).toISOString().slice(0, 10) === visitDay;
	});
	const mostRecentWeight = weightForVisit.length > 0 ? weightForVisit[weightForVisit.length - 1] : null;
		
	const investigationsToDoHtml = investigationsToDo && Array.isArray(investigationsToDo) && investigationsToDo.length > 0
		? `<div class="allergies-section" style="margin-top: 2px; padding-top: 0; border-top: none;">
			<span class="allergies-label">Investigations to do:</span> ${escapeHtml(investigationsToDo.join(', '))}
		</div>`
		: '';
	return `
		<!doctype html>
		<html>
			<head>
				<meta charset="utf-8" />
				<title>Prescription - ${escapeHtml(patient.name)}</title>
				${styles}
			</head>
			<body>
				<div class="prescription-container">
					<div class="patient-info-wrapper">
						<div class="patient-info">
							<div>${escapeHtml(patient.name)}</div>
					<div>${escapeHtml(patient.nic)}</div>
					<div>${escapeHtml(String(patient.age))}yrs${patient.gender ? ', ' + escapeHtml(patient.gender) : ''}</div>
					${notes && notes.trim() ? `<div style="margin-top: 8px; font-size: 14px;">${escapeHtml(notes)}</div>` : ''}
				</div>
				${patient.pastMedicalHistory && patient.pastMedicalHistory.trim() ? `
					<div class="past-medical-history">
						<div class="past-medical-history-label">Past Medical History:</div>
						<div>${escapeHtml(patient.pastMedicalHistory)}</div>
					${mostRecentBP ? `
						<div class="blood-pressure-section">
							Blood Pressure: ${escapeHtml(mostRecentBP.reading)}
						</div>
					` : ''}
					${mostRecentWeight ? `
						<div class="weight-section">
							Weight: ${escapeHtml(mostRecentWeight.weight)}
						</div>
					` : ''}
					</div>
				` : mostRecentBP || mostRecentWeight ? `
					<div class="past-medical-history">
						${mostRecentBP ? `
							<div class="blood-pressure-section">
								Blood Pressure: ${escapeHtml(mostRecentBP.reading)}
							</div>
						` : ''}
						${mostRecentWeight ? `
							<div class="weight-section">
								Weight: ${escapeHtml(mostRecentWeight.weight)}
							</div>
						` : ''}
					</div>
				` : ''}
			</div>				<div class="divider"></div>					${investigationResultsHtml}
					${treatmentHtml}
					
					${allergiesHtml}
					${investigationsToDoHtml}
					
					<div class="date-signature-container">
						<div class="date-line">${dateStr}</div>
						<div class="doctor-signature">
							<div class="doctor-name">Dr. ${escapeHtml(doctorName || 'Doctor')}</div>
							<div class="doctor-credentials">Consultant Physician</div>
						</div>
					</div>
				</div>
			</body>
		</html>
	`;
}

function escapeHtml(str) {
	return String(str)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

