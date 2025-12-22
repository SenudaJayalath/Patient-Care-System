export function buildPrescriptionHTML({ doctorName, patient, visit, medicines, notes, presentingComplaint, examinationFindings, investigations, investigationsToDo }) {
	const styles = `
		<style>
			@page { margin: 20mm; }
			body { 
				font-family: 'Times New Roman', Times, serif; 
				color: #000; 
				padding: 0;
				margin: 0;
				font-size: 16px;
				line-height: 1.6;
			}
			.prescription-container {
				max-width: 210mm;
				margin: 0 auto;
				padding: 15mm;
				padding-top: 38mm;
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
				margin-top: 40px;
			}
			.patient-info { 
				margin-bottom: 15px;
				font-size: 16px;
				line-height: 1.8;
			}
			.patient-info div {
				margin-bottom: 3px;
			}
			.clinical-info {
				margin-bottom: 20px;
				line-height: 1.8;
			}
			.divider {
				border-top: 1px solid #000;
				margin: 15px 0;
			}
			.section-title { 
				font-size: 17px;
				font-weight: 600;
				margin: 15px 0 10px 0;
			}
			.treatment-list {
				list-style-position: outside;
				padding-left: 25px;
				margin: 10px 0;
			}
			.treatment-list li {
				margin-bottom: 8px;
				line-height: 1.6;
			}
			.notes-section {
				margin-top: 20px;
				font-style: italic;
			}
			.doctor-signature {
				text-align: right;
			}
			.doctor-name {
				font-weight: 700;
				font-size: 17px;
				margin-bottom: 5px;
			}
			.doctor-credentials {
				font-size: 13px;
				color: #333;
			}
			.investigations-section {
				margin-top: 25px;
				padding-top: 15px;
				border-top: 1px solid #000;
			}
			.footer {
				margin-top: 30px;
				padding-top: 15px;
				border-top: 1px solid #000;
				font-size: 12px;
				text-align: center;
			}
			@media print {
				body { padding: 0; }
				.prescription-container { padding: 10mm; }
			}
		</style>
	`;
	const medicinesList = medicines.length
		? medicines.map((m, idx) => {
			const dosage = m.dosage ? ` ${escapeHtml(m.dosage)}` : '';
			const duration = m.duration && m.durationUnit 
				? ` for ${escapeHtml(m.duration)} ${escapeHtml(m.durationUnit === 'weeks' ? 'months' : m.durationUnit === 'days' ? 'days' : 'months')}`
				: '';
			const displayName = m.brand && m.brand.trim()
				? `${escapeHtml(m.brand)}${dosage}${duration}`
				: `${escapeHtml(m.name)}${dosage}${duration}`;
			return `<li>${displayName}</li>`;
		}).join('')
		: '<li>No medicines prescribed</li>';
	
	const dateStr = new Date(visit.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
	
	const notesHtml = notes && notes.trim() 
		? `<div class="notes-section">Please repeat once</div>`
		: '';
	
	const investigationsToDoHtml = investigationsToDo && Array.isArray(investigationsToDo) && investigationsToDo.length > 0
		? `<div class="investigations-section">
			<strong>${escapeHtml(investigationsToDo.join(', '))}</strong>
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
					<div class="patient-info">
					<div>${escapeHtml(patient.name)}</div>
					<div>${escapeHtml(patient.nic)}</div>
					<div>${escapeHtml(String(patient.age))}yrs${patient.gender ? ', ' + escapeHtml(patient.gender) : ''}</div>
					${notes && notes.trim() ? `<div style="margin-top: 8px; font-size: 14px;">${escapeHtml(notes)}</div>` : ''}
				</div>
				
				<div class="divider"></div>					<div class="section-title">Treatment:</div>
					<ol class="treatment-list">
						${medicinesList}
					</ol>
					
					${notesHtml}
					
					<div class="date-signature-container">
						<div class="date-line">${dateStr}</div>
						<div class="doctor-signature">
							<div class="doctor-name">Dr. ${escapeHtml(doctorName || 'Doctor')}</div>
							<div class="doctor-credentials">Consultant Physician</div>
						</div>
					</div>
					
					${investigationsToDoHtml}
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

