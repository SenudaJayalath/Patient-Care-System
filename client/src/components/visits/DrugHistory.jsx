import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiGetDrugHistory, apiUpdateDrugHistory } from '../../api.js';

export default function DrugHistory({ patientId, medicines }) {
	const { token } = useAuth();
	const [drugs, setDrugs] = useState([]);
	const [loading, setLoading] = useState(true);
	const [editing, setEditing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [message, setMessage] = useState('');
	
	// For adding new drug
	const [medQuery, setMedQuery] = useState('');
	const [showMedDropdown, setShowMedDropdown] = useState(false);
	const [selectedMedicine, setSelectedMedicine] = useState(null);
	const [brandInput, setBrandInput] = useState('');
	const [doseInput, setDoseInput] = useState('');
	const medInputRef = useRef(null);
	const medDropdownRef = useRef(null);
	const medContainerRef = useRef(null);

	// Load drug history when patientId changes
	useEffect(() => {
		if (!patientId) {
			setDrugs([]);
			setLoading(false);
			return;
		}

		let isMounted = true;
		(async () => {
			try {
				setLoading(true);
				setError('');
				const result = await apiGetDrugHistory(token, patientId);
				if (isMounted) {
					setDrugs(result.drugs || []);
				}
			} catch (e) {
				if (isMounted) {
					setError('Failed to load drug history');
					console.error('Error loading drug history:', e);
				}
			} finally {
				if (isMounted) setLoading(false);
			}
		})();

		return () => { isMounted = false; };
	}, [patientId, token]);

	// Filter medicines based on query
	const filteredMedicines = medicines.filter(m => 
		m.name.toLowerCase().includes(medQuery.toLowerCase().trim())
	).slice(0, 10);

	// Click outside handler to close dropdown
	useEffect(() => {
		function handleClickOutside(event) {
			if (
				medContainerRef.current &&
				!medContainerRef.current.contains(event.target) &&
				showMedDropdown
			) {
				setShowMedDropdown(false);
			}
		}
		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [showMedDropdown]);

	// Handle medicine selection
	function handleMedicineSelect(medicine) {
		setSelectedMedicine(medicine);
		setMedQuery(medicine.name);
		setShowMedDropdown(false);
		setBrandInput('');
		setDoseInput('');
	}

	// Add new drug
	function handleAddDrug() {
		if (!selectedMedicine) {
			setError('Please select a medicine');
			return;
		}

		const newDrug = {
			medicine_id: selectedMedicine.id,
			medicine_name: selectedMedicine.name,
			brand: brandInput.trim() || '',
			dose: doseInput.trim() || ''
		};

		// Check if already exists
		if (drugs.some(d => d.medicine_id === selectedMedicine.id)) {
			setError('This medicine is already in the drug history');
			return;
		}

		setDrugs([...drugs, newDrug]);
		setSelectedMedicine(null);
		setMedQuery('');
		setBrandInput('');
		setDoseInput('');
		setError('');
	}

	// Remove drug
	function handleRemoveDrug(index) {
		setDrugs(drugs.filter((_, i) => i !== index));
	}

	// Save drug history
	async function handleSave() {
		if (!patientId) return;

		setSaving(true);
		setError('');
		setMessage('');

		try {
			await apiUpdateDrugHistory(token, patientId, drugs);
			setMessage('Drug history saved successfully');
			setEditing(false);
			setTimeout(() => setMessage(''), 3000);
		} catch (e) {
			setError('Failed to save drug history');
			console.error('Error saving drug history:', e);
		} finally {
			setSaving(false);
		}
	}

	// Cancel editing
	function handleCancel() {
		// Reload original data
		if (patientId) {
			apiGetDrugHistory(token, patientId).then(result => {
				setDrugs(result.drugs || []);
			}).catch(() => {});
		}
		setEditing(false);
		setSelectedMedicine(null);
		setMedQuery('');
		setBrandInput('');
		setDoseInput('');
		setError('');
		setMessage('');
	}

	if (!patientId) {
		return null;
	}

	return (
		<div className="card" style={{ 
			marginBottom: 20,
			background: 'linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%)',
			border: '2px solid #bae6fd',
			boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
		}}>
			<div style={{ 
				display: 'flex', 
				alignItems: 'center', 
				justifyContent: 'space-between',
				marginBottom: 16,
				paddingBottom: 12,
				borderBottom: '2px solid #e0f2fe'
			}}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
					<div style={{
						width: 36,
						height: 36,
						borderRadius: '8px',
						background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						fontSize: '18px',
						flexShrink: 0
					}}>
						💊
					</div>
					<h3 style={{ 
						margin: 0, 
						fontSize: '16px', 
						fontWeight: 700,
						color: '#1e293b' 
					}}>
						Drug History
						<span style={{ 
							marginLeft: 8,
							fontSize: '12px',
							fontWeight: 500,
							color: '#64748b'
						}}>
							(Other Doctors)
						</span>
					</h3>
				</div>
				{!editing && (
					<button
						type="button"
						onClick={() => setEditing(true)}
						style={{
							padding: '6px 12px',
							background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
							border: 'none',
							borderRadius: '6px',
							color: 'white',
							fontSize: '12px',
							fontWeight: 600,
							cursor: 'pointer',
							transition: 'all 0.2s'
						}}
						onMouseEnter={(e) => {
							e.target.style.transform = 'translateY(-1px)';
							e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
						}}
						onMouseLeave={(e) => {
							e.target.style.transform = 'translateY(0)';
							e.target.style.boxShadow = 'none';
						}}
					>
						Edit
					</button>
				)}
			</div>

			{loading ? (
				<div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
					Loading drug history...
				</div>
			) : (
				<>
					{error && (
						<div style={{ 
							padding: '10px', 
							background: '#fee2e2', 
							border: '1px solid #fca5a5',
							borderRadius: '6px',
							color: '#dc2626',
							fontSize: '13px',
							marginBottom: 12
						}}>
							{error}
						</div>
					)}

					{message && (
						<div style={{ 
							padding: '10px', 
							background: '#d1fae5', 
							border: '1px solid #86efac',
							borderRadius: '6px',
							color: '#059669',
							fontSize: '13px',
							marginBottom: 12
						}}>
							{message}
						</div>
					)}

					{editing && (
						<div style={{ marginBottom: 16 }}>
							<div style={{ marginBottom: 12 }}>
								<label style={{ 
									display: 'block', 
									marginBottom: 6, 
									fontSize: '13px', 
									fontWeight: 600,
									color: '#475569'
								}}>
									Add Medicine
								</label>
								<div ref={medContainerRef} style={{ position: 'relative' }}>
									<input
										ref={medInputRef}
										type="text"
										value={medQuery}
										onChange={(e) => {
											setMedQuery(e.target.value);
											setShowMedDropdown(true);
											setSelectedMedicine(null);
										}}
										onFocus={() => setShowMedDropdown(true)}
										placeholder="Search medicine..."
										style={{
											width: '100%',
											padding: '8px 12px',
											border: '1px solid #cbd5e1',
											borderRadius: '6px',
											fontSize: '13px'
										}}
									/>
									{showMedDropdown && filteredMedicines.length > 0 && (
										<div
											ref={medDropdownRef}
											style={{
												position: 'absolute',
												top: '100%',
												left: 0,
												right: 0,
												background: 'white',
												border: '1px solid #cbd5e1',
												borderRadius: '6px',
												boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
												maxHeight: '200px',
												overflowY: 'auto',
												zIndex: 1000,
												marginTop: '4px'
											}}
										>
											{filteredMedicines.map(med => (
												<div
													key={med.id}
													onClick={() => handleMedicineSelect(med)}
													style={{
														padding: '10px 12px',
														cursor: 'pointer',
														borderBottom: '1px solid #f1f5f9',
														transition: 'background 0.2s'
													}}
													onMouseEnter={(e) => {
														e.target.style.background = '#f1f5f9';
													}}
													onMouseLeave={(e) => {
														e.target.style.background = 'white';
													}}
												>
													<div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
														{med.name}
													</div>
												</div>
											))}
										</div>
									)}
								</div>
							</div>

							{selectedMedicine && (
								<>
									<div style={{ marginBottom: 12 }}>
										<label style={{ 
											display: 'block', 
											marginBottom: 6, 
											fontSize: '13px', 
											fontWeight: 600,
											color: '#475569'
										}}>
											Brand (Optional)
										</label>
										<input
											type="text"
											value={brandInput}
											onChange={(e) => setBrandInput(e.target.value)}
											placeholder="Enter brand name..."
											style={{
												width: '100%',
												padding: '8px 12px',
												border: '1px solid #cbd5e1',
												borderRadius: '6px',
												fontSize: '13px'
											}}
										/>
									</div>
									<div style={{ marginBottom: 12 }}>
										<label style={{ 
											display: 'block', 
											marginBottom: 6, 
											fontSize: '13px', 
											fontWeight: 600,
											color: '#475569'
										}}>
											Dose
										</label>
										<input
											type="text"
											value={doseInput}
											onChange={(e) => setDoseInput(e.target.value)}
											placeholder="Enter dosage (e.g., 500mg twice daily)..."
											style={{
												width: '100%',
												padding: '8px 12px',
												border: '1px solid #cbd5e1',
												borderRadius: '6px',
												fontSize: '13px'
											}}
										/>
									</div>
								</>
							)}

							<button
								type="button"
								onClick={handleAddDrug}
								disabled={!selectedMedicine}
								style={{
									width: '100%',
									padding: '8px 12px',
									background: selectedMedicine 
										? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
										: '#cbd5e1',
									border: 'none',
									borderRadius: '6px',
									color: 'white',
									fontSize: '13px',
									fontWeight: 600,
									cursor: selectedMedicine ? 'pointer' : 'not-allowed',
									marginBottom: 12
								}}
							>
								Add Drug
							</button>
						</div>
					)}

					{drugs.length === 0 ? (
						<div style={{ 
							padding: '20px', 
							textAlign: 'center', 
							color: '#94a3b8',
							fontSize: '13px'
						}}>
							No drug history recorded
						</div>
					) : (
						<div style={{ maxHeight: '300px', overflowY: 'auto' }}>
							<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
								{drugs.map((drug, index) => (
									<div
										key={`${drug.medicine_id}-${index}`}
										style={{
											padding: '12px',
											background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
											borderRadius: '8px',
											border: '1px solid #e2e8f0',
											display: 'flex',
											justifyContent: 'space-between',
											alignItems: 'center'
										}}
									>
										<div style={{ flex: 1 }}>
											<div style={{ 
												fontWeight: 600, 
												fontSize: '13px',
												color: '#1e293b',
												marginBottom: 4
											}}>
												{drug.medicine_name}
											</div>
											{drug.brand && (
												<div style={{ 
													fontSize: '12px',
													color: '#64748b',
													marginBottom: 2
												}}>
													Brand: {drug.brand}
												</div>
											)}
											{drug.dose && (
												<div style={{ 
													fontSize: '12px',
													color: '#64748b'
												}}>
													Dose: {drug.dose}
												</div>
											)}
										</div>
										{editing && (
											<button
												type="button"
												onClick={() => handleRemoveDrug(index)}
												style={{
													padding: '6px 10px',
													background: '#fee2e2',
													border: '1px solid #fca5a5',
													borderRadius: '6px',
													color: '#dc2626',
													fontSize: '12px',
													fontWeight: 600,
													cursor: 'pointer',
													marginLeft: 8
												}}
											>
												Remove
											</button>
										)}
									</div>
								))}
							</div>
						</div>
					)}

					{editing && (
						<div style={{ 
							display: 'flex', 
							gap: 8, 
							marginTop: 16,
							paddingTop: 16,
							borderTop: '2px solid #e0f2fe'
						}}>
							<button
								type="button"
								onClick={handleSave}
								disabled={saving}
								style={{
									flex: 1,
									padding: '10px',
									background: saving 
										? '#cbd5e1'
										: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
									border: 'none',
									borderRadius: '6px',
									color: 'white',
									fontSize: '13px',
									fontWeight: 600,
									cursor: saving ? 'not-allowed' : 'pointer'
								}}
							>
								{saving ? 'Saving...' : 'Save'}
							</button>
							<button
								type="button"
								onClick={handleCancel}
								disabled={saving}
								style={{
									flex: 1,
									padding: '10px',
									background: '#f1f5f9',
									border: '1px solid #cbd5e1',
									borderRadius: '6px',
									color: '#475569',
									fontSize: '13px',
									fontWeight: 600,
									cursor: saving ? 'not-allowed' : 'pointer'
								}}
							>
								Cancel
							</button>
						</div>
					)}
				</>
			)}
		</div>
	);
}

