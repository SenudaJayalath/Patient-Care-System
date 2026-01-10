import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiGetDrugHistory, apiUpdateDrugHistory, apiCreateMedicine, apiAddBrandToMedicine } from '../../api.js';

export default function DrugHistory({ patientId, medicines, onMedicineCreated }) {
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
	const [expandedMedicines, setExpandedMedicines] = useState(new Set());
	const [customBrandInputs, setCustomBrandInputs] = useState({});
	const [addingBrandToMedicineId, setAddingBrandToMedicineId] = useState(null);
	const medInputRef = useRef(null);
	const medDropdownRef = useRef(null);
	const medContainerRef = useRef(null);
	
	// For creating new medicine
	const [showCreateMedicine, setShowCreateMedicine] = useState(false);
	const [newMedicineName, setNewMedicineName] = useState('');
	const [newMedicineBrands, setNewMedicineBrands] = useState('');
	const [creatingMedicine, setCreatingMedicine] = useState(false);

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

	// Toggle medicine card expansion
	function toggleMedicineExpand(id) {
		const newExpanded = new Set(expandedMedicines);
		if (newExpanded.has(id)) {
			newExpanded.delete(id);
		} else {
			newExpanded.add(id);
		}
		setExpandedMedicines(newExpanded);
	}

	// Add medicine with brand to drug list
	function addMedicineWithBrand(medicineId, brand = '') {
		const medicine = medicines.find(m => m.id === medicineId);
		if (!medicine) return;

		const newDrug = {
			medicine_id: medicine.id,
			medicine_name: medicine.name,
			brand: brand.trim() || '',
			dose: ''
		};

		// Check if already exists
		if (drugs.some(d => d.medicine_id === medicine.id)) {
			setError('This medicine is already in the drug history');
			setTimeout(() => setError(''), 3000);
			return;
		}

		setDrugs([...drugs, newDrug]);
		
		// Close the expanded card
		const newExpanded = new Set(expandedMedicines);
		newExpanded.delete(medicineId);
		setExpandedMedicines(newExpanded);
		
		// Clear custom brand input
		setCustomBrandInputs({ ...customBrandInputs, [medicineId]: '' });
		setMedQuery('');
		setShowMedDropdown(false);
		setError('');
	}

	// Create new medicine
	async function handleCreateMedicine() {
		if (!newMedicineName.trim()) {
			setError('Medicine name is required');
			return;
		}
		setCreatingMedicine(true);
		setError('');
		try {
			const brands = newMedicineBrands.split(',').map(b => b.trim()).filter(b => b);
			const newMed = await apiCreateMedicine(token, { name: newMedicineName.trim(), brands });
			if (onMedicineCreated) {
				onMedicineCreated(newMed);
			}
			setMessage(`Medicine "${newMed.name}" created successfully!`);
			setShowCreateMedicine(false);
			setNewMedicineName('');
			setNewMedicineBrands('');
			setMedQuery('');
			setShowMedDropdown(false);
			setTimeout(() => setMessage(''), 3000);
		} catch (err) {
			setError('Failed to create medicine: ' + err.message);
		} finally {
			setCreatingMedicine(false);
		}
	}

	// Add brand to existing medicine
	async function handleAddBrandToMedicine(medicineId, brand) {
		if (!brand.trim()) return;
		
		setAddingBrandToMedicineId(medicineId);
		setError('');
		try {
			const updatedMedicine = await apiAddBrandToMedicine(token, { medicineId, brand: brand.trim() });
			if (onMedicineCreated) {
				onMedicineCreated(updatedMedicine);
			}
			setMessage(`Brand "${brand.trim()}" added successfully!`);
			setCustomBrandInputs({ ...customBrandInputs, [medicineId]: '' });
			setTimeout(() => setMessage(''), 3000);
		} catch (err) {
			setError('Failed to add brand: ' + err.message);
		} finally {
			setAddingBrandToMedicineId(null);
		}
	}

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
									{showMedDropdown && (
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
												maxHeight: '300px',
												overflowY: 'auto',
												zIndex: 1000,
												marginTop: '4px'
											}}
										>
											{filteredMedicines.length === 0 && medQuery.trim() && (
												<div style={{ padding: '12px' }}>
													<div style={{ marginBottom: 8, fontSize: '13px', color: '#64748b' }}>
														Medicine not found
													</div>
													<button
														type="button"
														onClick={() => {
															setShowCreateMedicine(true);
															setNewMedicineName(medQuery);
															setShowMedDropdown(false);
														}}
														style={{
															width: '100%',
															padding: '8px',
															background: '#f1f5f9',
															border: '1px solid #cbd5e1',
															borderRadius: '6px',
															fontSize: '12px',
															fontWeight: 600,
															color: '#475569',
															cursor: 'pointer'
														}}
													>
														+ Create New Medicine
													</button>
												</div>
											)}
											{filteredMedicines.map(med => {
												const isExpanded = expandedMedicines.has(med.id);
												return (
													<div
														key={med.id}
														style={{
															borderBottom: '1px solid #f1f5f9'
														}}
													>
														<div
															onClick={() => toggleMedicineExpand(med.id)}
															style={{
																padding: '10px 12px',
																cursor: 'pointer',
																background: isExpanded ? '#f8fafc' : 'white',
																display: 'flex',
																justifyContent: 'space-between',
																alignItems: 'center'
															}}
															onMouseEnter={(e) => {
																if (!isExpanded) e.currentTarget.style.background = '#f1f5f9';
															}}
															onMouseLeave={(e) => {
																if (!isExpanded) e.currentTarget.style.background = 'white';
															}}
														>
															<div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
																{med.name}
															</div>
															<span style={{ fontSize: '12px', color: '#64748b' }}>
																{isExpanded ? '▲' : '▼'}
															</span>
														</div>
														{isExpanded && (
															<div style={{ 
																padding: '12px', 
																background: '#f8fafc',
																borderTop: '1px solid #e2e8f0'
															}}>
																{/* Predefined Brands */}
																{med.brands && med.brands.length > 0 && (
																	<div style={{ marginBottom: 12 }}>
																		<div style={{ 
																			fontSize: '12px', 
																			fontWeight: 600,
																			color: '#475569',
																			marginBottom: 6 
																		}}>
																			Available Brands:
																		</div>
																		<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
																			{med.brands.map((brand, idx) => (
																				<button
																					key={idx}
																					type="button"
																					onClick={() => addMedicineWithBrand(med.id, brand)}
																					style={{
																						padding: '6px 10px',
																						background: 'white',
																						border: '1px solid #cbd5e1',
																						borderRadius: '6px',
																						fontSize: '12px',
																						color: '#1e293b',
																						cursor: 'pointer',
																						fontWeight: 500
																					}}
																					onMouseEnter={(e) => {
																						e.target.style.background = '#e0f2fe';
																						e.target.style.borderColor = '#3b82f6';
																					}}
																					onMouseLeave={(e) => {
																						e.target.style.background = 'white';
																						e.target.style.borderColor = '#cbd5e1';
																					}}
																				>
																					{brand}
																				</button>
																			))}
																		</div>
																	</div>
																)}
																
																{/* No Brand Option */}
																<button
																	type="button"
																	onClick={() => addMedicineWithBrand(med.id, '')}
																	style={{
																		width: '100%',
																		padding: '8px',
																		background: 'white',
																		border: '1px solid #cbd5e1',
																		borderRadius: '6px',
																		fontSize: '12px',
																		fontWeight: 600,
																		color: '#475569',
																		cursor: 'pointer',
																		marginBottom: 8
																	}}
																	onMouseEnter={(e) => {
																		e.target.style.background = '#f1f5f9';
																	}}
																	onMouseLeave={(e) => {
																		e.target.style.background = 'white';
																	}}
																>
																	Add without brand
																</button>
																
																{/* Custom Brand Input */}
																<div style={{ marginTop: 8 }}>
																	<div style={{ 
																		fontSize: '11px', 
																		color: '#64748b',
																		marginBottom: 4,
																		fontWeight: 600
																	}}>
																		Or enter custom brand:
																	</div>
																	<div style={{ display: 'flex', gap: 6 }}>
																		<input
																			type="text"
																			value={customBrandInputs[med.id] || ''}
																			onChange={(e) => setCustomBrandInputs({
																				...customBrandInputs,
																				[med.id]: e.target.value
																			})}
																			placeholder="Brand name..."
																			style={{
																				flex: 1,
																				padding: '6px 8px',
																				border: '1px solid #cbd5e1',
																				borderRadius: '4px',
																				fontSize: '12px'
																			}}
																			onKeyPress={(e) => {
																				if (e.key === 'Enter' && customBrandInputs[med.id]?.trim()) {
																					addMedicineWithBrand(med.id, customBrandInputs[med.id]);
																				}
																			}}
																		/>
																		<button
																			type="button"
																			onClick={() => {
																				if (customBrandInputs[med.id]?.trim()) {
																					addMedicineWithBrand(med.id, customBrandInputs[med.id]);
																				}
																			}}
																			disabled={!customBrandInputs[med.id]?.trim()}
																			style={{
																				padding: '6px 12px',
																				background: customBrandInputs[med.id]?.trim() ? '#10b981' : '#cbd5e1',
																				border: 'none',
																				borderRadius: '4px',
																				color: 'white',
																				fontSize: '11px',
																				fontWeight: 600,
																				cursor: customBrandInputs[med.id]?.trim() ? 'pointer' : 'not-allowed',
																				whiteSpace: 'nowrap'
																			}}
																		>
																			Add
																		</button>
																	</div>
																</div>
																
																{/* Add Brand to Medicine */}
																<div style={{ 
																	marginTop: 12,
																	paddingTop: 12,
																	borderTop: '1px solid #e2e8f0'
																}}>
																	<div style={{ 
																		fontSize: '11px', 
																		color: '#64748b',
																		marginBottom: 4,
																		fontWeight: 600
																	}}>
																		Save brand to medicine list:
																	</div>
																	<div style={{ display: 'flex', gap: 6 }}>
																		<input
																			type="text"
																			placeholder="New brand name..."
																			style={{
																				flex: 1,
																				padding: '6px 8px',
																				border: '1px solid #cbd5e1',
																				borderRadius: '4px',
																				fontSize: '12px'
																			}}
																			onKeyPress={(e) => {
																				if (e.key === 'Enter' && e.target.value.trim()) {
																					handleAddBrandToMedicine(med.id, e.target.value);
																					e.target.value = '';
																				}
																			}}
																		/>
																		<button
																			type="button"
																			onClick={(e) => {
																				const input = e.target.previousElementSibling;
																				if (input.value.trim()) {
																					handleAddBrandToMedicine(med.id, input.value);
																					input.value = '';
																				}
																			}}
																			disabled={addingBrandToMedicineId === med.id}
																			style={{
																				padding: '6px 12px',
																				background: addingBrandToMedicineId === med.id ? '#cbd5e1' : '#3b82f6',
																				border: 'none',
																				borderRadius: '4px',
																				color: 'white',
																				fontSize: '11px',
																				fontWeight: 600,
																				cursor: addingBrandToMedicineId === med.id ? 'not-allowed' : 'pointer',
																				whiteSpace: 'nowrap'
																			}}
																		>
																			{addingBrandToMedicineId === med.id ? 'Adding...' : 'Save'}
																		</button>
																	</div>
																</div>
															</div>
														)}
													</div>
												);
											})}
										</div>
									)}
								</div>
							</div>
						</div>
					)}

					{/* Create New Medicine Modal */}
					{showCreateMedicine && (
						<div style={{
							position: 'fixed',
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							background: 'rgba(0,0,0,0.5)',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							zIndex: 2000
						}}>
							<div style={{
								background: 'white',
								borderRadius: '12px',
								padding: '24px',
								width: '90%',
								maxWidth: '500px',
								boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
							}}>
								<h3 style={{ marginTop: 0, marginBottom: 16 }}>Create New Medicine</h3>
								<div style={{ marginBottom: 12 }}>
									<label style={{ display: 'block', marginBottom: 6, fontSize: '13px', fontWeight: 600 }}>
										Medicine Name
									</label>
									<input
										type="text"
										value={newMedicineName}
										onChange={(e) => setNewMedicineName(e.target.value)}
										placeholder="Enter medicine name..."
										style={{
											width: '100%',
											padding: '8px 12px',
											border: '1px solid #cbd5e1',
											borderRadius: '6px',
											fontSize: '13px'
										}}
									/>
								</div>
								<div style={{ marginBottom: 16 }}>
									<label style={{ display: 'block', marginBottom: 6, fontSize: '13px', fontWeight: 600 }}>
										Brands (Optional, comma-separated)
									</label>
									<input
										type="text"
										value={newMedicineBrands}
										onChange={(e) => setNewMedicineBrands(e.target.value)}
										placeholder="e.g., Brand A, Brand B, Brand C"
										style={{
											width: '100%',
											padding: '8px 12px',
											border: '1px solid #cbd5e1',
											borderRadius: '6px',
											fontSize: '13px'
										}}
									/>
								</div>
								<div style={{ display: 'flex', gap: 8 }}>
									<button
										type="button"
										onClick={handleCreateMedicine}
										disabled={creatingMedicine || !newMedicineName.trim()}
										style={{
											flex: 1,
											padding: '10px',
											background: (creatingMedicine || !newMedicineName.trim()) ? '#cbd5e1' : '#10b981',
											border: 'none',
											borderRadius: '6px',
											color: 'white',
											fontSize: '13px',
											fontWeight: 600,
											cursor: (creatingMedicine || !newMedicineName.trim()) ? 'not-allowed' : 'pointer'
										}}
									>
										{creatingMedicine ? 'Creating...' : 'Create Medicine'}
									</button>
									<button
										type="button"
										onClick={() => {
											setShowCreateMedicine(false);
											setNewMedicineName('');
											setNewMedicineBrands('');
										}}
										disabled={creatingMedicine}
										style={{
											flex: 1,
											padding: '10px',
											background: '#f1f5f9',
											border: '1px solid #cbd5e1',
											borderRadius: '6px',
											color: '#475569',
											fontSize: '13px',
											fontWeight: 600,
											cursor: creatingMedicine ? 'not-allowed' : 'pointer'
										}}
									>
										Cancel
									</button>
								</div>
							</div>
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
											border: '1px solid #e2e8f0'
										}}
									>
										<div style={{ 
											display: 'flex',
											justifyContent: 'space-between',
											alignItems: 'flex-start',
											marginBottom: 8
										}}>
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
										{editing ? (
											<div>
												<label style={{ 
													display: 'block',
													fontSize: '11px',
													fontWeight: 600,
													color: '#475569',
													marginBottom: 4
												}}>
													Dose:
												</label>
												<input
													type="text"
													value={drug.dose || ''}
													onChange={(e) => {
														const updatedDrugs = [...drugs];
														updatedDrugs[index] = { ...drug, dose: e.target.value };
														setDrugs(updatedDrugs);
													}}
													placeholder="e.g., 500mg twice daily"
													style={{
														width: '100%',
														padding: '6px 8px',
														border: '1px solid #cbd5e1',
														borderRadius: '4px',
														fontSize: '12px'
													}}
												/>
											</div>
										) : (
											drug.dose && (
												<div style={{ 
													fontSize: '12px',
													color: '#64748b'
												}}>
													Dose: {drug.dose}
												</div>
											)
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

