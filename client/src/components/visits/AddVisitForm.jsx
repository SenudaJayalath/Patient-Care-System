import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { apiCreateVisit, apiSearchPatients, apiGetPatientById, apiCreateMedicine, apiAddBrandToMedicine, apiCreateInvestigation } from '../../api.js';
import PrescriptionModal from './PrescriptionModal.jsx';
import ReferralLetterModal from './ReferralLetterModal.jsx';
import DrugHistory from './DrugHistory.jsx';

// Helper functions for date format conversion
function convertToDDMMYYYY(isoDate) {
	if (!isoDate) return '';
	// If already in DD/MM/YYYY format, return as is
	if (isoDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
		return isoDate;
	}
	// Convert YYYY-MM-DD to DD/MM/YYYY
	const parts = isoDate.split('-');
	if (parts.length === 3) {
		return `${parts[2]}/${parts[1]}/${parts[0]}`;
	}
	return isoDate;
}

function convertToYYYYMMDD(ddmmYYYY) {
	if (!ddmmYYYY) return '';
	// If already in YYYY-MM-DD format, return as is
	if (ddmmYYYY.match(/^\d{4}-\d{2}-\d{2}$/)) {
		return ddmmYYYY;
	}
	// Convert DD/MM/YYYY to YYYY-MM-DD
	const parts = ddmmYYYY.split('/');
	if (parts.length === 3) {
		const day = parts[0].padStart(2, '0');
		const month = parts[1].padStart(2, '0');
		const year = parts[2];
		return `${year}-${month}-${day}`;
	}
	return '';
}

function isValidDate(dateString) {
	if (!dateString) return false;
	const isoDate = convertToYYYYMMDD(dateString);
	if (!isoDate) return false;
	const date = new Date(isoDate);
	return !isNaN(date.getTime());
}

// Helper to format input as user types (auto-insert slashes)
function formatDateInput(value) {
	// Remove all non-digits
	const digits = value.replace(/\D/g, '');
	// Format as DD/MM/YYYY
	if (digits.length <= 2) {
		return digits;
	} else if (digits.length <= 4) {
		return `${digits.slice(0, 2)}/${digits.slice(2)}`;
	} else {
		return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
	}
}

// Helper functions for allergies management
function parseAllergies(allergiesData) {
	if (!allergiesData) return [];
	if (Array.isArray(allergiesData)) return allergiesData;
	// Backward compatibility: if it's a string, try to parse as JSON, otherwise treat as other allergy
	try {
		const parsed = JSON.parse(allergiesData);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		// If it's a plain string, convert to array of other allergies
		return allergiesData.trim() ? [{ type: 'other', text: allergiesData.trim() }] : [];
	}
}

function stringifyAllergies(allergiesArray) {
	if (!allergiesArray || allergiesArray.length === 0) return '';
	// Convert to JSON string for storage
	return JSON.stringify(allergiesArray);
}

function getAllergyMedicineIds(allergiesArray) {
	if (!Array.isArray(allergiesArray)) return [];
	return allergiesArray
		.filter(a => a.type === 'medicine' && a.medicineId)
		.map(a => a.medicineId);
}


