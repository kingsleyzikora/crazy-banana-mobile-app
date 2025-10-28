# User Registration Backend API

Node.js/Express backend API for user registration system with Redis caching, Kafka message queue, and PostgreSQL database.

## Architecture

The backend follows a microservices-inspired architecture:

1. **API Layer**: Express.js REST API
2. **Caching Layer**: Redis for temporary storage and caching
3. **Message Queue**: Kafka for asynchronous processing
4. **Database Layer**: PostgreSQL for persistent storage

## Data Flow

```
Client Request → API Endpoint → Redis (cache) → Kafka Queue → Consumer → PostgreSQL
                                       ↓
                                  Response
```

## Features

- RESTful API with Express.js
- Redis for caching and intermediate storage
- Kafka for message queueing and async processing
- PostgreSQL for persistent data storage
- Input validation with Joi
- Security headers with Helmet
- Rate limiting
- Health check endpoints (liveness/readiness probes)
- Docker containerization
- Kubernetes-ready

## API Endpoints

### Health Checks

#### GET /api/health
Overall health status of the application and dependencies

**Response:**
```json
{
  "uptime": 123.456,
  "message": "OK",
  "timestamp": 1234567890,
  "services": {
    "redis": "healthy",
    "postgres": "healthy",
    "kafka": "healthy"
  }
}
```

#### GET /api/health/live
Liveness probe for Kubernetes

**Response:**
```json
{
  "status": "alive"
}
```

#### GET /api/health/ready
Readiness probe for Kubernetes

**Response:**
```json
{
  "status": "ready"
}
```

### User Management

#### POST /api/users
Submit new user registration

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "gender": "male",
  "sex": "male",
  "occupation": "Software Engineer"
}
```

**Validation Rules:**
- `firstName`: 2-100 characters, required
- `lastName`: 2-100 characters, required
- `email`: Valid email format, required
- `gender`: One of ['male', 'female', 'non-binary', 'prefer-not-to-say'], required
- `sex`: One of ['male', 'female', 'intersex'], required
- `occupation`: 2-255 characters, required

**Response (201):**
```json
{
  "success": true,
  "message": "User registration submitted successfully",
  "data": {
    "email": "john.doe@example.com"
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Validation error: email must be a valid email"
}
```

#### GET /api/users
Get all users with pagination

**Query Parameters:**
- `limit` (optional): Number of results per page (default: 100)
- `offset` (optional): Number of results to skip (default: 0)

**Response (200):**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "gender": "male",
      "sex": "male",
      "occupation": "Software Engineer",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### GET /api/users/:email
Get user by email

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "gender": "male",
    "sex": "male",
    "occupation": "Software Engineer",
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Response (404):**
```json
{
  "success": false,
  "error": "User not found"
}
```

## Environment Variables

Create a `.env` file in the backend directory:

```env
# Server Configuration
NODE_ENV=development
PORT=8000

# Frontend URL for CORS
FRONTEND_URL=http://localhost:5173

# PostgreSQL Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=userdb
DB_USER=postgres
DB_PASSWORD=postgres

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Kafka Configuration
KAFKA_BROKERS=localhost:9092
```

## Local Development

### Prerequisites

- Node.js >= 18
- Docker and Docker Compose (for local services)
- PostgreSQL, Redis, and Kafka running locally or via Docker

### Setup

1. Install dependencies:
```bash
cd backend
npm install
```

2. Start local services with Docker Compose:
```bash
# Create docker-compose.yml for local development
docker-compose up -d
```

3. Create `.env` file from example:
```bash
cp .env.example .env
```

4. Run in development mode:
```bash
npm run dev
```

The API will be available at `http://localhost:8000`

### Running with Docker

```bash
# Build the image
docker build -t user-registration-backend .

# Run the container
docker run -p 8000:8000 \
  -e DB_HOST=host.docker.internal \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  -e KAFKA_BROKERS=host.docker.internal:9092 \
  user-registration-backend
```

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Database Schema

### users table

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  gender VARCHAR(50) NOT NULL,
  sex VARCHAR(50) NOT NULL,
  occupation VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
```

## Redis Keys

- `user:pending:{email}` - Temporary storage for pending user registrations (TTL: 1 hour)
- `user:completed:{email}` - Cache for completed registrations (TTL: 24 hours)

## Kafka Topics

- `user-registration` - Topic for user registration messages

## Security Features

1. **Helmet.js**: Sets security-related HTTP headers
2. **Rate Limiting**: 100 requests per 15 minutes per IP
3. **CORS**: Configured to accept requests only from allowed origins
4. **Input Validation**: All inputs validated with Joi
5. **SQL Injection Prevention**: Using parameterized queries
6. **Non-root Container**: Docker container runs as non-root user

## Monitoring

### Health Checks

Kubernetes uses these endpoints:
- Liveness: `/api/health/live` - Determines if pod should be restarted
- Readiness: `/api/health/ready` - Determines if pod can receive traffic

### Logging

All logs are written to stdout/stderr and can be collected by:
- Kubernetes logs: `kubectl logs -f <pod-name>`
- CloudWatch Logs (when deployed to EKS)

### Metrics

Consider adding:
- Prometheus metrics
- Application Performance Monitoring (APM)
- Distributed tracing (OpenTelemetry)

## Performance Optimization

1. **Connection Pooling**: PostgreSQL connection pool (max 20 connections)
2. **Redis Caching**: Frequently accessed data cached in Redis
3. **Async Processing**: Heavy operations handled via Kafka
4. **Horizontal Scaling**: Can scale to multiple replicas

## Deployment

### Build Image

```bash
docker build -t <account-id>.dkr.ecr.us-east-1.amazonaws.com/user-registration-backend:latest .
```

### Push to ECR

```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Push image
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/user-registration-backend:latest
```

### Deploy to Kubernetes

The CI/CD pipeline automatically builds and deploys on push to main branch.
ArgoCD handles the deployment to the EKS cluster.

## Troubleshooting

### Cannot connect to PostgreSQL
- Check DB_HOST environment variable
- Verify security groups allow traffic from EKS
- Check RDS instance is running

### Cannot connect to Redis
- Check REDIS_URL format (redis://host:port)
- Verify ElastiCache security group rules
- Check Redis cluster is running

### Kafka connection issues
- Verify KAFKA_BROKERS format (comma-separated list)
- Check MSK cluster is running
- Verify security group rules

### High memory usage
- Check for connection leaks
- Monitor Kafka consumer
- Review Redis cache size

## Contributing

1. Create a feature branch
2. Make your changes
3. Add tests
4. Run linter: `npm run lint`
5. Submit pull request

## License

MIT
