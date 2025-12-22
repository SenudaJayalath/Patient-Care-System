# AWS Lambda + DynamoDB Setup Guide

This guide explains how to set up the Doctor Visit Logger backend with AWS Lambda and DynamoDB.

## Architecture Overview

- **API Gateway**: Routes HTTP requests to Lambda functions
- **Lambda Functions**: Serverless compute for API endpoints
- **DynamoDB**: NoSQL database with 4 tables:
  - `doctors` - Doctor accounts
  - `patients` - Patient records
  - `visits` - Visit records (partition key: patient_nic, sort key: date)
  - `medicines` - Medicine reference data

## DynamoDB Tables

### 1. doctors
- **Partition Key**: `id` (String)
- **GSI**: `username-index` (for login lookups)
- **Attributes**: username, password_hash, name, created_at, updated_at

### 2. patients
- **Partition Key**: `nic` (String)
- **Attributes**: name, age, created_at, updated_at

### 3. visits
- **Partition Key**: `patient_nic` (String)
- **Sort Key**: `date` (String - ISO timestamp)
- **GSI**: `doctor-visits-index` (partition key: doctor_id, sort key: date)
- **Attributes**: id, doctor_id, notes, prescriptions (List), created_at

### 4. medicines
- **Partition Key**: `id` (String)
- **Attributes**: name, created_at

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file or set environment variables:

```bash
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
AWS_REGION=us-east-1
```

### 3. Deploy to AWS

```bash
# Install Serverless Framework globally (if not already installed)
npm install -g serverless

# Configure AWS credentials
aws configure

# Deploy to AWS (creates tables and Lambda functions)
npm run deploy

# Or deploy to specific stage
npm run deploy:dev
npm run deploy:prod
```

The Serverless Framework will automatically create:
- DynamoDB tables
- Lambda functions
- API Gateway endpoints
- IAM roles with necessary permissions

### 4. Seed Initial Data

After deployment, seed the tables with initial data:

```bash
node database/seed-dynamodb.js
```

This will create:
- 10 default medicines
- 1 default doctor (username: `doctor1`, password: `pass123`)

### 5. Update Frontend API Base URL

Update `client/src/api.js`:

```javascript
const API_BASE = import.meta.env.VITE_API_BASE || 'https://your-api-gateway-url.execute-api.region.amazonaws.com';
```

## Local Development

For local development with DynamoDB Local:

### 1. Install DynamoDB Local

```bash
# Using Docker
docker run -p 8000:8000 amazon/dynamodb-local

# Or download from AWS
# https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.DownloadingAndRunning.html
```

### 2. Set Environment Variables

```bash
export AWS_ENDPOINT=http://localhost:8000
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local
```

### 3. Create Tables Locally

```bash
# Create tables using AWS CLI
aws dynamodb create-table \
  --table-name doctor-visit-logger-dev-doctors \
  --attribute-definitions AttributeName=id,AttributeType=S AttributeName=username,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --global-secondary-indexes IndexName=username-index,KeySchema=[{AttributeName=username,KeyType=HASH}],Projection={ProjectionType=ALL} \
  --billing-mode PAY_PER_REQUEST \
  --endpoint-url http://localhost:8000

# Repeat for patients, visits, medicines tables
# Or use serverless-offline which can create tables automatically
```

### 4. Run Locally

```bash
npm run offline
```

The API will be available at `http://localhost:4000`

## Environment Variables for Lambda

Set these in AWS Lambda console or via Serverless Framework:

- `DYNAMODB_DOCTORS_TABLE`: Doctors table name (auto-set by Serverless)
- `DYNAMODB_PATIENTS_TABLE`: Patients table name (auto-set by Serverless)
- `DYNAMODB_VISITS_TABLE`: Visits table name (auto-set by Serverless)
- `DYNAMODB_MEDICINES_TABLE`: Medicines table name (auto-set by Serverless)
- `JWT_SECRET`: Secret key for JWT tokens
- `AWS_REGION`: AWS region

## Security Considerations

1. **Password Hashing**: Currently using plain text passwords. In production, use bcrypt:
   ```javascript
   const hashedPassword = await bcrypt.hash(password, 10);
   const isValid = await bcrypt.compare(password, hashedPassword);
   ```

2. **JWT Secret**: Use a strong, randomly generated secret stored in AWS Secrets Manager

3. **IAM Permissions**: The Serverless Framework automatically creates IAM roles with minimal required permissions

4. **CORS**: Configure CORS properly for your frontend domain

## API Endpoints

All endpoints remain the same:

- `GET /` - API info
- `GET /api/health` - Health check
- `POST /api/login` - Login (returns JWT token)
- `POST /api/logout` - Logout
- `GET /api/medicines` - Get medicines list
- `POST /api/visits` - Create visit
- `GET /api/patients/:nic` - Get patient history

## DynamoDB Access Patterns

1. **Login**: Query `doctors` table by `username` using GSI
2. **Get Medicines**: Scan `medicines` table
3. **Get Patient**: Get item from `patients` table by `nic`
4. **Get Patient Visits**: Query `visits` table by `patient_nic` (partition key)
5. **Create Visit**: Put item to `visits` table, update `patients` table
6. **Get Doctor's Visits**: Query `visits` table by `doctor_id` using GSI

## Visit Creation

Multiple visits per patient per doctor per day are allowed. Each visit is uniquely identified by its `id` and `date` timestamp. Doctors can create multiple visits for the same patient on the same day as needed.

## Monitoring

- CloudWatch Logs: All Lambda logs are automatically sent to CloudWatch
- CloudWatch Metrics: Monitor Lambda invocations, errors, duration
- DynamoDB Metrics: Monitor table read/write capacity, throttling

## Troubleshooting

1. **Table Not Found**: Ensure tables are created before seeding data
2. **Permission Denied**: Check IAM roles have DynamoDB permissions

## Cost Optimization

- Tables use `PAY_PER_REQUEST` billing mode (pay only for what you use)
- Consider using provisioned capacity for predictable workloads
- Enable DynamoDB Streams if you need real-time updates

