import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
	DynamoDBDocumentClient,
	GetCommand,
	PutCommand,
	UpdateCommand,
	QueryCommand,
	ScanCommand,
	DeleteCommand
} from '@aws-sdk/lib-dynamodb';

// Create DynamoDB client
const client = new DynamoDBClient({
	region: process.env.AWS_REGION || 'us-east-1',
	...(process.env.AWS_ENDPOINT && { endpoint: process.env.AWS_ENDPOINT }) // For local development
});

const docClient = DynamoDBDocumentClient.from(client);

// Table names
export const TABLES = {
	DOCTORS: process.env.DYNAMODB_DOCTORS_TABLE || 'doctors',
	PATIENTS: process.env.DYNAMODB_PATIENTS_TABLE || 'patients',
	VISITS: process.env.DYNAMODB_VISITS_TABLE || 'visits',
	DOCTOR_ITEMS: process.env.DYNAMODB_DOCTOR_ITEMS_TABLE || 'doctor-items'
};

// Helper functions for DynamoDB operations

export async function getItem(tableName, key) {
	const command = new GetCommand({
		TableName: tableName,
		Key: key
	});
	const response = await docClient.send(command);
	return response.Item || null;
}

export async function putItem(tableName, item) {
	const command = new PutCommand({
		TableName: tableName,
		Item: item
	});
	await docClient.send(command);
	return item;
}

export async function updateItem(tableName, key, updateExpression, expressionAttributeValues, expressionAttributeNames = {}) {
	const params = {
		TableName: tableName,
		Key: key,
		UpdateExpression: updateExpression,
		ExpressionAttributeValues: expressionAttributeValues,
		ReturnValues: 'ALL_NEW'
	};
	// Only include ExpressionAttributeNames if it's not empty
	if (Object.keys(expressionAttributeNames).length > 0) {
		params.ExpressionAttributeNames = expressionAttributeNames;
	}
	const command = new UpdateCommand(params);
	const response = await docClient.send(command);
	return response.Attributes;
}

export async function queryItems(tableName, keyConditionExpression, expressionAttributeValues, expressionAttributeNames = {}, indexName = null) {
	const params = {
		TableName: tableName,
		KeyConditionExpression: keyConditionExpression,
		ExpressionAttributeValues: expressionAttributeValues
	};
	// Only include ExpressionAttributeNames if it's not empty
	if (Object.keys(expressionAttributeNames).length > 0) {
		params.ExpressionAttributeNames = expressionAttributeNames;
	}
	if (indexName) {
		params.IndexName = indexName;
	}
	const command = new QueryCommand(params);
	const response = await docClient.send(command);
	return response.Items || [];
}

// Simple query helper - queries by a single partition key
export async function queryTable(tableName, partitionKeyName, partitionKeyValue, indexName = null) {
	return await queryItems(
		tableName,
		`${partitionKeyName} = :pkValue`,
		{ ':pkValue': partitionKeyValue },
		{},
		indexName
	);
}

export async function scanTable(tableName, filterExpression = null, expressionAttributeValues = {}, expressionAttributeNames = {}) {
	const params = {
		TableName: tableName
	};
	if (filterExpression) {
		params.FilterExpression = filterExpression;
		params.ExpressionAttributeValues = expressionAttributeValues;
		// Only include ExpressionAttributeNames if it's not empty
		if (Object.keys(expressionAttributeNames).length > 0) {
			params.ExpressionAttributeNames = expressionAttributeNames;
		}
	}
	const command = new ScanCommand(params);
	const response = await docClient.send(command);
	return response.Items || [];
}

export async function deleteItem(tableName, key) {
	const command = new DeleteCommand({
		TableName: tableName,
		Key: key
	});
	await docClient.send(command);
}

// Helper to extract date part from ISO timestamp
export function getDatePart(timestamp) {
	return timestamp.split('T')[0];
}

// Helper to calculate age from birthday
export function calculateAge(birthday) {
	if (!birthday) return null;
	const today = new Date();
	const birthDate = new Date(birthday);
	let age = today.getFullYear() - birthDate.getFullYear();
	const monthDiff = today.getMonth() - birthDate.getMonth();
	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
		age--;
	}
	return age;
}

