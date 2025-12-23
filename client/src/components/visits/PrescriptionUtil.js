export function buildPrescriptionHTML({ doctorName, patient, visit, medicines, notes, presentingComplaint, examinationFindings, investigations, investigationsToDo }) {
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
			.patient-info { 
				margin-bottom: 10px;
				font-size: 16px;
				line-height: 1.5;
			}
			.patient-info div {
				margin-bottom: 2px;
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
			.treatment-list.two-columns {
				column-count: 2;
				column-gap: 15px;
			}
			.treatment-list li {
				margin-bottom: 4px;
				line-height: 1.4;
				break-inside: avoid;
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
	const medicinesList = medicines.length
		? medicines.map((m, idx) => {
		const dosage = m.dosage ? ` ${escapeHtml(m.dosage)}` : '';
		const duration = m.duration && m.durationUnit 
			? m.durationUnit === 'sos' 
				? ` ${escapeHtml(m.duration)} SOS`
				: ` for ${escapeHtml(m.duration)} ${escapeHtml(m.durationUnit === 'weeks' ? 'months' : m.durationUnit === 'days' ? 'days' : 'months')}`
			: m.durationUnit === 'sos' ? ' SOS' : '';
			const displayName = m.brand && m.brand.trim()
				? `${escapeHtml(m.brand)}${dosage}${duration}`
				: `${escapeHtml(m.name)}${dosage}${duration}`;
			return `<li>${displayName}</li>`;
		}).join('')
		: '<li>No medicines prescribed</li>';
	
	// Determine if we need two columns based on number of medicines
	// A5 can fit approximately 12-15 medicines in single column depending on text length
	// Use two columns if more than 12 medicines
	const useTwoColumns = medicines.length > 12;
	
	const dateStr = new Date(visit.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
		
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
					<ol class="treatment-list${useTwoColumns ? ' two-columns' : ''}">
						${medicinesList}
					</ol>
					
					
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

