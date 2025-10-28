# User Registration Application

A full-stack cloud-native application for user registration with a React frontend on AWS Amplify and a containerized backend on AWS EKS with PostgreSQL, Redis, and Kafka.

## Architecture

```
┌─────────────┐
│   Frontend  │
│ (AWS Amplify)│
└──────┬──────┘
       │ HTTPS
       ▼
┌──────────────────────────────────────┐
│        AWS Application Load Balancer │
│           (Ingress + SSL)            │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│         EKS Cluster (Backend)        │
│  ┌────────────────────────────────┐  │
│  │   Backend API Pods (Node.js)   │  │
│  └─┬────────────────────┬─────────┘  │
│    │                    │            │
│    ▼                    ▼            │
│  ┌──────────┐      ┌──────────┐     │
│  │  Redis   │      │  Kafka   │     │
│  │(ElastiCache)    │  (MSK)   │     │
│  └──────────┘      └─────┬────┘     │
│                           │          │
└───────────────────────────┼──────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  PostgreSQL  │
                     │    (RDS)     │
                     └──────────────┘
```

## Data Flow

1. User submits form from frontend (AWS Amplify)
2. Frontend sends data to backend API (EKS)
3. Backend stores data temporarily in Redis (ElastiCache)
4. Backend sends message to Kafka queue (MSK)
5. Kafka consumer processes message
6. Data is saved to PostgreSQL database (RDS)
7. Redis cache is updated with completion status

## Tech Stack

### Frontend
- React 18
- Vite
- Tailwind CSS
- AWS Amplify (hosting)

### Backend
- Node.js 18
- Express.js
- PostgreSQL (RDS)
- Redis (ElastiCache)
- Kafka (MSK)

### Infrastructure
- AWS EKS (Kubernetes)
- Terraform
- ArgoCD (GitOps CD)
- GitHub Actions (CI)
- AWS Load Balancer Controller
- cert-manager (SSL/TLS)

## Project Structure

```
.
├── frontend/              # React frontend application
│   ├── src/
│   ├── amplify.yml       # AWS Amplify build config
│   └── package.json
│
├── backend/              # Node.js backend application
│   ├── src/
│   │   ├── config/      # Database, Redis, Kafka configs
│   │   ├── routes/      # API routes
│   │   └── services/    # Business logic
│   ├── Dockerfile
│   └── package.json
│
├── terraform/            # Infrastructure as Code
│   ├── main.tf
│   ├── eks.tf           # EKS cluster
│   ├── rds.tf           # PostgreSQL
│   ├── redis.tf         # ElastiCache
│   ├── msk.tf           # Kafka
│   ├── ecr.tf           # Container registry
│   └── vpc.tf           # Networking
│
├── k8s/                 # Kubernetes manifests
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml     # ALB + SSL
│   └── hpa.yaml         # Auto-scaling
│
├── argocd/              # ArgoCD GitOps configs
│   ├── application.yaml
│   └── project.yaml
│
└── .github/workflows/   # CI/CD pipelines
    └── backend-ci.yml
```

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI configured
- Terraform >= 1.0
- kubectl >= 1.28
- Docker
- Node.js >= 18
- Git

## Deployment Guide

### 1. Infrastructure Setup

```bash
# Navigate to terraform directory
cd terraform

# Copy and edit terraform.tfvars
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Apply infrastructure
terraform apply
```

This will create:
- VPC with public and private subnets
- EKS cluster with worker nodes
- RDS PostgreSQL instance
- ElastiCache Redis cluster
- MSK Kafka cluster
- ECR repository for Docker images
- Security groups and IAM roles

### 2. Configure kubectl

```bash
# Update kubeconfig
aws eks update-kubeconfig --name user-registration-cluster --region us-east-1

# Verify connection
kubectl get nodes
```

### 3. Install Required Add-ons

```bash
# Install AWS Load Balancer Controller
kubectl apply -k "github.com/aws/eks-charts/stable/aws-load-balancer-controller//crds?ref=master"

# Install cert-manager for SSL
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Install ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

### 4. Configure Secrets

```bash
# Get Terraform outputs
cd terraform
terraform output

