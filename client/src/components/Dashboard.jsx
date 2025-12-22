import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { apiGetMedicines, apiGetInvestigations, apiLogout } from '../api.js';
import AddVisitForm from './visits/AddVisitForm.jsx';

export default function Dashboard() {
	const { token, user, setToken, setUser } = useAuth();
	const [medicines, setMedicines] = useState([]);
	const [investigations, setInvestigations] = useState([]);
	const [loading, setLoading] = useState(true);
	const [err, setErr] = useState('');

	useEffect(() => {
		let isMounted = true;
		(async () => {
			try {
				const [meds, invs] = await Promise.all([
					apiGetMedicines(token),
					apiGetInvestigations(token)
				]);
				if (isMounted) {
					setMedicines(meds);
					setInvestigations(invs);
				}
			} catch (e) {
				if (isMounted) setErr('Failed to load data');
			} finally {
				if (isMounted) setLoading(false);
			}
		})();
		return () => { isMounted = false; };
	}, [token]);

	async function onLogout() {
		try {
			await apiLogout(token);
		} catch {}
		setToken('');
		setUser(null);
	}

	return (
		<div style={{ width: '100%' }}>
			<div className="header" style={{ marginBottom: 24 }}>
				<div>
					<h2 style={{ marginBottom: 4 }}>Welcome, Dr. {user?.name || user?.username}</h2>
					<p className="muted">Enter patient NIC to start</p>
				</div>
				<div>
					<button onClick={onLogout}>Logout</button>
				</div>
			</div>

			{loading ? (
				<div className="card">Loading data…</div>
			) : err ? (
				<div className="card" style={{ color: 'crimson' }}>{err}</div>
			) : (
				<div className="card" style={{ width: '100%' }}>
					<AddVisitForm 
						medicines={medicines} 
						investigations={investigations} 
						onMedicineCreated={(newMed, isUpdate) => {
							if (isUpdate) {
								// Update existing medicine
								setMedicines(medicines.map(m => m.id === newMed.id ? newMed : m));
							} else {
								// Add new medicine
								setMedicines([...medicines, newMed]);
							}
						}}
						onInvestigationCreated={(newInv) => {
							// Add new investigation to the list
							setInvestigations([...investigations, newInv]);
						}}
					/>
				</div>
			)}
		</div>
	);
}

