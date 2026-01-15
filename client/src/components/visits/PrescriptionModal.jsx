import React, { useRef, useEffect } from 'react';
import { buildPrescriptionHTML } from './PrescriptionUtil.js';

export default function PrescriptionModal({ open, onClose, doctorName, patient, visit, medicines, notes }) {
	const iframeRef = useRef(null);

	useEffect(() => {
		if (open && iframeRef.current && patient && visit) {
		const investigationsData = Array.isArray(visit.investigations) 
			? visit.investigations 
			: (visit.investigations ? [{ investigationName: visit.investigations, result: '', date: '' }] : []);
		const html = buildPrescriptionHTML({ 
			doctorName, 
			patient, 
			visit: {
				...visit,
				bloodPressureReadings: visit.bloodPressureReadings || []
			}, 
			medicines, 
			notes: notes || '',
			presentingComplaint: visit.presentingComplaint || '',
			examinationFindings: visit.examinationFindings || '',
			investigations: investigationsData,
			investigationsToDo: visit.investigationsToDo || []
		});
			const iframe = iframeRef.current;
			const doc = iframe.contentDocument || iframe.contentWindow.document;
			doc.open();
			doc.write(html);
			doc.close();
		}
	}, [open, doctorName, patient, visit, medicines, notes]);

	if (!open) return null;

	function handlePrint() {
		if (iframeRef.current) {
			iframeRef.current.contentWindow.print();
		}
	}

	return (
		<div
			style={{
				position: 'fixed',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				background: 'rgba(0, 0, 0, 0.5)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				zIndex: 1000,
				padding: '20px'
			}}
			onClick={onClose}
		>
			<div
				className="modal-content"
				style={{
					background: 'white',
					borderRadius: '8px',
					width: '100%',
					maxHeight: '90vh',
					display: 'flex',
					flexDirection: 'column',
					boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
				}}
				onClick={(e) => e.stopPropagation()}
			>
				<div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
					<h3 style={{ margin: 0 }}>Prescription</h3>
					<div style={{ display: 'flex', gap: '8px' }}>
						<button onClick={handlePrint} className="primary">Print / Save PDF</button>
						<button onClick={onClose}>Close</button>
					</div>
				</div>
				<div style={{ flex: 1, overflow: 'auto' }}>
					<iframe
						ref={iframeRef}
						style={{
							width: '100%',
							height: '70vh',
							border: 'none'
						}}
						title="Prescription"
					/>
				</div>
			</div>
		</div>
	);
}