# Update k8s/secret.yaml with the values from Terraform outputs:
# - RDS endpoint
# - Redis endpoint
# - MSK bootstrap brokers

# Apply Kubernetes manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secret.yaml
```

### 5. Set Up GitHub Actions

Create the following secrets in your GitHub repository:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### 6. Deploy Backend with ArgoCD

```bash
# Update argocd/application.yaml with your Git repository URL

# Apply ArgoCD application
kubectl apply -f argocd/application.yaml

# Get ArgoCD admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Port-forward ArgoCD UI
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Access ArgoCD at https://localhost:8080
```

### 7. Update Ingress with Your Domain

```bash
# Edit k8s/ingress.yaml
# Replace 'api.yourdomain.com' with your actual domain
# Replace 'your-email@example.com' with your email

# Update DNS to point to the ALB
kubectl get ingress -n user-registration
```

### 8. Deploy Frontend to AWS Amplify

```bash
# Push your code to Git repository
git add .
git commit -m "Initial commit"
git push

# In AWS Amplify Console:
# 1. Connect your Git repository
# 2. Select the frontend folder as the build path
# 3. Add environment variable: VITE_API_URL=https://api.yourdomain.com
# 4. Deploy
```

## Environment Variables

### Backend (.env)

```
NODE_ENV=production
PORT=8000
DB_HOST=<rds-endpoint>
DB_PORT=5432
DB_NAME=userdb
DB_USER=<db-username>
DB_PASSWORD=<db-password>
REDIS_URL=redis://<redis-endpoint>:6379
KAFKA_BROKERS=<msk-brokers>
FRONTEND_URL=<amplify-url>
```

### Frontend (.env)

```
VITE_API_URL=https://api.yourdomain.com/api
```

## Monitoring and Operations

### View Logs

```bash
# Backend logs
kubectl logs -f -n user-registration -l app=backend

# ArgoCD logs
kubectl logs -f -n argocd -l app.kubernetes.io/name=argocd-server
```

### Scale Backend

```bash
# Manual scaling
kubectl scale deployment backend -n user-registration --replicas=5

# HPA will automatically scale based on CPU/Memory
kubectl get hpa -n user-registration
```

### Database Access

```bash
# Connect to RDS PostgreSQL
psql -h <rds-endpoint> -U <username> -d userdb
```

### Redis Access

```bash
# Port-forward Redis (if needed for debugging)
kubectl port-forward svc/redis -n user-registration 6379:6379

# Connect with redis-cli
redis-cli -h localhost -p 6379
```

## API Endpoints

### Health Check
```
GET /api/health - Overall health status
GET /api/health/live - Liveness probe
GET /api/health/ready - Readiness probe
```

### User Management
```
POST /api/users - Submit user registration
GET /api/users - Get all users
GET /api/users/:email - Get user by email
```

## Cost Optimization

### Development Environment
- Use smaller instance types (t3.micro, t3.small)
- Set node_desired_size = 1
- Consider using spot instances

### Production Environment
- Enable auto-scaling
- Use reserved instances for predictable workloads
- Set up CloudWatch alarms for cost monitoring

## Security Best Practices

1. **Secrets Management**: Use AWS Secrets Manager or AWS Systems Manager Parameter Store
2. **Network Security**: Keep databases in private subnets
3. **RBAC**: Configure proper Kubernetes RBAC policies
4. **Image Scanning**: Enable ECR image scanning
5. **SSL/TLS**: Use cert-manager for automatic certificate management
6. **Monitoring**: Enable CloudWatch and EKS control plane logging

## Troubleshooting

### Pods not starting
```bash
kubectl describe pod <pod-name> -n user-registration
kubectl logs <pod-name> -n user-registration
```

### Database connection issues
- Check security groups
- Verify RDS endpoint in secrets
- Test connectivity from a pod

### SSL certificate issues
- Check cert-manager logs
- Verify DNS is pointing to ALB
- Check ClusterIssuer configuration

## Cleanup

To destroy all resources:

```bash
# Delete Kubernetes resources
kubectl delete -f k8s/
kubectl delete -f argocd/

# Destroy infrastructure
cd terraform
terraform destroy
```

**Warning**: This will delete all data including the database!

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT

## Support

For issues and questions, please open an issue in the GitHub repository.
