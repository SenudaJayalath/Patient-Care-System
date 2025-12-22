# REST API Gateway Migration Summary

## Changes Made

### 1. API Gateway Type Changed
- **From**: HTTP API Gateway
- **To**: REST API Gateway with Regional Endpoint

### 2. Configuration Updates (`serverless.yml`)

#### API Gateway Configuration
- Changed `httpApi` events to `http` events
- Added explicit REST API resource with `REGIONAL` endpoint type
- Configured CORS at the event level (REST API requires explicit CORS)
- Linked Serverless Framework to use the custom REST API resource

#### Key Changes:
```yaml
# Before (HTTP API)
events:
  - httpApi:
      path: /{proxy+}
      method: ANY

# After (REST API)
events:
  - http:
      path: /{proxy+}
      method: ANY
      cors:
        origin: '*'
        headers:
          - Content-Type
          - Authorization
```

### 3. Lambda Handler Updates

#### Event Format Differences:
- **HTTP API**: Uses `event.requestContext.http.method` and `event.requestContext.http.path`
- **REST API**: Uses `event.httpMethod` and `event.path`

#### Updated Files:
- `src/lambda/index.js`: Updated to handle REST API event format
- `src/lambda/handlers-dynamodb.js`: 
  - Updated header extraction (REST API headers are case-sensitive)
  - Updated body parsing (REST API body is always a string)
  - Updated path parameter extraction

### 4. Regional Endpoint Benefits

- **Data Residency**: Data stays within the specified AWS region
- **Compliance**: Better for regulatory requirements (GDPR, HIPAA considerations)
- **Latency**: Lower latency for regional clients
- **Cost**: Regional endpoints are typically cheaper than edge-optimized
- **Control**: More control over API behavior and integration

## API Endpoint Format

### REST API Regional Endpoint:
```
https://{api-id}.execute-api.{region}.amazonaws.com/{stage}/
```

Example:
```
https://abc123xyz.execute-api.us-east-1.amazonaws.com/dev/
```

## Testing

After deployment, test the endpoints:

```bash
# Health check
curl https://{api-id}.execute-api.us-east-1.amazonaws.com/dev/api/health

# Login
curl -X POST https://{api-id}.execute-api.us-east-1.amazonaws.com/dev/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"doctor1","password":"pass123"}'
```

## Deployment

```bash
npm run deploy:dev
```

The deployment will create:
- REST API Gateway with Regional endpoint
- Lambda function
- API Gateway integration
- CORS configuration
- DynamoDB tables

## Differences from HTTP API

| Feature | HTTP API | REST API |
|---------|----------|----------|
| Cost | $1.00/M requests | $3.50/M requests |
| Latency | Lower | Slightly higher |
| CORS | Built-in | Manual config |
| Event Format | v2.0 format | v1.0 format |
| Endpoint Types | Regional only | Regional/Edge/Private |
| Features | Limited | Full-featured |

## Next Steps

1. Deploy the updated configuration
2. Update frontend API base URL to use REST API endpoint
3. Test all endpoints
4. Monitor CloudWatch metrics for performance
5. Consider adding API caching if needed (REST API feature)

