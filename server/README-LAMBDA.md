# AWS Lambda Migration Guide

This guide explains how to migrate the Doctor Visit Logger backend from Express to AWS Lambda with a relational database.

## Architecture Overview

- **API Gateway**: Routes HTTP requests to Lambda functions
- **Lambda Functions**: Serverless compute for API endpoints
- **RDS PostgreSQL**: Relational database for doctors, patients, visits, and prescriptions
- **VPC**: Lambda functions run in VPC to access RDS securely

## Database Schema

The database consists of 5 tables:

1. **doctors** - Doctor accounts (id, username, password_hash, name)
2. **patients** - Patient records (nic PRIMARY KEY, name, age)
3. **visits** - Visit records (id, patient_nic, doctor_id, date, notes)
   - Unique constraint: (patient_nic, doctor_id, date) - one visit per patient per doctor per day
4. **prescriptions** - Prescription items (id, visit_id, medicine_id, amount)
5. **medicines** - Medicine reference data (id, name)

See `database/schema.sql` for the complete schema.

## Setup Instructions

### 1. Create RDS PostgreSQL Database

```bash
# Using AWS CLI or Console
aws rds create-db-instance \
  --db-instance-identifier doctor-visit-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username admin \
  --master-user-password YourSecurePassword123 \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-xxxxx \
  --db-subnet-group-name default \
  --backup-retention-period 7 \
  --publicly-accessible false
```

### 2. Run Database Migration

```bash
# Connect to RDS and run schema
psql -h database-2.cluster-c7ksokgkk3ql.us-west-1.rds.amazonaws.com -U postgres -d database-2 -f database/schema.sql
```

### 3. Configure Environment Variables

Create a `.env` file or set environment variables:

```bash
DB_HOST=your-rds-endpoint.region.rds.amazonaws.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=admin
DB_PASSWORD=YourSecurePassword123
DB_SSL=true
JWT_SECRET=your-super-secret-jwt-key-change-this
VPC_SECURITY_GROUP_ID=sg-xxxxx
VPC_SUBNET_ID_1=subnet-xxxxx
VPC_SUBNET_ID_2=subnet-yyyyy
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Deploy to AWS Lambda

```bash
# Install Serverless Framework globally (if not already installed)
npm install -g serverless

# Deploy to AWS
npm run deploy

# Or deploy to specific stage
npm run deploy:dev
npm run deploy:prod
```

### 6. Update Frontend API Base URL

Update `client/src/api.js`:

```javascript
const API_BASE = import.meta.env.VITE_API_BASE || 'https://your-api-gateway-url.execute-api.region.amazonaws.com';
```

## Local Development

For local development with Lambda functions:

```bash
# Install serverless-offline plugin
npm install --save-dev serverless-offline

# Run locally
npm run offline
```

The API will be available at `http://localhost:4000`

## Environment Variables for Lambda

Set these in AWS Lambda console or via Serverless Framework:

- `DB_HOST`: RDS endpoint
- `DB_PORT`: Database port (default: 5432)
- `DB_NAME`: Database name
- `DB_USER`: Database username
- `DB_PASSWORD`: Database password
- `DB_SSL`: Enable SSL (true/false)
- `JWT_SECRET`: Secret key for JWT tokens

## VPC Configuration

Lambda functions need to be in the same VPC as RDS:

1. Create VPC security group allowing Lambda to connect to RDS
2. Configure Lambda VPC settings in `serverless.yml`
3. Ensure RDS security group allows inbound connections from Lambda security group

## Security Considerations

1. **Password Hashing**: Currently using plain text passwords. In production, use bcrypt:
   ```javascript
   const hashedPassword = await bcrypt.hash(password, 10);
   const isValid = await bcrypt.compare(password, hashedPassword);
   ```

2. **JWT Secret**: Use a strong, randomly generated secret stored in AWS Secrets Manager

3. **Database Credentials**: Store in AWS Secrets Manager or Parameter Store

4. **SSL/TLS**: Always use SSL for database connections in production

5. **CORS**: Configure CORS properly for your frontend domain

## API Endpoints

All endpoints remain the same:

- `GET /` - API info
- `GET /api/health` - Health check
- `POST /api/login` - Login (returns JWT token)
- `POST /api/logout` - Logout
- `GET /api/medicines` - Get medicines list
- `POST /api/visits` - Create visit
- `GET /api/patients/:nic` - Get patient history

## Database Connection Pooling

Lambda functions use connection pooling with a maximum of 2 connections per function instance. Connections are reused across invocations for better performance.

## Monitoring

- CloudWatch Logs: All Lambda logs are automatically sent to CloudWatch
- CloudWatch Metrics: Monitor Lambda invocations, errors, duration
- RDS Monitoring: Monitor database connections, CPU, memory

## Troubleshooting

1. **Connection Timeout**: Check VPC configuration and security groups
2. **Authentication Errors**: Verify database credentials and JWT secret
3. **Unique Constraint Violations**: The (patient_nic, doctor_id, date) constraint prevents duplicate visits

## Migration from In-Memory to RDS

1. Export existing data (if any) from in-memory database
2. Run schema migration
3. Import data into RDS
4. Update Lambda environment variables
5. Deploy Lambda functions
6. Update frontend API URL