export default function AddVisitForm({ medicines, investigations: availableInvestigations = [], onMedicineCreated, onInvestigationCreated }) {
	const { token, user } = useAuth();
	// Search criteria
	const [searchName, setSearchName] = useState('');
	const [searchNic, setSearchNic] = useState('');
	const [searchPhone, setSearchPhone] = useState('');
	const [searchBirthday, setSearchBirthday] = useState('');
	// Patient data
	const [patientId, setPatientId] = useState(null);
	const [name, setName] = useState('');
	const [birthday, setBirthday] = useState('');
	const [phoneNumber, setPhoneNumber] = useState('');
	const [nic, setNic] = useState('');
	const [age, setAge] = useState('');
	const [gender, setGender] = useState('');
	const [pastMedicalHistory, setPastMedicalHistory] = useState('');
	const [familyHistory, setFamilyHistory] = useState('');
	// Allergies: array of {type: 'medicine'|'other', medicineId?: string, medicineName?: string, text?: string}
	const [allergies, setAllergies] = useState([]);
	const [noKnownAllergies, setNoKnownAllergies] = useState(false); // Explicit "no allergies" flag
	const [allergyInput, setAllergyInput] = useState(''); // For free-text allergy input
	const [allergyMedQuery, setAllergyMedQuery] = useState(''); // For medicine search in allergies
	const [showAllergyMedDropdown, setShowAllergyMedDropdown] = useState(false);
	const [presentingComplaint, setPresentingComplaint] = useState('');
	const [examinationFindings, setExaminationFindings] = useState('');
	const [investigations, setInvestigations] = useState([]); // Array of {investigationId, investigationName, result, date}
	const [investigationsToDo, setInvestigationsToDo] = useState([]); // Array of investigation strings
	const [investigationToDoInput, setInvestigationToDoInput] = useState(''); // Input for "Investigations To Do" section
	const [investigationInput, setInvestigationInput] = useState(''); // Input for "Investigations Results" section
	const [investigationResultInput, setInvestigationResultInput] = useState('');
	const [investigationDateInput, setInvestigationDateInput] = useState('');
	const [selectedInvestigationForResult, setSelectedInvestigationForResult] = useState(null);
	const [showInvestigationsToDo, setShowInvestigationsToDo] = useState(false);
	const [showInvestigationHistory, setShowInvestigationHistory] = useState(false);
	const [expandedInvestigation, setExpandedInvestigation] = useState(null); // Track which investigation history is expanded
	const [showInvestigationDropdown, setShowInvestigationDropdown] = useState(false);
	const [showInvestigationResultDropdown, setShowInvestigationResultDropdown] = useState(false);
	const investigationInputRef = useRef(null);
	const investigationDropdownRef = useRef(null);
	const investigationContainerRef = useRef(null);
	const investigationResultContainerRef = useRef(null);
	const investigationResultDropdownRef = useRef(null);
	const [doctorsNotes, setDoctorsNotes] = useState('');
	const [generateReferralLetter, setGenerateReferralLetter] = useState(false);
	const [referralDoctorName, setReferralDoctorName] = useState('');
	const [referralLetterBody, setReferralLetterBody] = useState('');
	const [selectedMedicines, setSelectedMedicines] = useState([]); // Array of {id, brand, dosage, duration, durationUnit}
	const [expandedMedicines, setExpandedMedicines] = useState(new Set()); // Track which medicine cards are expanded
	const [customBrandInputs, setCustomBrandInputs] = useState({}); // Track custom brand inputs per medicine
	const [medQuery, setMedQuery] = useState('');
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState('');
	const [error, setError] = useState('');
	const [lastVisit, setLastVisit] = useState(null);
	const [lastPatient, setLastPatient] = useState(null);
	const [showModal, setShowModal] = useState(false);
	const [suggestionsOpen, setSuggestionsOpen] = useState(false);
	const [visitSaved, setVisitSaved] = useState(false);
	const [dropdownHasMouse, setDropdownHasMouse] = useState(false);
	const medicineInputRef = useRef(null);
	const medicineDropdownRef = useRef(null);
	const medicineContainerRef = useRef(null);
	
	// Patient lookup state
	const [patientLookup, setPatientLookup] = useState(null);
	const [searchResults, setSearchResults] = useState([]);
	const [showSearchResults, setShowSearchResults] = useState(false);
	const [searchPerformed, setSearchPerformed] = useState(false); // Track if search has been performed
	const [lookupLoading, setLookupLoading] = useState(false);
	const [lookupError, setLookupError] = useState('');
	const [historyModalOpen, setHistoryModalOpen] = useState(false);
	const [historyModalData, setHistoryModalData] = useState(null);
	const [referralModalOpen, setReferralModalOpen] = useState(false);
	const [referralModalData, setReferralModalData] = useState(null);
	const [editMode, setEditMode] = useState(false);
	const [savingPatientInfo, setSavingPatientInfo] = useState(false);
	const [showCreateMedicine, setShowCreateMedicine] = useState(false);
	const [newMedicineName, setNewMedicineName] = useState('');
	const [newMedicineBrands, setNewMedicineBrands] = useState('');
	const [creatingMedicine, setCreatingMedicine] = useState(false);
	const [addingBrandToMedicineId, setAddingBrandToMedicineId] = useState(null);
	const [showCreateInvestigation, setShowCreateInvestigation] = useState(false);
	const [newInvestigationName, setNewInvestigationName] = useState('');
	const [newInvestigationCategory, setNewInvestigationCategory] = useState('');
	const [creatingInvestigation, setCreatingInvestigation] = useState(false);
	const [expandedVisit, setExpandedVisit] = useState(null); // Track which visit is expanded to show details

	// Click outside handler to close dropdown
	useEffect(() => {
		function handleClickOutside(event) {
			if (
				medicineContainerRef.current &&
				!medicineContainerRef.current.contains(event.target) &&
				suggestionsOpen
			) {
				setSuggestionsOpen(false);
				setDropdownHasMouse(false);
			}
			if (
				investigationContainerRef.current &&
				!investigationContainerRef.current.contains(event.target) &&
				showInvestigationDropdown
			) {
				setShowInvestigationDropdown(false);
			}
			if (
				investigationResultContainerRef.current &&
				!investigationResultContainerRef.current.contains(event.target) &&
				showInvestigationResultDropdown
			) {
				setShowInvestigationResultDropdown(false);
			}
		}
		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [suggestionsOpen, showInvestigationDropdown, showInvestigationResultDropdown]);

	// Clear search results when search criteria is cleared
	useEffect(() => {
		const hasSearchCriteria = searchName.trim() || searchNic.trim() || searchPhone.trim() || searchBirthday.trim();
		if (!hasSearchCriteria && searchPerformed) {
			// Only clear if search was previously performed
			setSearchResults([]);
			setShowSearchResults(false);
			setSearchPerformed(false);
			setPatientLookup(null);
			setLookupError('');
			setPatientId(null);
			setName('');
			setBirthday('');
			setPhoneNumber('');
			setNic('');
			setAge('');
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchName, searchNic, searchPhone, searchBirthday]);

		// Auto-populate medicines from most recent visit when patient is found
		useEffect(() => {
			if (patientLookup && patientLookup.visits && patientLookup.visits.length > 0) {
				// Get the most recent visit (first in the array, already sorted by date DESC)
				const mostRecentVisit = patientLookup.visits[0];
				if (mostRecentVisit && mostRecentVisit.prescriptions && mostRecentVisit.prescriptions.length > 0) {
					// Convert prescriptions to selectedMedicines format: { id, brand, dosage, duration, durationUnit }
					const medicinesFromLastVisit = mostRecentVisit.prescriptions.map(p => ({
						id: p.id,
						brand: p.brand || '',
						dosage: p.dosage || '',
						duration: p.duration || '',
						durationUnit: p.durationUnit || 'weeks'
					}));
					setSelectedMedicines(medicinesFromLastVisit);
				} else {
					// No prescriptions in most recent visit, clear medicines
					setSelectedMedicines([]);
				}
				
				// Load all investigation results from all visits (persist throughout visits)
				if (patientLookup.visits) {
					const allInvestigationResults = [];
					patientLookup.visits.forEach(visit => {
						if (visit.investigations && Array.isArray(visit.investigations) && visit.investigations.length > 0) {
							visit.investigations.forEach(inv => {
								// Normalize the investigation object structure
								// Expected format: {investigationId, investigationName, result, date}
								// Only use explicit field names to avoid confusion
								const normalizedInv = {
									investigationId: inv.investigationId || null,
									investigationName: inv.investigationName || '',
									result: inv.result || '',
									date: inv.date || '',
									isHistorical: true // Mark as historical (from previous visits)
								};
								
								// Only add if we have at least investigation name
								if (normalizedInv.investigationName) {
									// Avoid duplicates - check if investigation with same ID and date already exists
									const exists = allInvestigationResults.some(existing => 
										(existing.investigationId && normalizedInv.investigationId && existing.investigationId === normalizedInv.investigationId && existing.date === normalizedInv.date) ||
										(existing.investigationName === normalizedInv.investigationName && existing.date === normalizedInv.date)
									);
									if (!exists) {
										allInvestigationResults.push(normalizedInv);
									}
								}
							});
						}
					});
					// Sort by date descending (most recent first)
					allInvestigationResults.sort((a, b) => {
						if (!a.date) return 1;
						if (!b.date) return -1;
						return new Date(b.date) - new Date(a.date);
					});
					setInvestigations(allInvestigationResults);
				}
			} else {
				// No patient or no visits, clear medicines and investigations
				setSelectedMedicines([]);
				setInvestigations([]);
			}
		}, [patientLookup]);

	async function searchPatients() {
		const hasSearchCriteria = searchName.trim() || searchNic.trim() || searchPhone.trim() || searchBirthday.trim();
		if (!hasSearchCriteria) {
			setLookupError('Please enter at least one search criteria');
			return;
		}
		setLookupLoading(true);
		setLookupError('');
		setSearchResults([]);
		setShowSearchResults(false);
		try {
			// Convert search birthday from DD/MM/YYYY to YYYY-MM-DD for API
			const searchBirthdayISO = searchBirthday.trim() ? convertToYYYYMMDD(searchBirthday.trim()) : undefined;
			const result = await apiSearchPatients(token, {
				name: searchName.trim() || undefined,
				nic: searchNic.trim() || undefined,
				phoneNumber: searchPhone.trim() || undefined,
				birthday: searchBirthdayISO
			});
			setSearchPerformed(true); // Mark that search has been performed
			if (result.patients && result.patients.length > 0) {
				setSearchResults(result.patients);
				setShowSearchResults(true);
				// Don't auto-select - let user click to select
			} else {
				setSearchResults([]);
				setShowSearchResults(false);
				// If no results but name is provided, pre-fill name for new patient
				if (searchName.trim()) {
					setName(searchName.trim());
				}
			}
		} catch (e) {
			setLookupError('Failed to search patients');
			setSearchResults([]);
			setShowSearchResults(false);
			setSearchPerformed(true); // Still mark as performed even on error
		} finally {
			setLookupLoading(false);
		}
	}

	function clearSearch() {
		setSearchName('');
		setSearchNic('');
		setSearchPhone('');
		setSearchBirthday('');
		setSearchResults([]);
		setShowSearchResults(false);
		setSearchPerformed(false);
		setPatientLookup(null);
		setLookupError('');
		setPatientId(null);
		setName('');
		setBirthday('');
		setPhoneNumber('');
		setNic('');
		setAge('');
		setGender('');
		setPastMedicalHistory('');
		setFamilyHistory('');
		setAllergies([]);
		setAllergyInput('');
		setAllergyMedQuery('');
		setSelectedMedicines([]);
	}

	async function selectPatient(selectedPatientId) {
		setLookupLoading(true);
		setLookupError('');
		try {
			const data = await apiGetPatientById(token, selectedPatientId);
			if (data) {
				setPatientId(data.patientId);
				setPatientLookup(data);
				setShowSearchResults(false);
				// Pre-fill all fields from existing patient
				setName(data.name);
				setBirthday(data.birthday ? convertToDDMMYYYY(data.birthday) : '');
				setPhoneNumber(data.phoneNumber || '');
				setNic(data.nic || '');
				setAge(data.age ? String(data.age) : '');
				setGender(data.gender || '');
				setPastMedicalHistory(data.pastMedicalHistory || '');
				setFamilyHistory(data.familyHistory || '');
				// Parse allergies from backend (could be string or array)
				const parsedAllergies = parseAllergies(data.allergies);
				setAllergies(parsedAllergies);
			}
		} catch (e) {
			setLookupError('Failed to load patient details');
		} finally {
			setLookupLoading(false);
		}
	}

	function resetAll() {
		setSearchName('');
		setSearchNic('');
		setSearchPhone('');
		setSearchBirthday('');
		setPatientId(null);
		setNic('');
		setName('');
		setBirthday('');
		setPhoneNumber('');
		setAge('');
		setGender('');
		setPastMedicalHistory('');
		setFamilyHistory('');
		setAllergies([]);
		setAllergyInput('');
		setAllergyMedQuery('');
		setPresentingComplaint('');
		setExaminationFindings('');
		setInvestigations([]);
		setInvestigationToDoInput('');
		setInvestigationInput('');
		setInvestigationResultInput('');
		setInvestigationDateInput('');
		setSelectedInvestigationForResult(null);
		setInvestigationsToDo([]);
		setShowInvestigationsToDo(false);
		setShowInvestigationHistory(false);
		setDoctorsNotes('');
		setGenerateReferralLetter(false);
		setReferralDoctorName('');
		setReferralLetterBody('');
		setSelectedMedicines([]);
		setExpandedMedicines(new Set());
		setCustomBrandInputs({});
		setMedQuery('');
		setMessage('');
		setError('');
		setLastVisit(null);
		setLastPatient(null);
		setShowModal(false);
		setPatientLookup(null);
		setSearchResults([]);
		setShowSearchResults(false);
		setSearchPerformed(false);
		setLookupError('');
		setHistoryModalOpen(false);
		setHistoryModalData(null);
		setReferralModalOpen(false);
		setReferralModalData(null);
		setVisitSaved(false);
		setEditMode(false);
	}

	// Save patient information updates
	async function savePatientInfo() {
		setError('');
		if (!name) {
			setError('Please fill Name');
			return;
		}
		setSavingPatientInfo(true);
		try {
		// Update patient info by creating a visit with empty prescriptions
		// This will update the patient record without creating a new visit
		const birthdayISO = birthday.trim() ? convertToYYYYMMDD(birthday.trim()) : undefined;
		await apiCreateVisit(token, { 
			patientId: patientId || undefined,
			name, 
			birthday: birthdayISO,
			phoneNumber: phoneNumber.trim() || undefined,
			nic: nic.trim() || undefined,
			gender: gender.trim(),
			pastMedicalHistory: pastMedicalHistory.trim(),
			familyHistory: familyHistory.trim(),
			allergies: stringifyAllergies(allergies),
			prescriptions: [], // Empty prescriptions - this will update patient info only
			notes: '' 
		});
			// Refresh patient lookup to update sidebar
			if (patientId) {
				await selectPatient(patientId);
			}
			setEditMode(false);
			setMessage('Patient information updated successfully!');
			setTimeout(() => setMessage(''), 3000);
		} catch (e) {
			setError('Failed to update patient information');
		} finally {
			setSavingPatientInfo(false);
		}
	}

	// Medicine selection helpers
	function toggleMedicineExpand(id) {
		const newExpanded = new Set(expandedMedicines);
		if (newExpanded.has(id)) {
			newExpanded.delete(id);
		} else {
			newExpanded.add(id);
		}
		setExpandedMedicines(newExpanded);
	}

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
			// Notify parent to update medicines list
			if (onMedicineCreated) {
				onMedicineCreated(newMed);
			}
			setMessage(`Medicine "${newMed.name}" created successfully!`);
			setShowCreateMedicine(false);
			setNewMedicineName('');
			setNewMedicineBrands('');
			setMedQuery('');
			setSuggestionsOpen(false);
		} catch (err) {
			setError('Failed to create medicine: ' + err.message);
		} finally {
			setCreatingMedicine(false);
		}
	}

	async function handleAddBrandToMedicine(medicineId, brand) {
		if (!brand.trim()) {
			return;
		}
		setAddingBrandToMedicineId(medicineId);
		setError('');
		try {
			const updatedMedicine = await apiAddBrandToMedicine(token, { medicineId, brand: brand.trim() });
			// Notify parent to update the medicine in the list
			if (onMedicineCreated) {
				onMedicineCreated(updatedMedicine, true);
			}
			setMessage(`Brand "${brand.trim()}" added successfully!`);
			// Clear the custom brand input for this medicine
			setCustomBrandInputs({ ...customBrandInputs, [medicineId]: '' });
		} catch (err) {
			setError('Failed to add brand: ' + err.message);
		} finally {
			setAddingBrandToMedicineId(null);
		}
	}

	async function handleCreateInvestigation() {
		if (!newInvestigationName.trim()) {
			setError('Investigation name is required');
			return;
		}
		setCreatingInvestigation(true);
		setError('');
		try {
			const newInv = await apiCreateInvestigation(token, { 
				name: newInvestigationName.trim(), 
				category: newInvestigationCategory.trim() 
			});
			// Notify parent to add the new investigation to the list
			if (onInvestigationCreated) {
				onInvestigationCreated(newInv);
			}
			setMessage(`Investigation "${newInv.name}" created successfully!`);
			setShowCreateInvestigation(false);
			setNewInvestigationName('');
			setNewInvestigationCategory('');
		} catch (err) {
			setError('Failed to create investigation: ' + err.message);
		} finally {
			setCreatingInvestigation(false);
		}
	}

	function addMedicineWithBrand(medicineId, brand = '') {
		// Allow same medicine to be added multiple times with different dosages
		// Use timestamp to create unique keys for duplicate medicines
		const uniqueKey = `${medicineId}_${Date.now()}`;
		setSelectedMedicines([...selectedMedicines, { 
			id: medicineId,
			uniqueKey: uniqueKey, // For React key and removal
			brand: brand.trim(), 
			dosage: '',
			duration: '',
			durationUnit: 'weeks'
		}]);
		// Close the expanded card
		const newExpanded = new Set(expandedMedicines);
		newExpanded.delete(medicineId);
		setExpandedMedicines(newExpanded);
		// Clear custom brand input
		setCustomBrandInputs({ ...customBrandInputs, [medicineId]: '' });
		setMedQuery('');
		setSuggestionsOpen(false);
	}

	function removeSelected(uniqueKey) {
		setSelectedMedicines(selectedMedicines.filter(m => m.uniqueKey !== uniqueKey));
	}

	function updateMedicineBrand(uniqueKey, brand) {
		setSelectedMedicines(selectedMedicines.map(m => 
			m.uniqueKey === uniqueKey ? { ...m, brand } : m
		));
	}

	function updateMedicineDosage(uniqueKey, dosage) {
		setSelectedMedicines(selectedMedicines.map(m => 
			m.uniqueKey === uniqueKey ? { ...m, dosage } : m
		));
	}

	function updateMedicineDuration(uniqueKey, duration) {
		setSelectedMedicines(selectedMedicines.map(m => 
			m.uniqueKey === uniqueKey ? { ...m, duration } : m
		));
	}

	function updateMedicineDurationUnit(uniqueKey, durationUnit) {
		setSelectedMedicines(selectedMedicines.map(m => 
			m.uniqueKey === uniqueKey ? { ...m, durationUnit } : m
		));
	}

	// Filter investigations based on search query (for "to do" dropdown)
	function getFilteredInvestigations() {
		if (!investigationToDoInput.trim()) return availableInvestigations.slice(0, 10);
		return availableInvestigations.filter(inv => 
			inv.name.toLowerCase().includes(investigationToDoInput.toLowerCase().trim())
		).slice(0, 10);
	}

	// Filter investigations for results dropdown
	function getFilteredInvestigationsForResults() {
		if (!investigationInput.trim()) return availableInvestigations.slice(0, 10);
		return availableInvestigations.filter(inv => 
			inv.name.toLowerCase().includes(investigationInput.toLowerCase().trim())
		).slice(0, 10);
	}

	// Group investigations by investigationId or investigationName
	// Returns an array of objects: { key, investigationName, latestResult, allResults }
	function getGroupedInvestigations() {
		const groups = {};
		
		investigations.forEach(inv => {
			// Use investigationId as primary key, fallback to investigationName
			const key = inv.investigationId || inv.investigationName;
			if (!key) return;
			
			if (!groups[key]) {
				groups[key] = {
					key,
					investigationName: inv.investigationName,
					investigationId: inv.investigationId,
					allResults: []
				};
			}
			groups[key].allResults.push(inv);
		});
		
		// Sort each group's results by date (most recent first) and set latest result
		Object.values(groups).forEach(group => {
			group.allResults.sort((a, b) => {
				if (!a.date) return 1;
				if (!b.date) return -1;
				return new Date(b.date) - new Date(a.date);
			});
			group.latestResult = group.allResults[0];
		});
		
		// Return as array, sorted by latest result date
		return Object.values(groups).sort((a, b) => {
			if (!a.latestResult.date) return 1;
			if (!b.latestResult.date) return -1;
			return new Date(b.latestResult.date) - new Date(a.latestResult.date);
		});
	}

	// Investigations to do functions
	function addInvestigation(investigationName = null) {
		const nameToAdd = investigationName || investigationToDoInput.trim();
		if (nameToAdd && !investigationsToDo.includes(nameToAdd)) {
			setInvestigationsToDo([...investigationsToDo, nameToAdd]);
			setInvestigationToDoInput('');
			setShowInvestigationDropdown(false);
		}
	}

	function removeInvestigation(index) {
		setInvestigationsToDo(investigationsToDo.filter((_, i) => i !== index));
	}

	// Investigation results functions
	function selectInvestigationForResult(inv) {
		setSelectedInvestigationForResult(inv);
		setInvestigationInput(inv.name);
		setShowInvestigationResultDropdown(false);
		// Set today's date as default
		setInvestigationDateInput(new Date().toISOString().split('T')[0]);
	}

	function addInvestigationResult() {
		// Require investigation name (either from dropdown or typed), result, and date
		if (!investigationInput.trim() || !investigationResultInput.trim() || !investigationDateInput.trim()) {
			return;
		}
		
		// Auto-populate date if empty
		const dateToUse = investigationDateInput.trim() || new Date().toISOString().split('T')[0];
		
		const newResult = {
			investigationId: selectedInvestigationForResult?.id || null,
			investigationName: selectedInvestigationForResult?.name || investigationInput.trim(),
			result: investigationResultInput.trim(),
			date: dateToUse,
			isHistorical: false // Mark as new (added in current visit)
		};
		
		// Check if this investigation with same name and date already exists, if so update it
		const existingIndex = investigations.findIndex(inv => 
			(newResult.investigationId && inv.investigationId === newResult.investigationId && inv.date === newResult.date) ||
			(!newResult.investigationId && inv.investigationName === newResult.investigationName && inv.date === newResult.date)
		);
		
		if (existingIndex >= 0) {
			// Update existing
			const updated = [...investigations];
			updated[existingIndex] = newResult;
			setInvestigations(updated);
		} else {
			// Add new
			setInvestigations([...investigations, newResult]);
		}
		
		// Reset form
		setSelectedInvestigationForResult(null);
		setInvestigationInput('');
		setInvestigationResultInput('');
		setInvestigationDateInput('');
		setShowInvestigationResultDropdown(false);
	}

	function removeInvestigationResult(index) {
		setInvestigations(investigations.filter((_, i) => i !== index));
	}

	function getFilteredMedicines() {
		const q = medQuery.toLowerCase().trim();
		// Get medicine IDs that are in allergies (medicine type)
		const allergyMedicineIds = getAllergyMedicineIds(allergies);
		const filtered = q 
			? medicines.filter(m => m.name.toLowerCase().includes(q))
			: medicines;
		// Filter out only medicines that are in allergies (allow duplicate selections)
		return filtered.filter(m => !allergyMedicineIds.includes(m.id));
	}

	// Allergy management functions
	function addMedicineAllergy(medicine) {
		if (!medicine || !medicine.id) return;
		// Check if already added
		if (allergies.some(a => a.type === 'medicine' && a.medicineId === medicine.id)) {
			return;
		}
		setNoKnownAllergies(false); // Uncheck "no known allergies" when adding an allergy
		setAllergies([...allergies, {
			type: 'medicine',
			medicineId: medicine.id,
			medicineName: medicine.name
		}]);
		setAllergyMedQuery('');
		setShowAllergyMedDropdown(false);
	}

	function addOtherAllergy(text) {
		if (!text || !text.trim()) return;
		// Check if already added
		if (allergies.some(a => a.type === 'other' && a.text?.toLowerCase() === text.trim().toLowerCase())) {
			return;
		}
		setNoKnownAllergies(false); // Uncheck "no known allergies" when adding an allergy
		setAllergies([...allergies, {
			type: 'other',
			text: text.trim()
		}]);
		setAllergyInput('');
	}

	function removeAllergy(index) {
		setAllergies(allergies.filter((_, i) => i !== index));
	}

	function getFilteredAllergyMedicines() {
		const q = allergyMedQuery.toLowerCase().trim();
		const allergyMedicineIds = getAllergyMedicineIds(allergies);
		const filtered = q 
			? medicines.filter(m => m.name.toLowerCase().includes(q))
			: medicines;
		// Filter out medicines already in allergies
		return filtered.filter(m => !allergyMedicineIds.includes(m.id));
	}

	async function onSubmit(e) {
		e.preventDefault();
		setMessage('');
		setError('');
		if (!name) {
			setError('Please fill Name');
			return;
		}
		// Validate that all medicines have dosage
		const medicinesWithoutDosage = selectedMedicines.filter(m => !m.dosage || m.dosage.trim() === '');
		if (medicinesWithoutDosage.length > 0) {
			setError('Please specify dosage for all selected medicines');
			return;
		}
		setSaving(true);
		try {
			const prescriptionData = selectedMedicines.map(m => ({
				medicineId: m.id,
				brand: m.brand || '', // Custom brand (instance-specific only)
				dosage: m.dosage || '',
				duration: m.duration || '',
				durationUnit: m.durationUnit || 'weeks'
			}));
			const birthdayISO = birthday.trim() ? convertToYYYYMMDD(birthday.trim()) : undefined;
			const res = await apiCreateVisit(token, { 
				patientId: patientId || undefined,
				name, 
				birthday: birthdayISO,
				phoneNumber: phoneNumber.trim() || undefined,
				nic: nic.trim() || undefined,
				gender: gender.trim(),
				pastMedicalHistory: pastMedicalHistory.trim(),
				familyHistory: familyHistory.trim(),
				allergies: stringifyAllergies(allergies),
				prescriptions: prescriptionData,
				presentingComplaint: presentingComplaint.trim(),
				examinationFindings: examinationFindings.trim(),
				investigations: investigations, // Array of investigation results
				investigationsToDo: showInvestigationsToDo ? investigationsToDo : [],
				notes: doctorsNotes.trim(),
				generateReferralLetter: generateReferralLetter,
				referralDoctorName: generateReferralLetter ? referralDoctorName.trim() : '',
				referralLetterBody: generateReferralLetter ? referralLetterBody.trim() : ''
			});
			setMessage('Visit saved successfully!');
			const visitDate = new Date().toISOString();
			// Use patient data from response if available, otherwise use form data
			const patientData = res.patient || { 
				patientId, 
				name, 
				birthday: birthdayISO, 
				phoneNumber, 
				nic, 
				age: res.patient?.age || null,
				gender, 
				pastMedicalHistory, 
				familyHistory, 
				allergies 
			};
			const patientSnapshot = {
				patientId: patientData.patientId,
				nic: patientData.nic || '',
				name: patientData.name,
				birthday: patientData.birthday || '',
				phoneNumber: patientData.phoneNumber || '',
				age: patientData.age,
				gender: patientData.gender || '',
				pastMedicalHistory: patientData.pastMedicalHistory || '',
				familyHistory: patientData.familyHistory || '',
				allergies: patientData.allergies || ''
			};
			setLastVisit({
				id: 'new',
				date: visitDate,
				medicines: selectedMedicines.map(m => {
					const med = medicines.find(med => med.id === m.id);
					return { 
						...med, 
						brand: m.brand || '', 
						dosage: m.dosage || '',
						duration: m.duration || '',
						durationUnit: m.durationUnit || 'weeks'
					};
				}),
				notes: doctorsNotes.trim(),
				presentingComplaint: presentingComplaint.trim(),
				examinationFindings: examinationFindings.trim(),
				investigations: investigations, // Array of investigation results
				investigationsToDo: showInvestigationsToDo ? investigationsToDo : [],
				referralLetter: generateReferralLetter ? {
					referralDoctorName: referralDoctorName.trim(),
					referralLetterBody: referralLetterBody.trim()
				} : null
			});
			setLastPatient(patientSnapshot);
			setShowModal(false);
			setVisitSaved(true);
			// Refresh patient lookup to show updated history
			if (res.patient?.patientId) {
				await selectPatient(res.patient.patientId);
			}
		} catch (e) {
			setError('Failed to save visit');
		} finally {
			setSaving(false);
		}
	}

	return (
		<div>
			{/* Success banner - shown after visit is saved */}
			{visitSaved && (
				<div className="card" style={{ 
					background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
					border: 'none',
					color: 'white',
					marginBottom: 20,
					padding: '20px 24px'
				}}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
						<div>
							<div style={{ fontSize: '18px', fontWeight: 600, marginBottom: 4 }}>✓ Visit saved successfully!</div>
							<div style={{ opacity: 0.9, fontSize: '14px' }}>You can view or download the prescription below.</div>
						</div>
						<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
							<button 
								type="button" 
								onClick={() => setShowModal(true)} 
								style={{ 
									background: 'white', 
									color: '#059669', 
									border: 'none',
									padding: '10px 20px',
									borderRadius: '6px',
									fontWeight: 600,
									cursor: 'pointer'
								}}
							>
								View Prescription
							</button>
							{lastVisit?.referralLetter && (
								<button 
									type="button" 
									onClick={() => {
										setReferralModalData({
											doctorName: user?.name || user?.username,
											patient: lastPatient || { nic, name, age, gender },
											visit: { date: lastVisit.date },
											referralDoctorName: lastVisit.referralLetter.referralDoctorName,
											referralLetterBody: lastVisit.referralLetter.referralLetterBody
										});
										setReferralModalOpen(true);
									}} 
									style={{ 
										background: 'white', 
										color: '#059669', 
										border: 'none',
										padding: '10px 20px',
										borderRadius: '6px',
										fontWeight: 600,
										cursor: 'pointer'
									}}
								>
									📋 View Referral Letter
								</button>
							)}
							<button 
								type="button" 
								onClick={resetAll}
								style={{ 
									background: 'rgba(255,255,255,0.2)', 
									color: 'white', 
									border: '2px solid white',
									padding: '10px 20px',
									borderRadius: '6px',
									fontWeight: 600,
									cursor: 'pointer'
								}}
							>
								Next Patient →
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Multi-Criteria Patient Search Section - Hidden when visit is saved */}
			{!visitSaved && (
				<div className="card" style={{ 
					marginBottom: 24, 
					background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
					border: 'none',
					boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
				}}>
				<div style={{ marginBottom: 16 }}>
					<label style={{ 
						display: 'block', 
						marginBottom: 16, 
						fontWeight: 600, 
						fontSize: '18px',
						color: 'white'
					}}>
						👤 Search Patient
					</label>
					<div className="search-grid">
						<div>
							<label htmlFor="searchName" style={{ 
								display: 'block', 
								marginBottom: 6, 
								fontWeight: 500, 
								fontSize: '13px',
								color: 'rgba(255, 255, 255, 0.9)'
							}}>
								Name
							</label>
							<input 
								id="searchName" 
								value={searchName} 
								onChange={e => setSearchName(e.target.value)} 
								onKeyDown={e => {
									if (e.key === 'Enter') {
										e.preventDefault();
										searchPatients();
									}
								}}
								placeholder="Full name..." 
								disabled={lookupLoading}
								autoFocus
								style={{ 
									width: '100%', 
									fontSize: '15px', 
									padding: '10px 12px',
									border: 'none',
									borderRadius: '6px',
									background: 'white',
									boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
								}}
							/>
						</div>
						<div>
							<label htmlFor="searchNic" style={{ 
								display: 'block', 
								marginBottom: 6, 
								fontWeight: 500, 
								fontSize: '13px',
								color: 'rgba(255, 255, 255, 0.9)'
							}}>
								NIC Number
							</label>
							<input 
								id="searchNic" 
								value={searchNic} 
								onChange={e => setSearchNic(e.target.value)} 
								onKeyDown={e => {
									if (e.key === 'Enter') {
										e.preventDefault();
										searchPatients();
									}
								}}
								placeholder="NIC number..." 
								disabled={lookupLoading}
								style={{ 
									width: '100%', 
									fontSize: '15px', 
									padding: '10px 12px',
									border: 'none',
									borderRadius: '6px',
									background: 'white',
									boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
								}}
							/>
						</div>
						<div>
							<label htmlFor="searchPhone" style={{ 
								display: 'block', 
								marginBottom: 6, 
								fontWeight: 500, 
								fontSize: '13px',
								color: 'rgba(255, 255, 255, 0.9)'
							}}>
								Phone Number
							</label>
							<input 
								id="searchPhone" 
								value={searchPhone} 
								onChange={e => setSearchPhone(e.target.value)} 
								onKeyDown={e => {
									if (e.key === 'Enter') {
										e.preventDefault();
										searchPatients();
									}
								}}
								placeholder="Phone number..." 
								disabled={lookupLoading}
								type="tel"
								style={{ 
									width: '100%', 
									fontSize: '15px', 
									padding: '10px 12px',
									border: 'none',
									borderRadius: '6px',
									background: 'white',
									boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
								}}
							/>
						</div>
						<div>
							<label htmlFor="searchBirthday" style={{ 
								display: 'block', 
								marginBottom: 6, 
								fontWeight: 500, 
								fontSize: '13px',
								color: 'rgba(255, 255, 255, 0.9)'
							}}>
								Birthday
							</label>
							<input 
								id="searchBirthday" 
								value={searchBirthday ? convertToYYYYMMDD(searchBirthday) : ''} 
								onChange={e => {
									const dateValue = e.target.value; // YYYY-MM-DD format from date input
									if (dateValue) {
										// Convert to DD/MM/YYYY for storage
										setSearchBirthday(convertToDDMMYYYY(dateValue));
									} else {
										setSearchBirthday('');
									}
								}} 
								onKeyDown={e => {
									if (e.key === 'Enter') {
										e.preventDefault();
										searchPatients();
									}
								}}
								placeholder="DD/MM/YYYY" 
								disabled={lookupLoading}
								type="date"
								max={new Date().toISOString().split('T')[0]}
								style={{ 
									width: '100%', 
									fontSize: '15px', 
									padding: '10px 12px',
									border: 'none',
									borderRadius: '6px',
									background: 'white',
									boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
								}}
							/>
						</div>
					</div>
					{/* Search and Clear Buttons */}
					<div style={{ 
						display: 'flex', 
						gap: 12, 
						marginTop: 16,
						flexWrap: 'wrap'
					}}>
						<button
							type="button"
							onClick={searchPatients}
							disabled={lookupLoading}
							style={{
								padding: '12px 24px',
								background: lookupLoading ? 'rgba(255, 255, 255, 0.5)' : 'white',
								color: lookupLoading ? 'rgba(102, 126, 234, 0.5)' : '#667eea',
								border: 'none',
								borderRadius: '8px',
								fontSize: '15px',
								fontWeight: 600,
								cursor: lookupLoading ? 'not-allowed' : 'pointer',
								display: 'flex',
								alignItems: 'center',
								gap: 8,
								boxShadow: lookupLoading ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.1)',
								transition: 'all 0.2s'
							}}
							onMouseEnter={(e) => {
								if (!lookupLoading) {
									e.target.style.transform = 'translateY(-1px)';
									e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.15)';
								}
							}}
							onMouseLeave={(e) => {
								if (!lookupLoading) {
									e.target.style.transform = 'translateY(0)';
									e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
								}
							}}
						>
							<span>🔍</span>
							<span>{lookupLoading ? 'Searching...' : 'Search'}</span>
						</button>
						<button
							type="button"
							onClick={clearSearch}
							disabled={lookupLoading}
							style={{
								padding: '12px 24px',
								background: 'rgba(255, 255, 255, 0.2)',
								color: 'white',
								border: '2px solid rgba(255, 255, 255, 0.5)',
								borderRadius: '8px',
								fontSize: '15px',
								fontWeight: 600,
								cursor: lookupLoading ? 'not-allowed' : 'pointer',
								display: 'flex',
								alignItems: 'center',
								gap: 8,
								transition: 'all 0.2s'
							}}
							onMouseEnter={(e) => {
								if (!lookupLoading) {
									e.target.style.background = 'rgba(255, 255, 255, 0.3)';
									e.target.style.borderColor = 'rgba(255, 255, 255, 0.8)';
									e.target.style.transform = 'translateY(-1px)';
								}
							}}
							onMouseLeave={(e) => {
								if (!lookupLoading) {
									e.target.style.background = 'rgba(255, 255, 255, 0.2)';
									e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
									e.target.style.transform = 'translateY(0)';
								}
							}}
						>
							<span>✕</span>
							<span>Clear</span>
						</button>
					</div>
					{lookupLoading && (
						<div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px' }}>
							<span>🔍</span> Searching patient database...
						</div>
					)}
					{lookupError && (
						<div style={{ 
							color: '#fff', 
							marginTop: 12, 
							padding: '12px 16px', 
							background: 'rgba(220, 38, 38, 0.9)', 
							borderRadius: '8px', 
							fontSize: '14px',
							border: '1px solid rgba(255, 255, 255, 0.2)'
						}}>
							{lookupError}
						</div>
					)}
					{/* Search Results Dropdown */}
					{showSearchResults && searchResults.length > 0 && (
						<div style={{ 
							marginTop: 12,
							background: 'white',
							borderRadius: '8px',
							boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
							maxHeight: '300px',
							overflowY: 'auto',
							border: '2px solid rgba(255, 255, 255, 0.3)'
						}}>
							{searchResults.map((patient) => (
								<button
									key={patient.patientId}
									type="button"
									onClick={() => selectPatient(patient.patientId)}
									style={{
										width: '100%',
										padding: '14px 16px',
										border: 'none',
										borderBottom: '1px solid #e2e8f0',
										background: 'white',
										textAlign: 'left',
										cursor: 'pointer',
										transition: 'background 0.2s'
									}}
									onMouseEnter={(e) => e.target.style.background = '#f8fafc'}
									onMouseLeave={(e) => e.target.style.background = 'white'}
								>
									<div style={{ fontWeight: 600, fontSize: '15px', color: '#1e293b', marginBottom: 4 }}>
										{patient.name}
									</div>
									<div style={{ fontSize: '13px', color: '#64748b', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
										{patient.nic && <span>NIC: {patient.nic}</span>}
										{patient.phoneNumber && <span>Phone: {patient.phoneNumber}</span>}
										{patient.birthday && <span>DOB: {convertToDDMMYYYY(patient.birthday)}</span>}
										{patient.age && <span>Age: {patient.age} years</span>}
									</div>
								</button>
							))}
						</div>
					)}
					{searchPerformed && searchResults.length === 0 && !lookupLoading && (
						<div style={{ 
							marginTop: 12, 
							padding: '16px', 
							background: 'rgba(255, 255, 255, 0.95)', 
							borderRadius: '8px',
							textAlign: 'center',
							color: '#64748b',
							fontSize: '14px'
						}}>
							No patients found. You can create a new patient by filling the form below.
						</div>
					)}
				</div>
			</div>
			)}

			{/* Main Content Area - Two columns if patient exists with visits, single column if new */}
			{/* Show form if: patient is selected, OR search performed with no results, OR no search performed and name entered */}
			{(patientLookup || (searchPerformed && searchResults.length === 0) || (!searchPerformed && name.trim())) && !visitSaved && (
				<div style={{ 
					display: 'grid', 
					gridTemplateColumns: (patientLookup && patientLookup.visits?.length > 0) || patientId ? 'minmax(300px, 1fr) minmax(300px, 1.5fr)' : '1fr',
					gap: 24,
					alignItems: 'start',
					width: '100%',
					maxWidth: '100%',
					boxSizing: 'border-box'
				}} className="visit-layout">
					{/* Left Column - Patient History (if exists with visits) or Drug History (if patientId exists) */}
					{((patientLookup && patientLookup.visits && patientLookup.visits.length > 0) || patientId) && (
						<div>
							{/* Drug History Card - Show for all patients with patientId */}
							{patientId && <DrugHistory patientId={patientId} medicines={medicines} />}
							
							{/* Patient Information Card with Edit Functionality - Only show if patient has visits */}
							{patientLookup && patientLookup.visits && patientLookup.visits.length > 0 && (
								<div className="card" style={{ 
								marginBottom: 20,
								background: editMode ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' : 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
								border: editMode ? '2px solid #fbbf24' : '2px solid #e0e7ff',
								boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
								transition: 'all 0.3s ease'
							}}>
								<div style={{ 
									display: 'flex', 
									alignItems: 'center', 
									gap: 10, 
									marginBottom: 20,
									paddingBottom: 16,
									borderBottom: editMode ? '2px solid rgba(251, 191, 36, 0.3)' : '2px solid #e2e8f0'
								}}>
									<div style={{
										width: 40,
										height: 40,
										borderRadius: '10px',
										background: editMode ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										fontSize: '20px',
										flexShrink: 0
									}}>
										{editMode ? '✏️' : '👤'}
									</div>
									<h3 style={{ 
										margin: 0, 
										fontSize: '18px', 
										fontWeight: 700,
										color: editMode ? '#92400e' : '#1e293b'
									}}>
										Patient Information
									</h3>
									<span style={{ 
										marginLeft: 'auto',
										fontSize: '11px',
										padding: '4px 10px',
										background: editMode ? '#fbbf24' : '#e2e8f0',
										borderRadius: '12px',
										color: editMode ? '#78350f' : '#64748b',
										fontWeight: editMode ? 600 : 500,
										textTransform: 'uppercase',
										letterSpacing: '0.5px'
									}}>
										{editMode ? 'Editing' : 'Pre-filled'}
									</span>
									<button
										type="button"
										onClick={() => {
											if (editMode) {
												// Cancel - reset to original values
												if (patientLookup) {
													setName(patientLookup.name);
													setAge(String(patientLookup.age));
													setGender(patientLookup.gender || '');
													setPastMedicalHistory(patientLookup.pastMedicalHistory || '');
													setFamilyHistory(patientLookup.familyHistory || '');
													// Parse allergies from patient lookup
													const parsedAllergies = parseAllergies(patientLookup.allergies);
													setAllergies(parsedAllergies);
												}
											}
											setEditMode(!editMode);
										}}
										style={{
											marginLeft: 12,
											padding: '6px 14px',
											background: editMode ? '#ef4444' : '#667eea',
											border: 'none',
											borderRadius: '8px',
											color: 'white',
											fontSize: '12px',
											fontWeight: 600,
											cursor: 'pointer',
											display: 'flex',
											alignItems: 'center',
											gap: 4,
											transition: 'all 0.2s',
											boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
										}}
										onMouseEnter={(e) => {
											e.target.style.transform = 'translateY(-1px)';
											e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.15)';
										}}
										onMouseLeave={(e) => {
											e.target.style.transform = 'translateY(0)';
											e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
										}}
									>
										<span>{editMode ? '✕ Cancel' : '✏️ Edit'}</span>
									</button>
								</div>

								{editMode ? (
									<>
										{/* Edit Mode: Show Input Fields */}
										<div style={{ display: 'grid', gap: 16 }}>
											<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
												<div className="form-field">
													<label style={{ fontSize: '12px', fontWeight: 600, marginBottom: 6, color: '#78350f' }}>
														Full Name <span style={{ color: '#ef4444' }}>*</span>
													</label>
													<input 
														value={name} 
														onChange={e => setName(e.target.value)} 
														placeholder="Enter patient's full name" 
														required
														style={{ 
															width: '100%', 
															padding: '8px 10px', 
															fontSize: '13px',
															border: '1px solid #fbbf24',
															borderRadius: '6px',
															background: 'white'
														}}
													/>
												</div>
												<div className="form-field">
													<label style={{ fontSize: '12px', fontWeight: 600, marginBottom: 6, color: '#78350f' }}>
														Birthday
													</label>
													<input 
														value={birthday ? convertToYYYYMMDD(birthday) : ''} 
														onChange={e => {
															const dateValue = e.target.value; // YYYY-MM-DD format from date input
															if (dateValue) {
																// Convert to DD/MM/YYYY for storage
																const ddmmYYYY = convertToDDMMYYYY(dateValue);
																setBirthday(ddmmYYYY);
																// Auto-calculate age
																const birthDate = new Date(dateValue);
																if (!isNaN(birthDate.getTime())) {
																	const today = new Date();
																	let calculatedAge = today.getFullYear() - birthDate.getFullYear();
																	const monthDiff = today.getMonth() - birthDate.getMonth();
																	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
																		calculatedAge--;
																	}
																	setAge(String(calculatedAge));
																}
															} else {
																setBirthday('');
																setAge('');
															}
														}} 
														type="date"
														max={new Date().toISOString().split('T')[0]}
														style={{ 
															width: '100%', 
															padding: '8px 10px', 
															fontSize: '13px',
															border: '1px solid #fbbf24',
															borderRadius: '6px',
															background: 'white'
														}}
													/>
												</div>
											</div>
											<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
												<div className="form-field">
													<label style={{ fontSize: '12px', fontWeight: 600, marginBottom: 6, color: '#78350f' }}>
														Phone Number
													</label>
													<input 
														value={phoneNumber} 
														onChange={e => setPhoneNumber(e.target.value)} 
														placeholder="Phone number..." 
														type="tel"
														style={{ 
															width: '100%', 
															padding: '8px 10px', 
															fontSize: '13px',
															border: '1px solid #fbbf24',
															borderRadius: '6px',
															background: 'white'
														}}
													/>
												</div>
												<div className="form-field">
													<label style={{ fontSize: '12px', fontWeight: 600, marginBottom: 6, color: '#78350f' }}>
														NIC Number
													</label>
													<input 
														value={nic} 
														onChange={e => setNic(e.target.value)} 
														placeholder="NIC number..." 
														style={{ 
															width: '100%', 
															padding: '8px 10px', 
															fontSize: '13px',
															border: '1px solid #fbbf24',
															borderRadius: '6px',
															background: 'white'
														}}
													/>
												</div>
											</div>

											<div className="form-field">
												<label style={{ fontSize: '12px', fontWeight: 600, marginBottom: 6, color: '#78350f' }}>
													Gender
												</label>
												<select
													value={gender}
													onChange={e => setGender(e.target.value)}
													style={{ 
														width: '100%', 
														padding: '8px 10px', 
														fontSize: '13px',
														border: '1px solid #fbbf24',
														borderRadius: '6px',
														background: 'white',
														cursor: 'pointer'
													}}
												>
													<option value="">Select gender</option>
													<option value="Male">Male</option>
													<option value="Female">Female</option>
													<option value="Other">Other</option>
													<option value="Prefer not to say">Prefer not to say</option>
												</select>
											</div>

											<div className="form-field">
												<label style={{ fontSize: '12px', fontWeight: 600, marginBottom: 6, color: '#78350f' }}>
													Past Medical History <span style={{ fontSize: '10px', fontWeight: 400, color: '#a16207' }}>(appears on prescription)</span>
												</label>
												<textarea
													value={pastMedicalHistory}
													onChange={e => setPastMedicalHistory(e.target.value)}
													placeholder="Update past medical history if needed..."
													rows={3}
													style={{ 
														width: '100%', 
														padding: '8px 10px', 
														fontSize: '13px',
														fontFamily: 'inherit',
														resize: 'vertical',
														border: '1px solid #fbbf24',
														borderRadius: '6px',
														boxSizing: 'border-box',
														lineHeight: '1.5',
														background: 'white'
													}}
												/>
											</div>

											<div className="form-field">
												<label style={{ fontSize: '12px', fontWeight: 600, marginBottom: 6, color: '#78350f' }}>
													Family History
												</label>
												<textarea
													value={familyHistory}
													onChange={e => setFamilyHistory(e.target.value)}
													placeholder="Update family history if needed..."
													rows={2}
													style={{ 
														width: '100%', 
														padding: '8px 10px', 
														fontSize: '13px',
														fontFamily: 'inherit',
														resize: 'vertical',
														border: '1px solid #fbbf24',
														borderRadius: '6px',
														boxSizing: 'border-box',
														lineHeight: '1.5',
														background: 'white'
													}}
												/>
											</div>

											<div className="form-field">
												<label style={{ fontSize: '12px', fontWeight: 600, marginBottom: 6, color: '#78350f' }}>
													⚠️ Allergies
												</label>
												{/* Allergies Management UI */}
												<div style={{
													border: allergies.length > 0 ? '2px solid #f87171' : '1px solid #fbbf24',
													borderRadius: '6px',
													background: allergies.length > 0 ? '#fef2f2' : 'white',
													padding: '12px'
												}}>
													{/* Selected Allergies Display */}
													{allergies.length > 0 && (
														<div style={{ 
															display: 'flex', 
															flexWrap: 'wrap', 
															gap: 8, 
															marginBottom: 12 
														}}>
															{allergies.map((allergy, index) => (
																<div
																	key={index}
																	style={{
																		display: 'flex',
																		alignItems: 'center',
																		gap: 6,
																		padding: '6px 12px',
																		background: allergy.type === 'medicine' ? '#dbeafe' : '#fef3c7',
																		border: `1px solid ${allergy.type === 'medicine' ? '#93c5fd' : '#fcd34d'}`,
																		borderRadius: '20px',
																		fontSize: '12px',
																		fontWeight: 500,
																		color: allergy.type === 'medicine' ? '#1e40af' : '#92400e'
																	}}
																>
																	<span>{allergy.type === 'medicine' ? '💊' : '⚠️'}</span>
																	<span>{allergy.type === 'medicine' ? allergy.medicineName : allergy.text}</span>
																	<button
																		type="button"
																		onClick={() => removeAllergy(index)}
																		style={{
																			background: 'transparent',
																			border: 'none',
																			cursor: 'pointer',
																			padding: 0,
																			marginLeft: 4,
																			fontSize: '14px',
																			color: 'inherit',
																			opacity: 0.7
																		}}
																		title="Remove allergy"
																	>
																		×
																	</button>
																</div>
															))}
														</div>
													)}
													
													{/* Add Medicine Allergy */}
													<div style={{ position: 'relative', marginBottom: 12 }}>
														<input
															type="text"
															value={allergyMedQuery}
															onChange={e => {
																setAllergyMedQuery(e.target.value);
																setShowAllergyMedDropdown(true);
															}}
															onFocus={() => setShowAllergyMedDropdown(true)}
															onBlur={() => {
																// Delay to allow click on dropdown item
																setTimeout(() => setShowAllergyMedDropdown(false), 200);
															}}
															placeholder="Search medicine to add as allergy..."
															style={{
																width: '100%',
																padding: '8px 10px',
																fontSize: '13px',
																border: '1px solid #d1d5db',
																borderRadius: '6px',
																background: 'white'
															}}
														/>
														{showAllergyMedDropdown && (
															<div style={{
																position: 'absolute',
																top: '100%',
																left: 0,
																right: 0,
																background: 'white',
																border: '1px solid #d1d5db',
																borderRadius: '6px',
																boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
																zIndex: 1000,
																maxHeight: '200px',
																overflowY: 'auto',
																marginTop: '4px'
															}}>
																{getFilteredAllergyMedicines().length > 0 ? (
																	getFilteredAllergyMedicines().slice(0, 10).map(med => (
																		<button
																			type="button"
																			key={med.id}
																			onClick={() => addMedicineAllergy(med)}
																			style={{
																				width: '100%',
																				padding: '10px 12px',
																				textAlign: 'left',
																				border: 'none',
																				background: 'white',
																				cursor: 'pointer',
																				fontSize: '13px',
																				borderBottom: '1px solid #f3f4f6'
																			}}
																			onMouseEnter={(e) => e.target.style.background = '#f9fafb'}
																			onMouseLeave={(e) => e.target.style.background = 'white'}
																		>
																			💊 {med.name}
																		</button>
																	))
																) : (
																	<div style={{ padding: '10px 12px', color: '#6b7280', fontSize: '13px' }}>
																		{allergyMedQuery.trim() ? 'No medicines found' : 'Start typing to search medicines...'}
																	</div>
																)}
															</div>
														)}
													</div>
													
													{/* Add Other Allergy */}
													<div style={{ display: 'flex', gap: 8 }}>
														<input
															type="text"
															value={allergyInput}
															onChange={e => setAllergyInput(e.target.value)}
															onKeyDown={e => {
																if (e.key === 'Enter') {
																	e.preventDefault();
																	addOtherAllergy(allergyInput);
																}
															}}
															placeholder="Add other allergy (e.g., Peanuts, Latex)..."
															style={{
																flex: 1,
																padding: '8px 10px',
																fontSize: '13px',
																border: '1px solid #d1d5db',
																borderRadius: '6px',
																background: 'white'
															}}
														/>
														<button
															type="button"
															onClick={() => addOtherAllergy(allergyInput)}
															disabled={!allergyInput.trim()}
															style={{
																padding: '8px 16px',
																background: allergyInput.trim() ? '#fbbf24' : '#e5e7eb',
																color: allergyInput.trim() ? '#78350f' : '#9ca3af',
																border: 'none',
																borderRadius: '6px',
																fontSize: '13px',
																fontWeight: 600,
																cursor: allergyInput.trim() ? 'pointer' : 'not-allowed'
															}}
														>
															Add
														</button>
													</div>
												</div>
											</div>
										</div>

										{/* Save Button for Patient Info */}
										<div style={{ 
											marginTop: 20,
											display: 'flex',
											gap: 12,
											justifyContent: 'flex-end',
											paddingTop: 16,
											borderTop: '2px solid rgba(251, 191, 36, 0.3)'
										}}>
											<button
												type="button"
												onClick={savePatientInfo}
												disabled={savingPatientInfo}
												style={{
													padding: '8px 20px',
													background: savingPatientInfo ? '#94a3b8' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
													border: 'none',
													borderRadius: '8px',
													color: 'white',
													fontSize: '13px',
													fontWeight: 600,
													cursor: savingPatientInfo ? 'not-allowed' : 'pointer',
													transition: 'all 0.2s',
													display: 'flex',
													alignItems: 'center',
													gap: 6,
													boxShadow: savingPatientInfo ? 'none' : '0 2px 4px rgba(0, 0, 0, 0.1)'
												}}
												onMouseEnter={(e) => {
													if (!savingPatientInfo) {
														e.target.style.transform = 'translateY(-1px)';
														e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.15)';
													}
												}}
												onMouseLeave={(e) => {
													if (!savingPatientInfo) {
														e.target.style.transform = 'translateY(0)';
														e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
													}
												}}
											>
												{savingPatientInfo ? (
													<>
														<span>⏳</span>
														<span>Saving...</span>
													</>
												) : (
													<>
														<span>💾</span>
														<span>Save</span>
													</>
												)}
											</button>
										</div>
									</>
								) : (
									<>
										{/* View Mode: Show Read-only Display */}
										<div style={{ display: 'grid', gap: 16 }}>
											{patientLookup.nic && (
												<div style={{ 
													display: 'flex', 
													justifyContent: 'space-between', 
													alignItems: 'center',
													padding: '12px 16px',
													background: '#f8fafc',
													borderRadius: '8px',
													border: '1px solid #e2e8f0'
												}}>
													<span style={{ color: '#64748b', fontWeight: 500, fontSize: '14px' }}>NIC:</span>
													<span style={{ fontWeight: 600, fontSize: '15px', color: '#1e293b' }}>{patientLookup.nic}</span>
												</div>
											)}
											<div style={{ 
												display: 'flex', 
												justifyContent: 'space-between', 
												alignItems: 'center',
												padding: '12px 16px',
												background: '#f8fafc',
												borderRadius: '8px',
												border: '1px solid #e2e8f0'
											}}>
												<span style={{ color: '#64748b', fontWeight: 500, fontSize: '14px' }}>Name:</span>
												<span style={{ fontWeight: 600, fontSize: '15px', color: '#1e293b' }}>{name || patientLookup.name}</span>
											</div>
											{patientLookup.birthday && (
												<div style={{ 
													display: 'flex', 
													justifyContent: 'space-between', 
													alignItems: 'center',
													padding: '12px 16px',
													background: '#f8fafc',
													borderRadius: '8px',
													border: '1px solid #e2e8f0'
												}}>
													<span style={{ color: '#64748b', fontWeight: 500, fontSize: '14px' }}>Birthday:</span>
													<span style={{ fontWeight: 600, fontSize: '15px', color: '#1e293b' }}>{convertToDDMMYYYY(patientLookup.birthday)}</span>
												</div>
											)}
											{patientLookup.phoneNumber && (
												<div style={{ 
													display: 'flex', 
													justifyContent: 'space-between', 
													alignItems: 'center',
													padding: '12px 16px',
													background: '#f8fafc',
													borderRadius: '8px',
													border: '1px solid #e2e8f0'
												}}>
													<span style={{ color: '#64748b', fontWeight: 500, fontSize: '14px' }}>Phone:</span>
													<span style={{ fontWeight: 600, fontSize: '15px', color: '#1e293b' }}>{patientLookup.phoneNumber}</span>
												</div>
											)}
											{patientLookup.age && (
												<div style={{ 
													display: 'flex', 
													justifyContent: 'space-between', 
													alignItems: 'center',
													padding: '12px 16px',
													background: '#f8fafc',
													borderRadius: '8px',
													border: '1px solid #e2e8f0'
												}}>
													<span style={{ color: '#64748b', fontWeight: 500, fontSize: '14px' }}>Age:</span>
													<span style={{ fontWeight: 600, fontSize: '15px', color: '#1e293b' }}>{patientLookup.age} years</span>
												</div>
											)}
											{gender && (
												<div style={{ 
													display: 'flex', 
													justifyContent: 'space-between', 
													alignItems: 'center',
													padding: '12px 16px',
													background: '#f8fafc',
													borderRadius: '8px',
													border: '1px solid #e2e8f0'
												}}>
													<span style={{ color: '#64748b', fontWeight: 500, fontSize: '14px' }}>Gender:</span>
													<span style={{ fontWeight: 600, fontSize: '15px', color: '#1e293b' }}>{gender}</span>
												</div>
											)}
											{pastMedicalHistory && (
												<div style={{ 
													padding: '16px',
													background: '#f8fafc',
													borderRadius: '8px',
													border: '1px solid #e2e8f0'
												}}>
													<div style={{ 
														color: '#64748b', 
														fontWeight: 600, 
														marginBottom: 8,
														fontSize: '14px',
														display: 'flex',
														alignItems: 'center',
														gap: 6
													}}>
														<span>🏥</span>
														<span>Past Medical History</span>
													</div>
													<div style={{ 
														fontSize: '13px', 
														color: '#1e293b', 
														whiteSpace: 'pre-wrap',
														lineHeight: '1.6',
														padding: '12px',
														background: 'white',
														borderRadius: '6px',
														border: '1px solid #e2e8f0'
													}}>
														{pastMedicalHistory}
													</div>
												</div>
											)}
											{familyHistory && (
												<div style={{ 
													padding: '16px',
													background: '#f8fafc',
													borderRadius: '8px',
													border: '1px solid #e2e8f0'
												}}>
													<div style={{ 
														color: '#64748b', 
														fontWeight: 600, 
														marginBottom: 8,
														fontSize: '14px',
														display: 'flex',
														alignItems: 'center',
														gap: 6
													}}>
														<span>👨‍👩‍👧‍👦</span>
														<span>Family History</span>
													</div>
													<div style={{ 
														fontSize: '13px', 
														color: '#1e293b', 
														whiteSpace: 'pre-wrap',
														lineHeight: '1.6',
														padding: '12px',
														background: 'white',
														borderRadius: '6px',
														border: '1px solid #e2e8f0'
													}}>
														{familyHistory}
													</div>
												</div>
											)}
											{/* Allergies Section - Always show */}
											<div style={{ 
												padding: '16px',
												background: allergies && allergies.length > 0 ? '#fef2f2' : '#f0fdf4',
												borderRadius: '8px',
												border: allergies && allergies.length > 0 ? '2px solid #fca5a5' : '2px solid #86efac'
											}}>
												<div style={{ 
													color: allergies && allergies.length > 0 ? '#dc2626' : '#16a34a', 
													fontWeight: 600, 
													marginBottom: allergies && allergies.length > 0 ? 12 : 0,
													fontSize: '14px',
													display: 'flex',
													alignItems: 'center',
													gap: 6
												}}>
													<span>{allergies && allergies.length > 0 ? '⚠️' : '✓'}</span>
													<span>Allergies</span>
												</div>
												{allergies && allergies.length > 0 ? (
													<div style={{ 
														display: 'flex', 
														flexWrap: 'wrap', 
														gap: 8
													}}>
														{allergies.map((allergy, index) => (
															<div
																key={index}
																style={{
																	display: 'flex',
																	alignItems: 'center',
																	gap: 6,
																	padding: '6px 12px',
																	background: allergy.type === 'medicine' ? '#dbeafe' : '#fef3c7',
																	border: `1px solid ${allergy.type === 'medicine' ? '#93c5fd' : '#fcd34d'}`,
																	borderRadius: '20px',
																	fontSize: '12px',
																	fontWeight: 500,
																	color: allergy.type === 'medicine' ? '#1e40af' : '#92400e'
																}}
															>
																<span>{allergy.type === 'medicine' ? '💊' : '⚠️'}</span>
																<span>{allergy.type === 'medicine' ? allergy.medicineName : allergy.text}</span>
															</div>
														))}
													</div>
												) : (
													<div style={{
														marginTop: 8,
														padding: '8px 12px',
														background: '#dcfce7',
														borderRadius: '6px',
														fontSize: '13px',
														fontWeight: 600,
														color: '#166534',
														textAlign: 'center'
													}}>
														Nil
													</div>
												)}
											</div>
										</div>
									</>
								)}
							</div>
							)}

							{/* Previous Visits Card - Only show if patient has visits */}
							{patientLookup && patientLookup.visits && patientLookup.visits.length > 0 && (
							<div className="card" style={{
								border: '2px solid #e0e7ff',
								boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
							}}>
								<div style={{ 
									display: 'flex', 
									alignItems: 'center', 
									gap: 10, 
									marginBottom: 20,
									paddingBottom: 16,
									borderBottom: '2px solid #e2e8f0'
								}}>
									<div style={{
										width: 40,
										height: 40,
										borderRadius: '10px',
										background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										fontSize: '20px',
										flexShrink: 0
									}}>
										📋
									</div>
									<h3 style={{ 
										margin: 0, 
										fontSize: '18px', 
										fontWeight: 700,
										color: '#1e293b' 
									}}>
										Previous Visits
										<span style={{ 
											marginLeft: 8,
											fontSize: '14px',
											fontWeight: 500,
											color: '#64748b'
										}}>
											({patientLookup.visits.length})
										</span>
									</h3>
								</div>
								<div style={{ maxHeight: '500px', overflowY: 'auto' }}>
									<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
										{patientLookup.visits.map((v, idx) => {
											const isExpanded = expandedVisit === v.id;
											return (
											<div 
												key={v.id} 
												style={{ 
													padding: '16px', 
													background: isExpanded 
														? 'linear-gradient(135deg, #fef3c7 0%, #fef9f5 100%)' 
														: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)', 
													borderRadius: '10px',
													border: isExpanded ? '2px solid #f59e0b' : '1px solid #e2e8f0',
													transition: 'all 0.3s',
													boxShadow: isExpanded ? '0 8px 16px rgba(245, 158, 11, 0.2)' : '0 1px 3px rgba(0, 0, 0, 0.05)',
													cursor: 'pointer'
												}}
												onClick={() => setExpandedVisit(isExpanded ? null : v.id)}
												onMouseEnter={(e) => {
													if (!isExpanded) {
														e.currentTarget.style.borderColor = '#c7d2fe';
														e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
														e.currentTarget.style.transform = 'translateY(-2px)';
													}
												}}
												onMouseLeave={(e) => {
													if (!isExpanded) {
														e.currentTarget.style.borderColor = '#e2e8f0';
														e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
														e.currentTarget.style.transform = 'translateY(0)';
													}
												}}
											>
												<div style={{ 
													display: 'flex', 
													justifyContent: 'space-between', 
													alignItems: 'start', 
													marginBottom: isExpanded ? 16 : 12 
												}}>
													<div style={{ flex: 1 }}>
														<div style={{ 
															fontSize: '11px', 
															color: '#64748b', 
															marginBottom: 6,
															fontWeight: 500,
															textTransform: 'uppercase',
															letterSpacing: '0.5px'
														}}>
															Visit #{patientLookup.visits.length - idx}
														</div>
														<div style={{ 
															fontWeight: 600, 
															color: '#1e293b',
															fontSize: '15px'
														}}>
															{new Date(v.date).toLocaleDateString('en-US', { 
																year: 'numeric', 
																month: 'short', 
																day: 'numeric',
																hour: '2-digit',
																minute: '2-digit'
															})}
														</div>
													</div>
													<div style={{
														width: 32,
														height: 32,
														borderRadius: '50%',
														background: isExpanded ? '#f59e0b' : '#e0e7ff',
														display: 'flex',
														alignItems: 'center',
														justifyContent: 'center',
														fontSize: '16px',
														transition: 'all 0.3s',
														transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
													}}>
														{isExpanded ? '▼' : '▶'}
													</div>
												</div>
												
												{/* Expandable Details Section */}
												{isExpanded && v.presentingComplaint && (
													<div style={{
														marginBottom: 16,
														padding: '14px',
														background: 'rgba(255, 255, 255, 0.8)',
														borderRadius: '8px',
														border: '1px solid #fbbf24',
														animation: 'slideDown 0.3s ease-out'
													}}>
														<div style={{
															display: 'flex',
															alignItems: 'center',
															gap: 8,
															marginBottom: 8
														}}>
															<span style={{ fontSize: '16px' }}>💬</span>
															<span style={{
																fontSize: '12px',
																fontWeight: 600,
																color: '#92400e',
																textTransform: 'uppercase',
																letterSpacing: '0.5px'
															}}>
																Presenting Complaint
															</span>
														</div>
														<div style={{
															fontSize: '14px',
															color: '#374151',
															lineHeight: '1.6',
															whiteSpace: 'pre-wrap'
														}}>
															{v.presentingComplaint}
														</div>
													</div>
												)}
												
												{/* Action Buttons */}
												<div style={{ display: 'grid', gridTemplateColumns: v.referralLetter ? '1fr 1fr' : '1fr', gap: 8 }}>
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														// Use current patientLookup data (which is updated after patient info save)
														setHistoryModalData({
															doctorName: user?.name || user?.username,
															patient: { 
																nic: patientLookup.nic, 
																name: patientLookup.name, 
																age: patientLookup.age,
																gender: patientLookup.gender || '',
																pastMedicalHistory: patientLookup.pastMedicalHistory || ''
															},
															visit: { 
																date: v.date,
																presentingComplaint: v.presentingComplaint || '',
																examinationFindings: v.examinationFindings || '',
																investigations: Array.isArray(v.investigations) ? v.investigations : (v.investigations ? [{ investigationName: v.investigations, result: '', date: '' }] : []),
																investigationsToDo: v.investigationsToDo || []
															},
															medicines: (v.prescriptions || []).map(p => ({ 
																name: p.name, 
																brand: p.brand || '', 
																dosage: p.dosage || '',
																duration: p.duration || '',
																durationUnit: p.durationUnit || 'weeks'
															})),
															notes: v.notes || '',
															referralLetter: v.referralLetter || null
														});
														setHistoryModalOpen(true);
													}}
													style={{
														width: '100%',
														padding: '10px 16px',
														background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
														border: 'none',
														borderRadius: '8px',
														cursor: 'pointer',
														fontSize: '14px',
														fontWeight: 600,
														color: 'white',
														transition: 'all 0.2s',
														display: 'flex',
														alignItems: 'center',
														justifyContent: 'center',
														gap: 8,
														boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
													}}
													onMouseEnter={(e) => {
														e.target.style.transform = 'translateY(-1px)';
														e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.15)';
													}}
													onMouseLeave={(e) => {
														e.target.style.transform = 'translateY(0)';
														e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
													}}
												>
													<span>📄</span>
													<span>View Prescription</span>
												</button>
												{v.referralLetter && (
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															setReferralModalData({
																doctorName: user?.name || user?.username,
																patient: { 
																	nic: patientLookup.nic, 
																	name: patientLookup.name, 
																	age: patientLookup.age,
																	gender: patientLookup.gender || ''
																},
																visit: { date: v.date },
																referralDoctorName: v.referralLetter.referralDoctorName || '',
																referralLetterBody: v.referralLetter.referralLetterBody || ''
															});
															setReferralModalOpen(true);
														}}
														style={{
															width: '100%',
															padding: '10px 16px',
															background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
															border: 'none',
															borderRadius: '8px',
															cursor: 'pointer',
															fontSize: '14px',
															fontWeight: 600,
															color: 'white',
															transition: 'all 0.2s',
															display: 'flex',
															alignItems: 'center',
															justifyContent: 'center',
															gap: 8,
															boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
														}}
														onMouseEnter={(e) => {
															e.target.style.transform = 'translateY(-1px)';
															e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.15)';
														}}
														onMouseLeave={(e) => {
															e.target.style.transform = 'translateY(0)';
															e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
														}}
													>
														<span>📋</span>
														<span>View Referral Letter</span>
													</button>
												)}
												</div>
											</div>
											);
										})}
									</div>
								</div>
							</div>
							)}
							</div>)}

					{/* Right/Middle Column - Add New Visit Form */}
					<div className="card" style={{ 
						background: 'white',
						border: patientLookup ? '2px solid #e0e7ff' : '2px solid #c7d2fe',
						boxShadow: patientLookup ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
						width: '100%',
						maxWidth: '100%'
					}}>
						{/* Form Header */}
						<div style={{ 
							marginBottom: 24, 
							paddingBottom: 20, 
							borderBottom: '2px solid #e2e8f0',
							display: 'flex',
							alignItems: 'center',
							gap: 12
						}}>
							<div style={{
								width: 48,
								height: 48,
								borderRadius: '12px',
								background: patientLookup ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								fontSize: '24px',
								flexShrink: 0
							}}>
								{patientLookup ? '📋' : '✨'}
							</div>
							<div>
								<h3 style={{ 
									margin: 0, 
									marginBottom: 4, 
									fontSize: '22px', 
									fontWeight: 700,
									color: '#1e293b' 
								}}>
									{patientLookup ? 'Add New Visit' : 'New Patient Registration'}
								</h3>
								<p style={{ 
									margin: 0, 
									fontSize: '14px', 
									color: '#64748b' 
								}}>
									{patientLookup ? 'Record a new visit for this patient' : 'Register a new patient and create their first visit'}
								</p>
							</div>
						</div>

						<form onSubmit={onSubmit} style={{ width: '100%' }}>
							{patientLookup ? (
								<>
									{/* For Returning Patients: Only Visit-Specific Fields (Patient Info is in left sidebar) */}
								</>
							) : (
								<>
									{/* For New Patients: Show Full Form */}
									{/* Section 1: Basic Information */}
									<div style={{ marginBottom: 32 }}>
										<div style={{ 
											display: 'flex', 
											alignItems: 'center', 
											gap: 8, 
											marginBottom: 20,
											paddingBottom: 12,
											borderBottom: '1px solid #e2e8f0'
										}}>
											<span style={{ fontSize: '20px' }}>👤</span>
											<h4 style={{ 
												margin: 0, 
												fontSize: '16px', 
												fontWeight: 600, 
												color: '#1e293b' 
											}}>
												Basic Information
											</h4>
										</div>
										
										<div className="form-grid-3" style={{ marginBottom: 20 }}>
											<div className="form-field">
												<label htmlFor="name" style={{ 
													fontSize: '14px', 
													fontWeight: 600, 
													marginBottom: 8,
													color: '#374151',
													display: 'flex',
													alignItems: 'center',
													gap: 6
												}}>
													<span>Full Name</span>
													<span style={{ color: '#ef4444' }}>*</span>
												</label>
												<input 
													id="name" 
													value={name} 
													onChange={e => setName(e.target.value)} 
													placeholder="Enter patient's full name" 
													required
													style={{ 
														width: '100%', 
														padding: '12px 14px', 
														fontSize: '15px',
														border: '1px solid #cbd5e1',
														borderRadius: '8px',
														background: 'white',
														transition: 'all 0.2s'
													}}
												/>
											</div>
											
											<div className="form-field">
												<label htmlFor="birthday" style={{ 
													fontSize: '14px', 
													fontWeight: 600, 
													marginBottom: 8,
													color: '#374151',
													display: 'flex',
													alignItems: 'center',
													gap: 6
												}}>
													<span>Birthday</span>
												</label>
												<input 
													id="birthday" 
													value={birthday ? convertToYYYYMMDD(birthday) : ''} 
													onChange={e => {
														const dateValue = e.target.value; // YYYY-MM-DD format from date input
														if (dateValue) {
															// Convert to DD/MM/YYYY for storage
															const ddmmYYYY = convertToDDMMYYYY(dateValue);
															setBirthday(ddmmYYYY);
															// Auto-calculate age when birthday changes
															const birthDate = new Date(dateValue);
															if (!isNaN(birthDate.getTime())) {
																const today = new Date();
																let calculatedAge = today.getFullYear() - birthDate.getFullYear();
																const monthDiff = today.getMonth() - birthDate.getMonth();
																if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
																	calculatedAge--;
																}
																setAge(String(calculatedAge));
															}
														} else {
															setBirthday('');
															setAge('');
														}
													}} 
													type="date"
													max={new Date().toISOString().split('T')[0]}
													style={{ 
														width: '100%', 
														padding: '12px 14px', 
														fontSize: '15px',
														border: '1px solid #cbd5e1',
														borderRadius: '8px',
														background: 'white',
														transition: 'all 0.2s'
													}}
												/>
											</div>
											
											<div className="form-field">
												<label htmlFor="phoneNumber" style={{ 
													fontSize: '14px', 
													fontWeight: 600, 
													marginBottom: 8,
													color: '#374151',
													display: 'flex',
													alignItems: 'center',
													gap: 6
												}}>
													<span>Phone Number</span>
												</label>
												<input 
													id="phoneNumber" 
													value={phoneNumber} 
													onChange={e => setPhoneNumber(e.target.value)} 
													placeholder="Phone number..." 
													type="tel"
													style={{ 
														width: '100%', 
														padding: '12px 14px', 
														fontSize: '15px',
														border: '1px solid #cbd5e1',
														borderRadius: '8px',
														background: 'white',
														transition: 'all 0.2s'
													}}
												/>
											</div>
										</div>

										<div className="form-grid-2" style={{ marginBottom: 20 }}>
											<div className="form-field">
												<label htmlFor="nic" style={{ 
													fontSize: '14px', 
													fontWeight: 600, 
													marginBottom: 8,
													color: '#374151'
												}}>
													NIC Number (Optional)
												</label>
												<input 
													id="nic" 
													value={nic} 
													onChange={e => setNic(e.target.value)} 
													placeholder="NIC number..." 
													style={{ 
														width: '100%', 
														padding: '12px 14px', 
														fontSize: '15px',
														border: '1px solid #cbd5e1',
														borderRadius: '8px',
														background: 'white',
														transition: 'all 0.2s'
													}}
												/>
											</div>
											
											<div className="form-field">
												<label htmlFor="age" style={{ 
													fontSize: '14px', 
													fontWeight: 600, 
													marginBottom: 8,
													color: '#374151',
													display: 'flex',
													alignItems: 'center',
													gap: 6
												}}>
													<span>Age</span>
													<span style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>
														(auto-calculated from birthday)
													</span>
												</label>
												<input 
													id="age" 
													value={age} 
													onChange={e => setAge(e.target.value)} 
													placeholder="Age (auto-calculated)" 
													type="number"
													min="0"
													max="150"
													disabled={!!birthday}
													style={{ 
														width: '100%', 
														padding: '12px 14px', 
														fontSize: '15px',
														border: '1px solid #cbd5e1',
														borderRadius: '8px',
														background: birthday ? '#f8fafc' : 'white',
														transition: 'all 0.2s',
														cursor: birthday ? 'not-allowed' : 'text'
													}}
												/>
											</div>
										</div>

										<div className="form-field" style={{ marginBottom: 0 }}>
											<label htmlFor="gender" style={{ 
												fontSize: '14px', 
												fontWeight: 600, 
												marginBottom: 8,
												color: '#374151'
											}}>
												Gender
											</label>
											<select
												id="gender"
												value={gender}
												onChange={e => setGender(e.target.value)}
												style={{ 
													width: '100%', 
													padding: '12px 14px', 
													fontSize: '15px',
													border: '1px solid #cbd5e1',
													borderRadius: '8px',
													background: 'white',
													cursor: 'pointer'
												}}
											>
												<option value="">Select gender</option>
												<option value="Male">Male</option>
												<option value="Female">Female</option>
												<option value="Other">Other</option>
												<option value="Prefer not to say">Prefer not to say</option>
											</select>
										</div>
									</div>

									{/* Section 2: Medical History */}
									<div style={{ marginBottom: 32 }}>
										<div style={{ 
											display: 'flex', 
											alignItems: 'center', 
											gap: 8, 
											marginBottom: 20,
											paddingBottom: 12,
											borderBottom: '1px solid #e2e8f0'
										}}>
											<span style={{ fontSize: '20px' }}>🏥</span>
											<h4 style={{ 
												margin: 0, 
												fontSize: '16px', 
												fontWeight: 600, 
												color: '#1e293b' 
											}}>
												Medical History
											</h4>
										</div>

										<div className="form-grid-2" style={{ gap: 20 }}>
											<div className="form-field">
												<label htmlFor="pastMedicalHistory" style={{ 
													fontSize: '14px', 
													fontWeight: 600, 
													marginBottom: 8,
													color: '#374151',
													display: 'flex',
													alignItems: 'center',
													gap: 6
												}}>
													<span>Past Medical History</span>
													<span style={{ fontSize: '12px', fontWeight: 400, color: '#6b7280' }}>(will appear on prescription)</span>
												</label>
												<textarea
													id="pastMedicalHistory"
													value={pastMedicalHistory}
													onChange={e => setPastMedicalHistory(e.target.value)}
													placeholder="Previous conditions, surgeries, chronic illnesses, etc."
													rows={4}
													style={{ 
														width: '100%', 
														padding: '12px 14px', 
														fontSize: '15px',
														fontFamily: 'inherit',
														resize: 'vertical',
														border: '1px solid #cbd5e1',
														borderRadius: '8px',
														boxSizing: 'border-box',
														lineHeight: '1.6'
													}}
												/>
											</div>

											<div className="form-field">
												<label htmlFor="familyHistory" style={{ 
													fontSize: '14px', 
													fontWeight: 600, 
													marginBottom: 8,
													color: '#374151'
												}}>
													Family History
												</label>
												<textarea
													id="familyHistory"
													value={familyHistory}
													onChange={e => setFamilyHistory(e.target.value)}
													placeholder="Hereditary conditions, family medical history, etc."
													rows={3}
													style={{ 
														width: '100%', 
														padding: '12px 14px', 
														fontSize: '15px',
														fontFamily: 'inherit',
														resize: 'vertical',
														border: '1px solid #cbd5e1',
														borderRadius: '8px',
														boxSizing: 'border-box',
														lineHeight: '1.6'
													}}
												/>
											</div>

											<div className="form-field" style={{ marginBottom: 0 }}>
												<label htmlFor="allergies" style={{ 
													fontSize: '14px', 
													fontWeight: 600, 
													marginBottom: 8,
													color: '#374151',
													display: 'flex',
													alignItems: 'center',
													gap: 6
												}}>
													<span>⚠️ Allergies</span>
													<span style={{ fontSize: '12px', fontWeight: 400, color: '#dc2626' }}>(Important - check before prescribing)</span>
												</label>
												{/* Allergies Management UI */}
												<div style={{
													border: allergies.length > 0 ? '2px solid #fca5a5' : noKnownAllergies ? '2px solid #86efac' : '1px solid #cbd5e1',
													borderRadius: '8px',
													background: allergies.length > 0 ? '#fef2f2' : noKnownAllergies ? '#f0fdf4' : 'white',
													padding: '16px'
												}}>
													{/* No Known Allergies Checkbox */}
													<label style={{
														display: 'flex',
														alignItems: 'center',
														gap: 10,
														marginBottom: allergies.length > 0 || !noKnownAllergies ? 16 : 0,
														padding: '12px',
														background: noKnownAllergies ? '#dcfce7' : '#f9fafb',
														borderRadius: '8px',
														cursor: 'pointer',
														border: noKnownAllergies ? '2px solid #16a34a' : '1px solid #e5e7eb',
														transition: 'all 0.2s'
													}}>
														<input
															type="checkbox"
															checked={noKnownAllergies}
															onChange={(e) => {
																setNoKnownAllergies(e.target.checked);
																if (e.target.checked) {
																	setAllergies([]); // Clear allergies when checking
																}
															}}
															disabled={allergies.length > 0}
															style={{
																width: '20px',
																height: '20px',
																cursor: allergies.length > 0 ? 'not-allowed' : 'pointer',
																accentColor: '#16a34a'
															}}
														/>
														<span style={{
															fontSize: '15px',
															fontWeight: 600,
															color: noKnownAllergies ? '#166534' : '#374151'
														}}>
															{noKnownAllergies ? '✓ No Known Allergies' : 'No Known Allergies'}
														</span>
													</label>
													{/* Selected Allergies Display */}
													{allergies.length > 0 && (
														<div style={{ 
															display: 'flex', 
															flexWrap: 'wrap', 
															gap: 10, 
															marginBottom: 16 
														}}>
															{allergies.map((allergy, index) => (
																<div
																	key={index}
																	style={{
																		display: 'flex',
																		alignItems: 'center',
																		gap: 8,
																		padding: '8px 14px',
																		background: allergy.type === 'medicine' ? '#dbeafe' : '#fef3c7',
																		border: `2px solid ${allergy.type === 'medicine' ? '#60a5fa' : '#fbbf24'}`,
																		borderRadius: '24px',
																		fontSize: '13px',
																		fontWeight: 600,
																		color: allergy.type === 'medicine' ? '#1e40af' : '#92400e'
																	}}
																>
																	<span style={{ fontSize: '16px' }}>
																		{allergy.type === 'medicine' ? '💊' : '⚠️'}
																	</span>
																	<span>{allergy.type === 'medicine' ? allergy.medicineName : allergy.text}</span>
																	<button
																		type="button"
																		onClick={() => removeAllergy(index)}
																		style={{
																			background: 'transparent',
																			border: 'none',
																			cursor: 'pointer',
																			padding: 0,
																			marginLeft: 4,
																			fontSize: '18px',
																			fontWeight: 'bold',
																			color: 'inherit',
																			opacity: 0.7,
																			lineHeight: 1,
																			width: '20px',
																			height: '20px',
																			display: 'flex',
																			alignItems: 'center',
																			justifyContent: 'center'
																		}}
																		onMouseEnter={(e) => {
																			e.target.style.opacity = '1';
																			e.target.style.background = 'rgba(0, 0, 0, 0.1)';
																			e.target.style.borderRadius = '50%';
																		}}
																		onMouseLeave={(e) => {
																			e.target.style.opacity = '0.7';
																			e.target.style.background = 'transparent';
																		}}
																		title="Remove allergy"
																	>
																		×
																	</button>
																</div>
															))}
														</div>
													)}
													
													{/* Add Medicine Allergy */}
													<div style={{ position: 'relative', marginBottom: 12 }}>
														<input
															type="text"
															value={allergyMedQuery}
															onChange={e => {
																setAllergyMedQuery(e.target.value);
																setShowAllergyMedDropdown(true);
															}}
															onFocus={(e) => {
																setShowAllergyMedDropdown(true);
																e.target.style.borderColor = '#667eea';
															}}
															onBlur={(e) => {
																// Delay to allow click on dropdown item
																setTimeout(() => setShowAllergyMedDropdown(false), 200);
																e.target.style.borderColor = '#cbd5e1';
															}}
															placeholder="💊 Search medicine to add as allergy..."
															style={{
																width: '100%',
																padding: '12px 14px',
																fontSize: '15px',
																border: '1px solid #cbd5e1',
																borderRadius: '8px',
																background: 'white',
																transition: 'all 0.2s'
															}}
														/>
														{showAllergyMedDropdown && (
															<div style={{
																position: 'absolute',
																top: '100%',
																left: 0,
																right: 0,
																background: 'white',
																border: '1px solid #cbd5e1',
																borderRadius: '8px',
																boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
																zIndex: 1000,
																maxHeight: '250px',
																overflowY: 'auto',
																marginTop: '4px'
															}}>
																{getFilteredAllergyMedicines().length > 0 ? (
																	getFilteredAllergyMedicines().slice(0, 10).map(med => (
																		<button
																			type="button"
																			key={med.id}
																			onClick={() => addMedicineAllergy(med)}
																			style={{
																				width: '100%',
																				padding: '12px 16px',
																				textAlign: 'left',
																				border: 'none',
																				background: 'white',
																				cursor: 'pointer',
																				fontSize: '14px',
																				borderBottom: '1px solid #f3f4f6',
																				display: 'flex',
																				alignItems: 'center',
																				gap: 8
																			}}
																			onMouseEnter={(e) => {
																				e.target.style.background = '#f9fafb';
																				e.target.style.transform = 'translateX(2px)';
																			}}
																			onMouseLeave={(e) => {
																				e.target.style.background = 'white';
																				e.target.style.transform = 'translateX(0)';
																			}}
																		>
																			<span style={{ fontSize: '18px' }}>💊</span>
																			<span style={{ fontWeight: 500 }}>{med.name}</span>
																		</button>
																	))
																) : (
																	<div style={{ padding: '12px 16px', color: '#6b7280', fontSize: '14px' }}>
																		{allergyMedQuery.trim() ? 'No medicines found' : 'Start typing to search medicines...'}
																	</div>
																)}
															</div>
														)}
													</div>
													
													{/* Add Other Allergy */}
													<div style={{ display: 'flex', gap: 10 }}>
														<input
															type="text"
															value={allergyInput}
															onChange={e => setAllergyInput(e.target.value)}
															onKeyDown={e => {
																if (e.key === 'Enter') {
																	e.preventDefault();
																	addOtherAllergy(allergyInput);
																}
															}}
															placeholder="⚠️ Add other allergy (e.g., Peanuts, Latex, Pollen)..."
															style={{
																flex: 1,
																padding: '12px 14px',
																fontSize: '15px',
																border: '1px solid #cbd5e1',
																borderRadius: '8px',
																background: 'white',
																transition: 'all 0.2s'
															}}
															onFocus={(e) => e.target.style.borderColor = '#667eea'}
															onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
														/>
														<button
															type="button"
															onClick={() => addOtherAllergy(allergyInput)}
															disabled={!allergyInput.trim()}
															style={{
																padding: '12px 20px',
																background: allergyInput.trim() ? '#fbbf24' : '#e5e7eb',
																color: allergyInput.trim() ? '#78350f' : '#9ca3af',
																border: 'none',
																borderRadius: '8px',
																fontSize: '15px',
																fontWeight: 600,
																cursor: allergyInput.trim() ? 'pointer' : 'not-allowed',
																transition: 'all 0.2s',
																whiteSpace: 'nowrap'
															}}
															onMouseEnter={(e) => {
																if (allergyInput.trim()) {
																	e.target.style.transform = 'translateY(-1px)';
																	e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
																}
															}}
															onMouseLeave={(e) => {
																if (allergyInput.trim()) {
																	e.target.style.transform = 'translateY(0)';
																	e.target.style.boxShadow = 'none';
																}
															}}
														>
															Add
														</button>
													</div>
													
													{/* Info Message */}
													{allergies.length > 0 && (
														<div style={{
															marginTop: 12,
															padding: '10px 12px',
															background: '#fef2f2',
															border: '1px solid #fca5a5',
															borderRadius: '6px',
															fontSize: '12px',
															color: '#991b1b'
														}}>
															⚠️ <strong>Note:</strong> Medicines marked as allergies will be automatically excluded from prescription selection.
														</div>
													)}
												</div>
											</div>
										</div>
									</div>
								</>
							)}
							{/* Section 3: Visit Details - Visit-Specific */}
							<div style={{ 
								marginBottom: 32,
								padding: patientLookup ? '24px' : '20px',
								background: patientLookup ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)' : 'white',
								border: patientLookup ? '3px solid #3b82f6' : '1px solid #e2e8f0',
								borderRadius: '12px',
								boxShadow: patientLookup ? '0 4px 6px -1px rgba(59, 130, 246, 0.2)' : 'none'
							}}>
								<div style={{ 
									display: 'flex', 
									alignItems: 'center', 
									gap: 8, 
									marginBottom: 20,
									paddingBottom: 12,
									borderBottom: patientLookup ? '2px solid rgba(59, 130, 246, 0.3)' : '1px solid #e2e8f0'
								}}>
									<span style={{ fontSize: '20px' }}>📋</span>
									<h4 style={{ 
										margin: 0, 
										fontSize: '16px', 
										fontWeight: 600, 
										color: patientLookup ? '#1e40af' : '#1e293b'
									}}>
										Visit Details
									</h4>
									{patientLookup && (
										<span style={{ 
											marginLeft: 'auto',
											fontSize: '11px',
											padding: '4px 10px',
											background: '#3b82f6',
											borderRadius: '12px',
											color: 'white',
											fontWeight: 600,
											textTransform: 'uppercase',
											letterSpacing: '0.5px'
										}}>
											This Visit Only
										</span>
									)}
								</div>
								{patientLookup && (
									<div style={{ 
										marginBottom: 20,
										padding: '12px 16px',
										background: 'rgba(59, 130, 246, 0.1)',
										borderRadius: '8px',
										border: '1px solid rgba(59, 130, 246, 0.2)',
										display: 'flex',
										alignItems: 'center',
										gap: 8
									}}>
										<span style={{ fontSize: '16px' }}>📝</span>
										<span style={{ fontSize: '12px', color: '#1e40af', lineHeight: '1.5', fontWeight: 500 }}>
											This section is specific to today's visit. All information here will be saved with this visit record.
										</span>
									</div>
								)}

								{/* Visit-Specific Fields */}
								<div style={{ display: 'grid', gap: 16, marginBottom: 24 }}>
									<div className="form-field">
										<label htmlFor="presentingComplaint" style={{ 
											fontSize: '14px', 
											fontWeight: 600, 
											marginBottom: 8,
											color: patientLookup ? '#1e40af' : '#374151'
										}}>
											Presenting Complaint
										</label>
										<textarea
											id="presentingComplaint"
											value={presentingComplaint}
											onChange={e => setPresentingComplaint(e.target.value)}
											placeholder="Enter the patient's presenting complaint..."
											rows={3}
											style={{ 
												width: '100%', 
												padding: '12px 14px', 
												fontSize: '15px',
												fontFamily: 'inherit',
												resize: 'vertical',
												border: patientLookup ? '1px solid #3b82f6' : '1px solid #cbd5e1',
												borderRadius: '8px',
												boxSizing: 'border-box',
												lineHeight: '1.6',
												background: 'white'
											}}
										/>
									</div>

									<div className="form-field">
										<label htmlFor="examinationFindings" style={{ 
											fontSize: '14px', 
											fontWeight: 600, 
											marginBottom: 8,
											color: patientLookup ? '#1e40af' : '#374151'
										}}>
											Examination Findings
										</label>
										<textarea
											id="examinationFindings"
											value={examinationFindings}
											onChange={e => setExaminationFindings(e.target.value)}
											placeholder="Enter examination findings..."
											rows={3}
											style={{ 
												width: '100%', 
												padding: '12px 14px', 
												fontSize: '15px',
												fontFamily: 'inherit',
												resize: 'vertical',
												border: patientLookup ? '1px solid #3b82f6' : '1px solid #cbd5e1',
												borderRadius: '8px',
												boxSizing: 'border-box',
												lineHeight: '1.6',
												background: 'white'
											}}
										/>
									</div>

									{/* Investigations Results Section */}
									<div className="form-field">
										<label style={{ 
											display: 'flex', 
											alignItems: 'center', 
											gap: 10,
											fontSize: '14px', 
											fontWeight: 600, 
											marginBottom: 12,
											color: patientLookup ? '#1e40af' : '#374151',
											cursor: 'pointer'
										}}>
											<input
												type="checkbox"
												checked={showInvestigationHistory}
												onChange={e => setShowInvestigationHistory(e.target.checked)}
												style={{ 
													width: '18px', 
													height: '18px', 
													cursor: 'pointer',
													accentColor: patientLookup ? '#3b82f6' : '#667eea'
												}}
											/>
											<span>🔬 Investigations (Results/Notes)</span>
										</label>
										
										{showInvestigationHistory && (
											<>
												{/* Investigations Results Table - Grouped by Investigation Type */}
												{investigations.length > 0 && (() => {
													const groupedInvestigations = getGroupedInvestigations();
													return (
														<div style={{ 
															marginBottom: 16, 
															padding: 0,
															background: '#f8fafc',
															border: '1px solid #e2e8f0',
															borderRadius: '8px',
															overflow: 'hidden',
															boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
														}}>
															<div style={{ 
																display: 'grid', 
																gridTemplateColumns: '1fr 1.5fr 120px 60px',
																gap: '12px',
																padding: '14px 16px',
																borderBottom: '2px solid #e2e8f0',
																background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
																fontWeight: 600,
																fontSize: '13px',
																color: 'white'
															}}>
																<div>Investigation</div>
																<div>Latest Result</div>
																<div>Date</div>
																<div style={{ textAlign: 'center' }}>History</div>
															</div>
															<div style={{ maxHeight: '400px', overflowY: 'auto', background: 'white' }}>
																{groupedInvestigations.map((group, groupIdx) => {
																	const isExpanded = expandedInvestigation === group.key;
																	const latest = group.latestResult;
																	const hasMultiple = group.allResults.length > 1;
																	
																	return (
																		<div key={group.key} style={{ borderBottom: groupIdx < groupedInvestigations.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
																			{/* Main Row - Shows Latest Result */}
																			<div 
																				className="investigation-result-row"
																				style={{ 
																					display: 'grid', 
																					gridTemplateColumns: '1fr 1.5fr 120px 60px',
																					gap: '12px',
																					padding: '16px',
																					background: isExpanded ? '#f0f9ff' : 'white',
																					alignItems: 'center',
																					transition: 'all 0.2s',
																					cursor: hasMultiple ? 'pointer' : 'default'
																				}}
																				onClick={() => {
																					if (hasMultiple) {
																						setExpandedInvestigation(isExpanded ? null : group.key);
																					}
																				}}
																				onMouseEnter={(e) => {
																					if (hasMultiple) {
																						e.currentTarget.style.background = isExpanded ? '#e0f2fe' : '#f8fafc';
																						e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
																					}
																				}}
																				onMouseLeave={(e) => {
																					e.currentTarget.style.background = isExpanded ? '#f0f9ff' : 'white';
																					e.currentTarget.style.boxShadow = 'none';
																				}}
																			>
																				<div style={{ fontWeight: 500, color: '#1e293b', fontSize: '14px' }}>
																					{latest.investigationName || '-'}
																				</div>
																				<div style={{ color: '#475569', fontSize: '14px', wordBreak: 'break-word' }}>
																					{latest.result || '-'}
																				</div>
																				<div style={{ color: '#64748b', fontSize: '13px' }}>
																					{latest.date ? new Date(latest.date).toLocaleDateString() : '-'}
																				</div>
																				<div style={{ 
																					textAlign: 'center',
																					fontSize: '12px',
																					display: 'flex',
																					alignItems: 'center',
																					justifyContent: 'center',
																					gap: '4px'
																				}}>
																					{hasMultiple && (
																						<>
																							<span style={{ 
																								background: '#3b82f6',
																								color: 'white',
																								padding: '2px 8px',
																								borderRadius: '12px',
																								fontWeight: 600,
																								fontSize: '11px'
																							}}>
																								{group.allResults.length}
																							</span>
																							<span style={{ color: '#3b82f6', fontSize: '16px' }}>
																								{isExpanded ? '▼' : '▶'}
																							</span>
																						</>
																					)}
																					{!hasMultiple && (
																						<span style={{ color: '#94a3b8', fontStyle: 'italic' }}>-</span>
																					)}
																				</div>
																			</div>
																			
																			{/* Expanded History Section */}
																			{isExpanded && hasMultiple && (
																				<div style={{ 
																					background: '#f8fafc',
																					padding: '12px 16px',
																					borderTop: '1px solid #e2e8f0'
																				}}>
																					<div style={{ 
																						fontSize: '12px',
																						fontWeight: 600,
																						color: '#475569',
																						marginBottom: '8px',
																						display: 'flex',
																						alignItems: 'center',
																						gap: '6px'
																					}}>
																						<span>📋</span>
																						<span>Complete History ({group.allResults.length} records)</span>
																					</div>
																					<div style={{ 
																						display: 'flex',
																						flexDirection: 'column',
																						gap: '8px'
																					}}>
																						{group.allResults.map((result, idx) => (
																							<div 
																								key={`${result.investigationId}-${result.date}-${idx}`}
																								style={{ 
																									display: 'grid',
																									gridTemplateColumns: '120px 1fr auto',
																									gap: '12px',
																									padding: '10px 12px',
																									background: idx === 0 ? '#dbeafe' : 'white',
																									border: idx === 0 ? '2px solid #3b82f6' : '1px solid #e2e8f0',
																									borderRadius: '6px',
																									fontSize: '13px',
																									alignItems: 'center'
																								}}
																							>
																								<div style={{ 
																									fontWeight: 600,
																									color: idx === 0 ? '#1e40af' : '#64748b'
																								}}>
																									{result.date ? new Date(result.date).toLocaleDateString() : '-'}
																									{idx === 0 && <span style={{ marginLeft: '6px', color: '#3b82f6' }}>⭐ Latest</span>}
																								</div>
																								<div style={{ color: '#475569', wordBreak: 'break-word' }}>
																									{result.result || '-'}
																								</div>
																								{!result.isHistorical && (
																									<button 
																										type="button" 
																										onClick={(e) => {
																											e.stopPropagation();
																											const originalIdx = investigations.findIndex(inv => 
																												inv.investigationId === result.investigationId && 
																												inv.date === result.date &&
																												inv.result === result.result
																											);
																											if (originalIdx >= 0) {
																												removeInvestigationResult(originalIdx);
																											}
																										}} 
																										aria-label="Remove"
																										title="Remove this entry"
																										style={{ 
																											border: 'none', 
																											background: 'transparent', 
																											cursor: 'pointer', 
																											color: '#dc2626',
																											padding: '4px 8px',
																											fontSize: '18px',
																											lineHeight: 1,
																											borderRadius: '4px',
																											transition: 'all 0.2s'
																										}}
																										onMouseEnter={(e) => {
																											e.target.style.background = '#fee2e2';
																										}}
																										onMouseLeave={(e) => {
																											e.target.style.background = 'transparent';
																										}}
																									>
																										×
																									</button>
																								)}
																								{result.isHistorical && (
																									<span style={{ 
																										color: '#94a3b8',
																										fontSize: '11px',
																										fontStyle: 'italic'
																									}}>
																										History
																									</span>
																								)}
																							</div>
																						))}
																					</div>
																				</div>
																			)}
																		</div>
																	);
																})}
															</div>
														</div>
													);
												})()}
										
												{/* Add Investigation Result Input */}
												<div ref={investigationResultContainerRef} style={{ position: 'relative', marginTop: 16 }}>
											<div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 120px auto', gap: '8px', alignItems: 'end' }}>
												<div style={{ position: 'relative' }}>
													<input
														type="text"
														value={investigationInput}
														onChange={e => {
															setInvestigationInput(e.target.value);
															setShowInvestigationResultDropdown(true);
															setSelectedInvestigationForResult(null);
															// Auto-populate date if empty
															if (!investigationDateInput) {
																setInvestigationDateInput(new Date().toISOString().split('T')[0]);
															}
														}}
														onFocus={() => {
															setShowInvestigationResultDropdown(true);
															// Auto-populate date if empty when focusing
															if (!investigationDateInput) {
																setInvestigationDateInput(new Date().toISOString().split('T')[0]);
															}
														}}
														placeholder="🔍 Search investigation..."
														style={{ 
															width: '100%',
															padding: '12px 14px', 
															fontSize: '15px',
															border: '1px solid #bae6fd',
															borderRadius: '8px',
															boxSizing: 'border-box',
															background: 'white'
														}}
													/>
													{showInvestigationResultDropdown && investigationInput.trim() && (
														<div
															ref={investigationResultDropdownRef}
															style={{
																position: 'absolute',
																top: '100%',
																left: 0,
																right: 0,
																background: 'white',
																border: '1px solid #bae6fd',
																borderRadius: '8px',
																boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
																maxHeight: '200px',
																overflowY: 'auto',
																zIndex: 1000,
																marginTop: '4px'
															}}
														>
															{getFilteredInvestigationsForResults().length > 0 ? (
																getFilteredInvestigationsForResults().map(inv => (
																	<button
																		type="button"
																		key={inv.id}
																		onClick={() => selectInvestigationForResult(inv)}
																		style={{
																			width: '100%',
																			padding: '12px 16px',
																			textAlign: 'left',
																			border: 'none',
																			background: 'white',
																			cursor: 'pointer',
																			fontSize: '14px',
																			borderBottom: '1px solid #f1f5f9',
																			transition: 'background 0.2s',
																			display: 'flex',
																			flexDirection: 'column',
																			gap: '4px'
																		}}
																		onMouseEnter={(e) => e.target.style.background = '#f0f9ff'}
																		onMouseLeave={(e) => e.target.style.background = 'white'}
																	>
																		<span style={{ fontWeight: 600, color: '#1e293b' }}>
																			{inv.name}
																		</span>
																		{inv.category && (
																			<span style={{ fontSize: '12px', color: '#64748b' }}>
																				{inv.category}
																			</span>
																		)}
																	</button>
																))
															) : (
																<div style={{ padding: '16px', textAlign: 'center' }}>
																	<div style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '12px' }}>
																		🔍 No investigations found
																	</div>
																	{investigationInput.trim() && (
																		<button
																			type="button"
																			onClick={() => {
																				setShowCreateInvestigation(true);
																				setNewInvestigationName(investigationInput);
																			}}
																			style={{
																				padding: '10px 20px',
																				background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
																				color: 'white',
																				border: 'none',
																				borderRadius: '6px',
																				fontSize: '13px',
																				fontWeight: 600,
																				cursor: 'pointer',
																				transition: 'all 0.2s'
																			}}
																			onMouseEnter={(e) => e.target.style.transform = 'translateY(-1px)'}
																			onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
																		>
																			➕ Create New Investigation
																		</button>
																	)}
																</div>
															)}
														</div>
													)}
												</div>
												<input
													type="text"
													value={investigationResultInput}
													onChange={e => setInvestigationResultInput(e.target.value)}
													placeholder="Enter result..."
													style={{ 
														width: '100%',
														padding: '12px 14px', 
														fontSize: '15px',
														border: '1px solid #bae6fd',
														borderRadius: '8px',
														boxSizing: 'border-box',
														background: 'white'
													}}
												/>
												<input
													type="date"
													value={investigationDateInput}
													onChange={e => setInvestigationDateInput(e.target.value)}
													max={new Date().toISOString().split('T')[0]}
													style={{ 
														width: '100%',
														padding: '12px 14px', 
														fontSize: '15px',
														border: '1px solid #bae6fd',
														borderRadius: '8px',
														boxSizing: 'border-box',
														background: 'white'
													}}
												/>
												<button
													type="button"
													onClick={addInvestigationResult}
													disabled={!investigationInput.trim() || !investigationResultInput.trim() || !investigationDateInput.trim()}
													style={{
														padding: '12px 20px',
														background: (investigationInput.trim() && investigationResultInput.trim() && investigationDateInput.trim())
															? 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)'
															: '#cbd5e1',
														border: 'none',
														borderRadius: '8px',
														color: 'white',
														fontSize: '14px',
														fontWeight: 600,
														cursor: (investigationInput.trim() && investigationResultInput.trim() && investigationDateInput.trim()) ? 'pointer' : 'not-allowed',
														transition: 'all 0.2s',
														whiteSpace: 'nowrap'
													}}
												>
													Add
												</button>
											</div>
										</div>
											</>
										)}
									</div>

									{/* Investigations To Do Section */}
									<div style={{ 
										marginTop: 24,
										paddingTop: 24,
										borderTop: patientLookup ? '2px solid rgba(59, 130, 246, 0.3)' : '1px solid #e2e8f0'
									}}>
										<div className="form-field">
											<label style={{ 
												display: 'flex', 
												alignItems: 'center', 
												gap: 10,
												fontSize: '14px', 
												fontWeight: 600, 
												marginBottom: 12,
												color: patientLookup ? '#1e40af' : '#374151',
												cursor: 'pointer'
											}}>
												<input
													type="checkbox"
													checked={showInvestigationsToDo}
													onChange={e => {
														setShowInvestigationsToDo(e.target.checked);
														if (!e.target.checked) {
															setInvestigationsToDo([]);
															setInvestigationToDoInput('');
														}
													}}
													style={{ 
														width: '18px', 
														height: '18px', 
														cursor: 'pointer',
														accentColor: patientLookup ? '#3b82f6' : '#667eea'
													}}
												/>
												<span>🔬 Investigations To Do (For Next Visit)</span>
											</label>
											{showInvestigationsToDo && (
												<div style={{ 
													marginTop: 16, 
													padding: '16px', 
													background: '#f0f9ff', 
													border: '1px solid #bae6fd', 
													borderRadius: '8px' 
												}}>
													{/* Investigations Table */}
													{investigationsToDo.length > 0 && (
														<div style={{ 
															marginBottom: 16, 
															padding: 0,
															background: '#f8fafc',
															border: '1px solid #e2e8f0',
															borderRadius: '8px',
															overflow: 'hidden',
															boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
														}}>
															<div style={{ 
																display: 'grid', 
																gridTemplateColumns: '1fr 50px',
																gap: '12px',
																padding: '14px 16px',
																borderBottom: '2px solid #e2e8f0',
																background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
																fontWeight: 600,
																fontSize: '13px',
																color: 'white'
															}}>
																<div>Investigation</div>
																<div style={{ textAlign: 'center' }}>Action</div>
															</div>
															<div style={{ maxHeight: '200px', overflowY: 'auto', background: 'white' }}>
																{investigationsToDo.map((inv, idx) => (
																	<div 
																		key={idx}
																		className="investigations-table-row"
																		style={{ 
																			display: 'grid', 
																			gridTemplateColumns: '1fr 50px',
																			gap: '12px',
																			padding: '16px',
																			borderBottom: idx < investigationsToDo.length - 1 ? '1px solid #e2e8f0' : 'none',
																			background: 'white',
																			alignItems: 'center',
																			transition: 'all 0.2s'
																		}}
																		onMouseEnter={(e) => {
																			e.currentTarget.style.background = '#f8fafc';
																			e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
																		}}
																		onMouseLeave={(e) => {
																			e.currentTarget.style.background = 'white';
																			e.currentTarget.style.boxShadow = 'none';
																		}}
																	>
																		<div style={{ fontWeight: 500, color: '#1e293b', fontSize: '14px' }}>
																			{inv}
																		</div>
																		<button 
																			type="button" 
																			onClick={() => removeInvestigation(idx)} 
																			aria-label={`Remove ${inv}`} 
																			title="Remove"
																			style={{ 
																				border: 'none', 
																				background: 'transparent', 
																				cursor: 'pointer', 
																				color: '#dc2626',
																				padding: '6px',
																				fontSize: '22px',
																				lineHeight: 1,
																				width: '36px',
																				height: '36px',
																				display: 'flex',
																				alignItems: 'center',
																				justifyContent: 'center',
																				borderRadius: '8px',
																				transition: 'all 0.2s',
																				margin: '0 auto'
																			}}
																			onMouseEnter={(e) => {
																				e.target.style.background = '#fee2e2';
																				e.target.style.transform = 'scale(1.1)';
																			}}
																			onMouseLeave={(e) => {
																				e.target.style.background = 'transparent';
																				e.target.style.transform = 'scale(1)';
																			}}
																		>
																			×
																		</button>
																	</div>
																))}
															</div>
														</div>
													)}
													{/* Add Investigation Input with Searchable Dropdown */}
													<div ref={investigationContainerRef} style={{ position: 'relative' }}>
														<div style={{ display: 'flex', gap: '8px' }}>
															<input
																ref={investigationInputRef}
																type="text"
																value={investigationToDoInput}
																onChange={e => {
																	setInvestigationToDoInput(e.target.value);
																	setShowInvestigationDropdown(true);
																}}
																onFocus={() => setShowInvestigationDropdown(true)}
																onKeyDown={e => {
																	if (e.key === 'Enter') {
																		e.preventDefault();
																		const filtered = getFilteredInvestigations();
																		if (filtered.length > 0) {
																			addInvestigation(filtered[0].name);
																		} else if (investigationToDoInput.trim()) {
																			addInvestigation();
																		}
																	}
																}}
																placeholder="🔍 Search investigations (e.g., CBC, X-Ray Chest)..."
																style={{ 
																	flex: 1,
																	padding: '12px 14px', 
																	fontSize: '15px',
																	border: '1px solid #bae6fd',
																	borderRadius: '8px',
																	boxSizing: 'border-box',
																	background: 'white'
																}}
															/>
															<button
																type="button"
																onClick={() => {
																	const filtered = getFilteredInvestigations();
																	if (filtered.length > 0) {
																		addInvestigation(filtered[0].name);
																	} else if (investigationToDoInput.trim()) {
																		addInvestigation();
																	}
																}}
																disabled={!investigationToDoInput.trim()}
																style={{
																	padding: '12px 20px',
																	background: investigationToDoInput.trim() 
																		? 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)'
																		: '#cbd5e1',
																	border: 'none',
																	borderRadius: '8px',
																	color: 'white',
																	fontSize: '14px',
																	fontWeight: 600,
																	cursor: investigationToDoInput.trim() ? 'pointer' : 'not-allowed',
																	transition: 'all 0.2s'
																}}
															>
																Add
															</button>
														</div>
														{showInvestigationDropdown && investigationToDoInput.trim() && (
															<div
																ref={investigationDropdownRef}
																style={{
																	position: 'absolute',
																	top: '100%',
																	left: 0,
																	right: 0,
																	background: 'white',
																	border: '1px solid #bae6fd',
																	borderRadius: '8px',
																	boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
																	maxHeight: '200px',
																	overflowY: 'auto',
																	zIndex: 1000,
																	marginTop: '4px'
																}}
															>
																{getFilteredInvestigations().length > 0 ? (
																	getFilteredInvestigations().map(inv => (
																		<button
																			type="button"
																			key={inv.id}
																			onClick={() => addInvestigation(inv.name)}
																			style={{
																				width: '100%',
																				padding: '12px 16px',
																				textAlign: 'left',
																				border: 'none',
																				background: 'white',
																				cursor: 'pointer',
																				fontSize: '14px',
																				borderBottom: '1px solid #f1f5f9',
																				transition: 'background 0.2s',
																				display: 'flex',
																				flexDirection: 'column',
																				gap: '4px'
																			}}
																			onMouseEnter={(e) => e.target.style.background = '#f0f9ff'}
																			onMouseLeave={(e) => e.target.style.background = 'white'}
																		>
																			<span style={{ fontWeight: 600, color: '#1e293b' }}>
																				{inv.name}
																			</span>
																			{inv.category && (
																				<span style={{ fontSize: '12px', color: '#64748b' }}>
																					{inv.category}
																				</span>
																			)}
																		</button>
																	))
																) : (
																	<div style={{ padding: '16px', textAlign: 'center' }}>
																		<div style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '12px' }}>
																			🔍 No investigations found
																		</div>
																		<button
																			type="button"
																			onClick={() => {
																				setShowCreateInvestigation(true);
																				setNewInvestigationName(investigationToDoInput);
																				setShowInvestigationDropdown(false);
																			}}
																			style={{
																				padding: '10px 20px',
																				background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
																				color: 'white',
																				border: 'none',
																				borderRadius: '6px',
																				fontSize: '13px',
																				fontWeight: 600,
																				cursor: 'pointer',
																				transition: 'all 0.2s'
																			}}
																			onMouseEnter={(e) => e.target.style.transform = 'translateY(-1px)'}
																			onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
																		>
																			➕ Create New Investigation
																		</button>
																	</div>
																)}
															</div>
														)}
													</div>
												</div>
											)}
										</div>
									</div>

									<div className="form-field">
										<label htmlFor="doctorsNotes" style={{ 
											fontSize: '14px', 
											fontWeight: 600, 
											marginBottom: 8,
											color: patientLookup ? '#1e40af' : '#374151'
										}}>
											Doctor's Notes
										</label>
										<textarea
											id="doctorsNotes"
											value={doctorsNotes}
											onChange={e => setDoctorsNotes(e.target.value)}
											placeholder="Enter doctor's notes for this visit..."
											rows={3}
											style={{ 
												width: '100%', 
												padding: '12px 14px', 
												fontSize: '15px',
												fontFamily: 'inherit',
												resize: 'vertical',
												border: patientLookup ? '1px solid #3b82f6' : '1px solid #cbd5e1',
												borderRadius: '8px',
												boxSizing: 'border-box',
												lineHeight: '1.6',
												background: 'white'
											}}
										/>
									</div>
								</div>

								{/* Prescription Medicines Section */}
								<div style={{ 
									marginTop: 24,
									paddingTop: 24,
									borderTop: patientLookup ? '2px solid rgba(59, 130, 246, 0.3)' : '1px solid #e2e8f0'
								}}>
									<div style={{ 
										display: 'flex', 
										alignItems: 'center', 
										gap: 8, 
										marginBottom: 16
									}}>
										<span style={{ fontSize: '18px' }}>💊</span>
										<h5 style={{ 
											margin: 0, 
											fontSize: '15px', 
											fontWeight: 600, 
											color: patientLookup ? '#1e40af' : '#1e293b'
										}}>
											Prescription Medicines
										</h5>
									</div>

									{/* Show message when medicines are auto-populated from previous visit */}
									{patientLookup && patientLookup.visits && patientLookup.visits.length > 0 && 
									 patientLookup.visits[0].prescriptions && patientLookup.visits[0].prescriptions.length > 0 &&
									 selectedMedicines.length > 0 && (
										<div style={{ 
											marginBottom: 16,
											padding: '12px 16px',
											background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
											borderRadius: '8px',
											border: '1px solid #93c5fd',
											display: 'flex',
											alignItems: 'center',
											gap: 8
										}}>
											<span style={{ fontSize: '16px' }}>ℹ️</span>
											<span style={{ fontSize: '13px', color: '#1e40af', lineHeight: '1.5' }}>
												Medicines from the most recent visit have been pre-filled. You can modify dosages, add new medicines, or remove them as needed.
											</span>
										</div>
									)}

								<div className="form-field" ref={medicineContainerRef} style={{ marginBottom: 0 }}>
									<label htmlFor="prescriptions" style={{ 
										fontSize: '14px', 
										fontWeight: 600, 
										marginBottom: 12,
										color: '#374151',
										display: 'block'
									}}>
										Search and select medicines
									</label>
								
									{/* Selected medicines table */}
									{selectedMedicines.length > 0 && (
										<div style={{ 
											marginBottom: 16, 
											padding: 0,
											background: '#f8fafc',
											border: '1px solid #e2e8f0',
											borderRadius: '8px',
											overflow: 'hidden',
											boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
										}}>
											<div className="medicine-table-header" style={{ 
												display: 'grid', 
												gridTemplateColumns: '1fr 180px 120px 50px',
												gap: '12px',
												padding: '14px 16px',
												borderBottom: '2px solid #e2e8f0',
												background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
												fontWeight: 600,
												fontSize: '13px',
												color: 'white'
											}}>
												<div>Medicine & Brand</div>
												<div>Dosage</div>
												<div>Duration</div>
												<div style={{ textAlign: 'center' }}>Action</div>
											</div>
											<div style={{ maxHeight: '320px', overflowY: 'auto', background: 'white' }}>
												{selectedMedicines.map((selectedMed, idx) => {
													const med = medicines.find(m => m.id === selectedMed.id);
													if (!med) return null;
													return (
														<div 
															key={selectedMed.uniqueKey}
															className="medicine-table-row"
															style={{ 
																display: 'grid', 
																gridTemplateColumns: '1fr 180px 120px 50px',
																gap: '12px',
																padding: '16px',
																borderBottom: idx < selectedMedicines.length - 1 ? '1px solid #e2e8f0' : 'none',
																background: 'white',
																alignItems: 'center',
																transition: 'all 0.2s'
															}}
															onMouseEnter={(e) => {
																e.currentTarget.style.background = '#f8fafc';
																e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
															}}
															onMouseLeave={(e) => {
																e.currentTarget.style.background = 'white';
																e.currentTarget.style.boxShadow = 'none';
															}}
														>
															<div>
																<div style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px', marginBottom: 4 }}>
																	{med.name}
																</div>
																{selectedMed.brand && (
																	<div style={{ fontSize: '12px', color: '#667eea', fontWeight: 500 }}>
																		Brand: {selectedMed.brand}
																	</div>
																)}
															</div>
															<input
																type="text"
																value={selectedMed.dosage || ''}
																onChange={e => updateMedicineDosage(selectedMed.uniqueKey, e.target.value)}
																placeholder="e.g., 500mg BD"
																style={{
																	padding: '10px 12px',
																	border: '1px solid #cbd5e1',
																	borderRadius: '6px',
																	fontSize: '14px',
																	width: '100%',
																	boxSizing: 'border-box',
																	transition: 'border-color 0.2s'
																}}
																onFocus={(e) => e.target.style.borderColor = '#667eea'}
																onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
															/>
															<div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
																<input
																	type={selectedMed.durationUnit === 'sos' ? 'text' : 'number'}
																	min={selectedMed.durationUnit === 'sos' ? undefined : '0'}
																	value={selectedMed.duration || ''}
																	onChange={e => updateMedicineDuration(selectedMed.uniqueKey, e.target.value)}
																	placeholder={selectedMed.durationUnit === 'sos' ? 'e.g., 6 hrly' : 'e.g., 2'}
																	style={{
																		padding: '10px 8px',
																		border: '1px solid #cbd5e1',
																		borderRadius: '6px',
																		fontSize: '14px',
																		width: '60px',
																		boxSizing: 'border-box',
																		transition: 'border-color 0.2s'
																	}}
																	onFocus={(e) => e.target.style.borderColor = '#667eea'}
																	onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
																/>
																<select
																	value={selectedMed.durationUnit || 'weeks'}
																	onChange={e => updateMedicineDurationUnit(selectedMed.uniqueKey, e.target.value)}
																	style={{
																		padding: '10px 6px',
																		border: '1px solid #cbd5e1',
																		borderRadius: '6px',
																		fontSize: '13px',
																		width: '56px',
																		boxSizing: 'border-box',
																		cursor: 'pointer',
																		background: 'white',
																		transition: 'border-color 0.2s'
																	}}
																	onFocus={(e) => e.target.style.borderColor = '#667eea'}
																	onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
																>
																	<option value="weeks">Wks</option>
																	<option value="days">Days</option>
																	<option value="months">Mths</option>
																	<option value="sos">SOS</option>
																</select>
															</div>
															<button 
																type="button" 
																onClick={() => removeSelected(selectedMed.uniqueKey)} 
																aria-label={`Remove ${med.name}`} 
																title="Remove"
																style={{ 
																	border: 'none', 
																	background: 'transparent', 
																	cursor: 'pointer', 
																	color: '#dc2626',
																	padding: '6px',
																	fontSize: '22px',
																	lineHeight: 1,
																	width: '36px',
																	height: '36px',
																	display: 'flex',
																	alignItems: 'center',
																	justifyContent: 'center',
																	borderRadius: '8px',
																	transition: 'all 0.2s',
																	margin: '0 auto'
																}}
																onMouseEnter={(e) => {
																	e.target.style.background = '#fee2e2';
																	e.target.style.transform = 'scale(1.1)';
																}}
																onMouseLeave={(e) => {
																	e.target.style.background = 'transparent';
																	e.target.style.transform = 'scale(1)';
																}}
															>
																×
															</button>
														</div>
													);
												})}
											</div>
										</div>
									)}
									{/* Search input */}
									<input
										id="prescriptions"
										ref={medicineInputRef}
										aria-label="Search medicines"
										placeholder="🔍 Type to search medicines..."
										value={medQuery}
										onChange={e => setMedQuery(e.target.value)}
										onClick={() => {
											// Always open dropdown on click
											setSuggestionsOpen(true);
											setDropdownHasMouse(false);
										}}
										onFocus={(e) => {
											setSuggestionsOpen(true);
											setDropdownHasMouse(false);
											e.target.style.borderColor = '#667eea';
											e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
										}}
										onBlur={(e) => {
											// Delay closing to allow clicking on dropdown items or focusing inputs inside dropdown
											setTimeout(() => {
												// Check if the newly focused element is inside the dropdown
												const isInsideDropdown = medicineDropdownRef.current && 
													medicineDropdownRef.current.contains(document.activeElement);
												if (!dropdownHasMouse && 
													document.activeElement !== medicineInputRef.current && 
													!isInsideDropdown) {
													setSuggestionsOpen(false);
												}
											}, 150);
											e.target.style.borderColor = '#e2e8f0';
											e.target.style.boxShadow = 'none';
										}}
										style={{ 
											width: '100%', 
											padding: '14px 16px', 
											fontSize: '15px',
											border: '2px solid #e2e8f0',
											borderRadius: '8px',
											transition: 'all 0.2s'
										}}
									/>
									{/* Dropdown suggestions */}
									{suggestionsOpen && (
										<div 
											ref={medicineDropdownRef}
											style={{ 
												marginTop: 8, 
												padding: 0, 
												maxHeight: '300px', 
												overflowY: 'auto', 
												position: 'relative', 
												zIndex: 10,
												background: 'white',
												border: '1px solid #e2e8f0',
												borderRadius: '8px',
												boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
											}}
											onMouseEnter={() => setDropdownHasMouse(true)}
											onMouseLeave={() => setDropdownHasMouse(false)}
											onMouseDown={(e) => {
												// Prevent input blur when clicking dropdown
												e.preventDefault();
												setSuggestionsOpen(true);
											}}
										>
											<div style={{ padding: '8px' }}>
												{getFilteredMedicines().slice(0, 10).map(m => {
													const isExpanded = expandedMedicines.has(m.id);
													const brands = m.brands || [];
													const customBrand = customBrandInputs[m.id] || '';
													return (
														<div
															key={m.id}
															style={{
																marginBottom: '8px',
																border: '1px solid #e2e8f0',
																borderRadius: '8px',
																overflow: 'hidden',
																background: 'white',
																transition: 'all 0.2s'
															}}
															onMouseEnter={(e) => {
																e.currentTarget.style.borderColor = '#c7d2fe';
																e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
															}}
															onMouseLeave={(e) => {
																e.currentTarget.style.borderColor = '#e2e8f0';
																e.currentTarget.style.boxShadow = 'none';
															}}
														>
															{/* Medicine header - clickable to expand */}
															<div
																onClick={() => toggleMedicineExpand(m.id)}
																style={{
																	padding: '14px 16px',
																	cursor: 'pointer',
																	display: 'flex',
																	alignItems: 'center',
																	justifyContent: 'space-between',
																	background: isExpanded ? '#f0f4ff' : '#f8fafc',
																	transition: 'background 0.2s'
																}}
															>
																<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
																	<span style={{ fontSize: '18px' }}>💊</span>
																	<span style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px' }}>
																		{m.name}
																	</span>
																	{brands.length > 0 && (
																		<span style={{ 
																			fontSize: '11px', 
																			color: '#64748b',
																			background: '#e2e8f0',
																			padding: '2px 8px',
																			borderRadius: '12px'
																		}}>
																			{brands.length} brands
																		</span>
																	)}
																</div>
																<span style={{ 
																	fontSize: '14px',
																	color: '#667eea',
																	transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
																	transition: 'transform 0.2s'
																}}>
																	▼
																</span>
															</div>
															
															{/* Expanded content - Brand selection */}
															{isExpanded && (
																<div 
																	onClick={(e) => e.stopPropagation()}
																	onMouseDown={(e) => e.stopPropagation()}
																	style={{ 
																		padding: '16px',
																		background: 'white',
																		borderTop: '1px solid #e2e8f0'
																	}}
																>
																	<div style={{ marginBottom: 12, fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
																		Select Brand:
																	</div>
																	{brands.length > 0 && (
																		<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
																			{brands.map((brand, idx) => (
																				<button
																					key={idx}
																					type="button"
																					onClick={(e) => {
																						e.stopPropagation();
																						addMedicineWithBrand(m.id, brand);
																					}}
																					style={{
																						padding: '8px 14px',
																						border: '1px solid #c7d2fe',
																						borderRadius: '6px',
																						background: '#f0f4ff',
																						color: '#667eea',
																						fontSize: '13px',
																						fontWeight: 500,
																						cursor: 'pointer',
																						transition: 'all 0.2s'
																					}}
																					onMouseEnter={(e) => {
																						e.target.style.background = '#667eea';
																						e.target.style.color = 'white';
																						e.target.style.borderColor = '#667eea';
																					}}
																					onMouseLeave={(e) => {
																						e.target.style.background = '#f0f4ff';
																						e.target.style.color = '#667eea';
																						e.target.style.borderColor = '#c7d2fe';
																					}}
																				>
																					{brand}
																				</button>
																			))}
																		</div>
																	)}
																	
																	{/* Custom brand input */}
																	<div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
																		<div style={{ fontSize: '11px', color: '#64748b', marginBottom: 4 }}>
																			Add new brand:
																		</div>
																		<div style={{ display: 'flex', gap: 8 }}>
																			<input
																				type="text"
																				value={customBrand}
																				onChange={(e) => {
																					e.stopPropagation();
																					setCustomBrandInputs({ ...customBrandInputs, [m.id]: e.target.value });
																				}}
																				onClick={(e) => e.stopPropagation()}
																				onFocus={(e) => e.stopPropagation()}
																				onMouseDown={(e) => e.stopPropagation()}
																				placeholder="Enter brand name..."
																				style={{
																					flex: 1,
																					padding: '10px 12px',
																					border: '1px solid #cbd5e1',
																					borderRadius: '6px',
																					fontSize: '13px'
																				}}
																			/>
																			<button
																				type="button"
																				onClick={(e) => {
																					e.stopPropagation();
																					if (customBrand.trim()) {
																						addMedicineWithBrand(m.id, customBrand.trim());
																					}
																				}}
																				disabled={!customBrand.trim() || addingBrandToMedicineId === m.id}
																				style={{
																					padding: '10px 16px',
																					border: 'none',
																					borderRadius: '6px',
																					background: customBrand.trim() && addingBrandToMedicineId !== m.id ? '#667eea' : '#cbd5e1',
																					color: 'white',
																					fontSize: '13px',
																					fontWeight: 600,
																					cursor: customBrand.trim() && addingBrandToMedicineId !== m.id ? 'pointer' : 'not-allowed',
																					transition: 'all 0.2s',
																					whiteSpace: 'nowrap'
																				}}
																			>
																				Use Once
																			</button>
																			<button
																				type="button"
																				onClick={(e) => {
																					e.stopPropagation();
																					if (customBrand.trim()) {
																						handleAddBrandToMedicine(m.id, customBrand.trim());
																					}
																				}}
																				disabled={!customBrand.trim() || addingBrandToMedicineId === m.id}
																				style={{
																					padding: '10px 16px',
																					border: 'none',
																					borderRadius: '6px',
																					background: customBrand.trim() && addingBrandToMedicineId !== m.id ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#cbd5e1',
																					color: 'white',
																					fontSize: '13px',
																					fontWeight: 600,
																					cursor: customBrand.trim() && addingBrandToMedicineId !== m.id ? 'pointer' : 'not-allowed',
																					transition: 'all 0.2s',
																					whiteSpace: 'nowrap'
																				}}
																			>
																				{addingBrandToMedicineId === m.id ? 'Saving...' : 'Save Brand'}
																			</button>
																		</div>
																	</div>
																</div>
															)}
														</div>
													);
											})}
											{getFilteredMedicines().length === 0 && (
												<div style={{ 
													padding: '16px', 
													textAlign: 'center'
												}}>
													<div style={{ 
														color: '#94a3b8',
														fontSize: '14px',
														marginBottom: '12px'
													}}>
														🔍 No medicines found matching your search
													</div>
													{medQuery.trim() && (
														<button
															type="button"
															onClick={() => {
																setShowCreateMedicine(true);
																setNewMedicineName(medQuery);
															}}
															style={{
																padding: '10px 20px',
																background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
																color: 'white',
																border: 'none',
																borderRadius: '6px',
																fontSize: '13px',
																fontWeight: 600,
																cursor: 'pointer',
																transition: 'all 0.2s'
															}}
															onMouseEnter={(e) => e.target.style.transform = 'translateY(-1px)'}
															onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
														>
															➕ Create New Medicine
														</button>
													)}
												</div>
											)}
										</div>
									</div>
								)}
							</div>
							</div>								{/* Referral Letter Section */}
								<div style={{ 
									marginTop: 24,
									paddingTop: 24,
									borderTop: patientLookup ? '2px solid rgba(59, 130, 246, 0.3)' : '1px solid #e2e8f0'
								}}>
									<div className="form-field">
										<label style={{ 
											display: 'flex', 
											alignItems: 'center', 
											gap: 10,
											fontSize: '14px', 
											fontWeight: 600, 
											marginBottom: 12,
											color: patientLookup ? '#1e40af' : '#374151',
											cursor: 'pointer'
										}}>
											<input
												type="checkbox"
												checked={generateReferralLetter}
												onChange={e => {
													setGenerateReferralLetter(e.target.checked);
													if (!e.target.checked) {
														setReferralDoctorName('');
														setReferralLetterBody('');
													}
												}}
												style={{ 
													width: '18px', 
													height: '18px', 
													cursor: 'pointer',
													accentColor: patientLookup ? '#3b82f6' : '#667eea'
												}}
											/>
											<span>Generate Referral Letter</span>
										</label>
										{generateReferralLetter && (
											<div style={{ 
												marginTop: 16, 
												padding: '16px', 
												background: '#f0f4ff', 
												border: '1px solid #c7d2fe', 
												borderRadius: '8px' 
											}}>
												<div className="form-field" style={{ marginBottom: 16 }}>
													<label htmlFor="referralDoctorName" style={{ 
														fontSize: '13px', 
														fontWeight: 600, 
														marginBottom: 8,
														color: '#1e40af'
													}}>
														Referral Doctor's Name / Specialty
													</label>
													<input
														id="referralDoctorName"
														type="text"
														value={referralDoctorName}
														onChange={e => setReferralDoctorName(e.target.value)}
														placeholder="e.g., Chiropractor / Physiotherapist"
														style={{ 
															width: '100%', 
															padding: '12px 14px', 
															fontSize: '15px',
															border: '1px solid #c7d2fe',
															borderRadius: '8px',
															boxSizing: 'border-box',
															background: 'white'
														}}
													/>
												</div>
												<div className="form-field">
													<label htmlFor="referralLetterBody" style={{ 
														fontSize: '13px', 
														fontWeight: 600, 
														marginBottom: 8,
														color: '#1e40af'
													}}>
														Referral Letter Body (Customizable)
													</label>
													<textarea
														id="referralLetterBody"
														value={referralLetterBody}
														onChange={e => setReferralLetterBody(e.target.value)}
														placeholder="Enter the referral letter content. Patient name, age, gender, and date will be automatically included."
														rows={6}
														style={{ 
															width: '100%', 
															padding: '12px 14px', 
															fontSize: '15px',
															fontFamily: 'inherit',
															resize: 'vertical',
															border: '1px solid #c7d2fe',
															borderRadius: '8px',
															boxSizing: 'border-box',
															lineHeight: '1.6',
															background: 'white'
														}}
													/>
													<div style={{ 
														marginTop: 8, 
														fontSize: '12px', 
														color: '#64748b',
														fontStyle: 'italic'
													}}>
														💡 Tip: You can customize the letter body. Patient details (name, age, gender, date) will be automatically added.
													</div>
												</div>
											</div>
										)}
									</div>
								</div>
							</div>
							{error && (
								<div style={{ 
									color: '#dc2626', 
									marginBottom: 20, 
									padding: '14px 16px', 
									background: '#fee2e2', 
									borderRadius: '8px',
									fontSize: '14px',
									border: '1px solid #fecaca',
									display: 'flex',
									alignItems: 'center',
									gap: 8
								}}>
									<span style={{ fontSize: '18px' }}>⚠️</span>
									<span>{error}</span>
								</div>
							)}
							
							{/* Submit Button */}
							<button 
								className="primary" 
								type="submit" 
								disabled={saving} 
								style={{ 
									width: '100%', 
									padding: '16px',
									fontSize: '16px',
									fontWeight: 600,
									borderRadius: '10px',
									marginTop: 8,
									background: saving ? '#94a3b8' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
									border: 'none',
									color: 'white',
									cursor: saving ? 'not-allowed' : 'pointer',
									boxShadow: saving ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
									transition: 'all 0.2s',
									display: 'flex',
									alignItems: 'center',
									justifyContent: 'center',
									gap: 8
								}}
								onMouseEnter={(e) => {
									if (!saving) {
										e.target.style.transform = 'translateY(-1px)';
										e.target.style.boxShadow = '0 6px 8px -1px rgba(0, 0, 0, 0.15)';
									}
								}}
								onMouseLeave={(e) => {
									if (!saving) {
										e.target.style.transform = 'translateY(0)';
										e.target.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
									}
								}}
							>
								{saving ? (
									<>
										<span>⏳</span>
										<span>Saving Visit...</span>
									</>
								) : (
									<>
										<span>💾</span>
										<span>Save Visit</span>
									</>
								)}
							</button>
						</form>

						{/* Create Medicine Modal */}
						{showCreateMedicine && (
							<div style={{
								position: 'fixed',
								top: 0,
								left: 0,
								right: 0,
								bottom: 0,
								background: 'rgba(0, 0, 0, 0.5)',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								zIndex: 10000
							}}>
								<div style={{
									background: 'white',
									padding: '24px',
									borderRadius: '12px',
									boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
									minWidth: '400px',
									maxWidth: '90%'
								}}>
									<h3 style={{ marginTop: 0, marginBottom: 20, color: '#1e293b', fontSize: '18px' }}>Create New Medicine</h3>
									<div style={{ marginBottom: 16 }}>
										<label style={{ display: 'block', marginBottom: 8, fontSize: '14px', fontWeight: 600, color: '#475569' }}>
											Medicine Name *
										</label>
										<input
											type="text"
											value={newMedicineName}
											onChange={(e) => setNewMedicineName(e.target.value)}
											placeholder="Enter medicine name..."
											style={{
												width: '100%',
												padding: '10px 12px',
												border: '1px solid #cbd5e1',
												borderRadius: '6px',
												fontSize: '14px',
												boxSizing: 'border-box'
											}}
										/>
									</div>
									<div style={{ marginBottom: 20 }}>
										<label style={{ display: 'block', marginBottom: 8, fontSize: '14px', fontWeight: 600, color: '#475569' }}>
											Brands (comma-separated, optional)
										</label>
										<input
											type="text"
											value={newMedicineBrands}
											onChange={(e) => setNewMedicineBrands(e.target.value)}
											placeholder="e.g., Panadol, Tylenol, Calpol"
											style={{
												width: '100%',
												padding: '10px 12px',
												border: '1px solid #cbd5e1',
												borderRadius: '6px',
												fontSize: '14px',
												boxSizing: 'border-box'
											}}
										/>
									</div>
									<div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
										<button
											type="button"
											onClick={() => {
												setShowCreateMedicine(false);
												setNewMedicineName('');
												setNewMedicineBrands('');
											}}
											disabled={creatingMedicine}
											style={{
												padding: '10px 20px',
												border: '1px solid #cbd5e1',
												background: 'white',
												color: '#64748b',
												borderRadius: '6px',
												fontSize: '14px',
												fontWeight: 600,
												cursor: creatingMedicine ? 'not-allowed' : 'pointer'
											}}
										>
											Cancel
										</button>
										<button
											type="button"
											onClick={handleCreateMedicine}
											disabled={!newMedicineName.trim() || creatingMedicine}
											style={{
												padding: '10px 20px',
												background: newMedicineName.trim() && !creatingMedicine 
													? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
													: '#cbd5e1',
												border: 'none',
												color: 'white',
												borderRadius: '6px',
												fontSize: '14px',
												fontWeight: 600,
												cursor: newMedicineName.trim() && !creatingMedicine ? 'pointer' : 'not-allowed'
											}}
										>
											{creatingMedicine ? 'Creating...' : 'Create Medicine'}
										</button>
									</div>
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Create Investigation Modal */}
			{showCreateInvestigation && (
				<div style={{
					position: 'fixed',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background: 'rgba(0, 0, 0, 0.5)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: 10000
				}}>
					<div style={{
						background: 'white',
						padding: '24px',
						borderRadius: '12px',
						boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
						minWidth: '400px',
						maxWidth: '90%'
					}}>
						<h3 style={{ marginTop: 0, marginBottom: 20, color: '#1e293b', fontSize: '18px' }}>Create New Investigation</h3>
						<div style={{ marginBottom: 16 }}>
							<label style={{ display: 'block', marginBottom: 8, fontSize: '14px', fontWeight: 600, color: '#475569' }}>
								Investigation Name *
							</label>
							<input
								type="text"
								value={newInvestigationName}
								onChange={(e) => setNewInvestigationName(e.target.value)}
								placeholder="Enter investigation name..."
								style={{
									width: '100%',
									padding: '10px 12px',
									border: '1px solid #cbd5e1',
									borderRadius: '6px',
									fontSize: '14px',
									boxSizing: 'border-box'
								}}
							/>
						</div>
						<div style={{ marginBottom: 20 }}>
							<label style={{ display: 'block', marginBottom: 8, fontSize: '14px', fontWeight: 600, color: '#475569' }}>
								Category (optional)
							</label>
							<input
								type="text"
								value={newInvestigationCategory}
								onChange={(e) => setNewInvestigationCategory(e.target.value)}
								placeholder="e.g., Hematology, Radiology"
								style={{
									width: '100%',
									padding: '10px 12px',
									border: '1px solid #cbd5e1',
									borderRadius: '6px',
									fontSize: '14px',
									boxSizing: 'border-box'
								}}
							/>
						</div>
						<div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
							<button
								type="button"
								onClick={() => {
									setShowCreateInvestigation(false);
									setNewInvestigationName('');
									setNewInvestigationCategory('');
								}}
								disabled={creatingInvestigation}
								style={{
									padding: '10px 20px',
									border: '1px solid #cbd5e1',
									background: 'white',
									color: '#64748b',
									borderRadius: '6px',
									fontSize: '14px',
									fontWeight: 600,
									cursor: creatingInvestigation ? 'not-allowed' : 'pointer'
								}}
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleCreateInvestigation}
								disabled={!newInvestigationName.trim() || creatingInvestigation}
								style={{
									padding: '10px 20px',
									background: newInvestigationName.trim() && !creatingInvestigation 
										? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
										: '#cbd5e1',
									border: 'none',
									color: 'white',
									borderRadius: '6px',
									fontSize: '14px',
									fontWeight: 600,
									cursor: newInvestigationName.trim() && !creatingInvestigation ? 'pointer' : 'not-allowed'
								}}
							>
								{creatingInvestigation ? 'Creating...' : 'Create Investigation'}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Prescription modal for newly added visit */}
			<PrescriptionModal
				open={showModal && !!lastVisit && !!lastPatient}
				onClose={() => setShowModal(false)}
				doctorName={user?.name || user?.username}
				patient={lastPatient || { nic, name, age }}
				visit={{ 
					date: lastVisit?.date,
					presentingComplaint: lastVisit?.presentingComplaint || '',
					examinationFindings: lastVisit?.examinationFindings || '',
					investigations: lastVisit?.investigations || '',
					investigationsToDo: lastVisit?.investigationsToDo || []
				}}
				medicines={lastVisit?.medicines || []}
				notes={lastVisit?.notes || ''}
			/>

			{/* Prescription modal for history visits */}
			<PrescriptionModal
				open={historyModalOpen && !!historyModalData}
				onClose={() => setHistoryModalOpen(false)}
				doctorName={historyModalData?.doctorName}
				patient={historyModalData?.patient}
				visit={historyModalData?.visit}
				medicines={historyModalData?.medicines || []}
				notes={historyModalData?.notes || ''}
			/>

			{/* Referral Letter modal */}
			<ReferralLetterModal
				open={referralModalOpen && !!referralModalData}
				onClose={() => setReferralModalOpen(false)}
				doctorName={referralModalData?.doctorName}
				patient={referralModalData?.patient}
				visit={referralModalData?.visit}
				referralDoctorName={referralModalData?.referralDoctorName}
				referralLetterBody={referralModalData?.referralLetterBody}
			/>
		</div>
)
}

