import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
	const [token, setToken] = useState(() => localStorage.getItem('authToken') || '');
	const [user, setUser] = useState(() => {
		const raw = localStorage.getItem('authUser');
		return raw ? JSON.parse(raw) : null;
	});

	useEffect(() => {
		if (token) {
			localStorage.setItem('authToken', token);
		} else {
			localStorage.removeItem('authToken');
		}
	}, [token]);

	useEffect(() => {
		if (user) {
			localStorage.setItem('authUser', JSON.stringify(user));
		} else {
			localStorage.removeItem('authUser');
		}
	}, [user]);

	const value = useMemo(() => ({
		token,
		setToken,
		user,
		setUser
	}), [token, user]);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const ctx = useContext(AuthContext);
	if (!ctx) throw new Error('useAuth must be used within AuthProvider');
	return ctx;
}

