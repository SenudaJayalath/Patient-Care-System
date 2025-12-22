import React from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';

function AppInner() {
	const { token } = useAuth();
	try {
		return (
			<div className="container">
				{token ? <Dashboard /> : <Login />}
			</div>
		);
	} catch (error) {
		console.error('App error:', error);
		return (
			<div className="container">
				<div className="card" style={{ color: 'crimson' }}>
					<h2>Error</h2>
					<p>Something went wrong. Please refresh the page.</p>
					<button onClick={() => window.location.reload()}>Refresh</button>
				</div>
			</div>
		);
	}
}

export default function App() {
	return (
		<AuthProvider>
			<AppInner />
		</AuthProvider>
	);
}

