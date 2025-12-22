import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { apiLogin } from '../api.js';

export default function Login() {
	const { setToken, setUser } = useAuth();
	const [username, setUsername] = useState('doctor1');
	const [password, setPassword] = useState('pass123');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	async function onSubmit(e) {
		e.preventDefault();
		setError('');
		setLoading(true);
		try {
			const { token, user } = await apiLogin({ username, password });
			setToken(token);
			setUser(user);
		} catch (err) {
			setError('Invalid credentials');
		} finally {
			setLoading(false);
		}
	}

	return (
		<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
			<div className="card" style={{ maxWidth: 420, width: '100%' }}>
				<h2 style={{ marginTop: 0 }}>Doctor Login</h2>
				<p className="muted">Enter your credentials to access the system.</p>
				<p className="muted" style={{ fontSize: '14px', marginTop: '4px' }}>
					Default: <strong>doctor1</strong> / <strong>pass123</strong>
				</p>
				<form onSubmit={onSubmit}>
					<div className="form-field">
						<label htmlFor="username">Username</label>
						<input 
							id="username" 
							value={username} 
							onChange={e => setUsername(e.target.value)} 
							required
							autoFocus
						/>
					</div>
					<div className="form-field">
						<label htmlFor="password">Password</label>
						<input 
							id="password" 
							type="password" 
							value={password} 
							onChange={e => setPassword(e.target.value)} 
							required
						/>
					</div>
					{error && <div style={{ color: 'crimson', marginBottom: 8, padding: '8px', background: '#fee', borderRadius: '4px' }}>{error}</div>}
					<button className="primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: '8px' }}>
						{loading ? 'Logging in…' : 'Login'}
					</button>
				</form>
			</div>
		</div>
	);
}

