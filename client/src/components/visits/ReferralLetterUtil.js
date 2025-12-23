export function buildReferralLetterHTML({ doctorName, patient, visit, referralDoctorName, referralLetterBody }) {
	const styles = `
		<style>
			body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #111827; padding: 40px; padding-top: 3mm; max-width: 800px; margin: 0 auto; }
			.letter-title { text-align: center; font-size: 24px; font-weight: 700; margin: 20px 0 30px 0; }
			.date-section { text-align: right; margin-bottom: 20px; color: #374151; font-size: 16px; }
			.patient-details-section { margin-bottom: 20px; }
			.patient-details-title { font-weight: 600; margin-bottom: 8px; font-size: 16px; color: #374151; }
			.patient-details-content { font-size: 16px; line-height: 1.8; }
			.patient-detail-item { margin-bottom: 4px; }
			.patient-label { color: #6b7280; }
			.patient-value { text-decoration: underline; font-weight: 600; color: #111827; }
			.to-section { margin-bottom: 20px; font-size: 16px; }
			.body-section { margin-bottom: 20px; font-size: 16px; line-height: 1.8; white-space: pre-wrap; }
			.remark-section { margin-top: 20px; margin-bottom: 20px; }
			.remark-label { font-weight: 600; margin-bottom: 8px; font-size: 16px; }
			.regards-section { margin-top: 30px; margin-bottom: 20px; font-size: 16px; }
			.signature-section { margin-top: 40px; }
			.signature-name { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
			.doctor-name { font-size: 16px; color: #374151; }
		</style>
	`;
	
	const dateStr = new Date(visit.date).toLocaleDateString('en-US', { 
		year: 'numeric', 
		month: '2-digit', 
		day: '2-digit' 
	});
	
	const genderDisplay = patient.gender ? (patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1).toLowerCase()) : '';
	const genderAbbr = genderDisplay === 'Male' ? 'M' : genderDisplay === 'Female' ? 'F' : '';
	
	return `
		<!doctype html>
		<html>
			<head>
				<meta charset="utf-8" />
				<title>Referral Letter - ${escapeHtml(patient.nic)}</title>
				${styles}
			</head>
			<body>
				<div class="letter-title">Referral Letter</div>
				
				<div class="date-section">
					Date: <span style="text-decoration: underline;">${escapeHtml(dateStr)}</span>
				</div>
				
				<div class="patient-details-section">
					<div class="patient-details-title">Patient Details:</div>
					<div class="patient-details-content">
						<div class="patient-detail-item">
							<span class="patient-label">Name: </span>
							<span class="patient-value">${escapeHtml(patient.name)}</span>
						</div>
						<div class="patient-detail-item">
							<span class="patient-label">Gender: </span>
							<span class="patient-value">${genderAbbr ? escapeHtml(genderAbbr) : ''}</span>
							<span class="patient-label" style="margin-left: 20px;">Age: </span>
							<span class="patient-value">${escapeHtml(String(patient.age))}</span>
						</div>
					</div>
				</div>
				
				<div class="to-section">
					To ${escapeHtml(referralDoctorName || 'Specialist')},
				</div>
				
				<div class="body-section">
					${escapeHtml(referralLetterBody || 'This is to certify that the above-named patient requires specialist consultation.')}
				</div>
				
				<div class="remark-section">
					<div class="remark-label">Remark:</div>
					<div style="min-height: 40px; border-bottom: 1px solid #e5e7eb;"></div>
				</div>
				
				<div class="regards-section">
					Regards,
				</div>
				
				<div class="signature-section">
					<div class="signature-name">Dr. ${escapeHtml(doctorName || 'Doctor')}</div>
				</div>
			</body>
		</html>
	`;
}

function escapeHtml(str) {
	return String(str || '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

