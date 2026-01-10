// Lambda entry point - routes requests to appropriate handlers
import {
	healthHandler,
	rootHandler,
	loginHandler,
	medicinesHandler,
	createMedicineHandler,
	addBrandToMedicineHandler,
	investigationsHandler,
	createInvestigationHandler,
	createVisitHandler,
	updateVisitHandler,
	getPatientHandler,
	searchPatientsHandler,
	logoutHandler,
	getDrugHistoryHandler,
	updateDrugHistoryHandler
} from './handlers-dynamodb.js';

// Main Lambda handler
export async function handler(event) {
	console.log('Event:', JSON.stringify(event, null, 2));

	// Handle CORS preflight (REST API format)
	if (event.httpMethod === 'OPTIONS') {
		return {
			statusCode: 200,
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Headers': 'Content-Type,Authorization',
				'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
			},
			body: ''
		};
	}

	// Extract path and method (REST API format)
	// REST API uses: event.path, event.httpMethod, event.pathParameters, event.queryStringParameters
	const path = event.path || '/';
	const method = event.httpMethod || 'GET';

	console.log(`Processing ${method} ${path}`);

	try {
		// Route to appropriate handler
		if (path === '/' || path === '') {
			return await rootHandler(event);
		}

		if (path === '/api/health' || path === '/health') {
			return await healthHandler(event);
		}

		if (path === '/api/login' || path === '/login') {
			if (method === 'POST') {
				return await loginHandler(event);
			} else {
				return {
					statusCode: 405,
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ error: 'Method not allowed. Use POST to /api/login' })
				};
			}
		}

		if (path === '/api/logout' || path === '/logout') {
			if (method === 'POST') {
				return await logoutHandler(event);
			}
		}

		if (path === '/api/medicines' || path === '/medicines') {
			if (method === 'GET') {
				return await medicinesHandler(event);
			}
			if (method === 'POST') {
				return await createMedicineHandler(event);
			}
		}

		// Add brand to medicine: POST /api/medicines/:medicineId/brands
		if (path.match(/^\/api\/medicines\/[^\/]+\/brands$/) || path.match(/^\/medicines\/[^\/]+\/brands$/)) {
			if (method === 'POST') {
				return await addBrandToMedicineHandler(event);
			}
		}

		if (path === '/api/investigations' || path === '/investigations') {
			if (method === 'GET') {
				return await investigationsHandler(event);
			}
			if (method === 'POST') {
				return await createInvestigationHandler(event);
			}
		}

		if (path === '/api/visits' || path === '/visits') {
			if (method === 'POST') {
				return await createVisitHandler(event);
			}
		}

	// Handle /api/visits/:id pattern for UPDATE
	const visitMatch = path.match(/^\/api\/visits\/([^\/]+)$/) || path.match(/^\/visits\/([^\/]+)$/);
	if (visitMatch) {
		if (method === 'PUT') {
			console.log('Matched visit update route');
			// Extract visit ID from path
			if (!event.pathParameters) {
				event.pathParameters = {};
			}
			const visitIdFromPath = visitMatch[1];
			// If proxy is used, extract from proxy value
			if (event.pathParameters.proxy) {
				const proxyParts = event.pathParameters.proxy.split('/');
				event.pathParameters.id = proxyParts[proxyParts.length - 1] || visitIdFromPath;
			} else {
				event.pathParameters.id = decodeURIComponent(visitIdFromPath);
			}
			console.log('Extracted visit ID:', event.pathParameters.id);
			return await updateVisitHandler(event);
		}
	}		// Handle /api/patients/search - multi-criteria search
		if (path === '/api/patients/search' || path === '/patients/search') {
			if (method === 'GET') {
				return await searchPatientsHandler(event);
			}
		}

		// Handle /api/patients/:patientId/drug-history pattern
		// Must check before general /api/patients/:patientId pattern
		const drugHistoryMatch = path.match(/^\/api\/patients\/([^\/]+)\/drug-history$/) || path.match(/^\/patients\/([^\/]+)\/drug-history$/);
		if (drugHistoryMatch) {
			if (!event.pathParameters) {
				event.pathParameters = {};
			}
			const patientIdFromPath = drugHistoryMatch[1];
			// Skip if it's 'search' (shouldn't happen, but safety check)
			if (patientIdFromPath === 'search') {
				// Continue to 404
			} else {
				if (event.pathParameters.proxy) {
					const proxyParts = event.pathParameters.proxy.split('/');
					event.pathParameters.patientId = proxyParts[proxyParts.length - 2] || patientIdFromPath;
				} else {
					event.pathParameters.patientId = decodeURIComponent(patientIdFromPath);
				}
				
				if (method === 'GET') {
					return await getDrugHistoryHandler(event);
				} else if (method === 'PUT') {
					return await updateDrugHistoryHandler(event);
				}
			}
		}

		// Handle /api/patients/:patientId pattern
		// REST API: pathParameters are already extracted, but we also support regex matching
		const patientMatch = path.match(/^\/api\/patients\/(.+)$/) || path.match(/^\/patients\/(.+)$/);
		if (patientMatch) {
			if (method === 'GET') {
				// REST API pathParameters should already have 'proxy' key, extract patientId from path
				if (!event.pathParameters) {
					event.pathParameters = {};
				}
				// Extract from proxy path or use direct match
				const patientIdFromPath = patientMatch[1];
				// Skip if it's 'search' (already handled above)
				if (patientIdFromPath === 'search') {
					// Already handled above, continue to 404
				} else {
					// If proxy is used, extract from proxy value
					if (event.pathParameters.proxy) {
						const proxyParts = event.pathParameters.proxy.split('/');
						event.pathParameters.patientId = proxyParts[proxyParts.length - 1] || patientIdFromPath;
					} else {
						event.pathParameters.patientId = decodeURIComponent(patientIdFromPath);
					}
					return await getPatientHandler(event);
				}
			}
		}

		// 404 for unmatched routes
		return {
			statusCode: 404,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ error: 'Not found' })
		};
	} catch (error) {
		console.error('Handler error:', error);
		return {
			statusCode: 500,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ error: 'Internal server error' })
		};
	}
}

