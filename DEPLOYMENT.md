# Deployment Guide

Step-by-step guide to deploy the User Registration application to AWS.

## Prerequisites Checklist

- [ ] AWS Account with administrative access
- [ ] AWS CLI installed and configured
- [ ] Terraform >= 1.0 installed
- [ ] kubectl >= 1.28 installed
- [ ] Docker installed
- [ ] Git repository (GitHub, GitLab, or Bitbucket)
- [ ] Domain name (optional, for SSL)

## Phase 1: Infrastructure Deployment

### Step 1: Configure Terraform Variables

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` and set:
- `aws_region`: Your preferred AWS region
- `db_password`: Strong password for PostgreSQL
- `domain_name`: Your domain (if you have one)

### Step 2: Deploy Infrastructure

```bash
# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Deploy (will take 20-30 minutes)
terraform apply
```

### Step 3: Save Terraform Outputs

```bash
# Save all outputs
terraform output > ../outputs.txt

# Important outputs:
# - cluster_name
# - ecr_repository_url
# - rds_endpoint
# - redis_endpoint
# - msk_bootstrap_brokers
```

## Phase 2: Configure Kubernetes

### Step 1: Update kubeconfig

```bash
aws eks update-kubeconfig \
  --name $(terraform output -raw cluster_name) \
  --region $(terraform output -raw aws_region)

# Verify connection
kubectl get nodes
```

### Step 2: Install AWS Load Balancer Controller

```bash
# Download IAM policy
curl -o iam-policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.6.0/docs/install/iam_policy.json

# Create IAM policy
aws iam create-policy \
  --policy-name AWSLoadBalancerControllerIAMPolicy \
  --policy-document file://iam-policy.json

# Create service account
eksctl create iamserviceaccount \
  --cluster=$(terraform output -raw cluster_name) \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --attach-policy-arn=arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/AWSLoadBalancerControllerIAMPolicy \
  --approve

# Install controller
kubectl apply -k "github.com/aws/eks-charts/stable/aws-load-balancer-controller//crds?ref=master"

helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=$(terraform output -raw cluster_name) \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

### Step 3: Install cert-manager

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=300s
```

### Step 4: Install ArgoCD

```bash
# Create namespace
kubectl create namespace argocd

# Install ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=300s

# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
echo ""

# Port forward to access ArgoCD UI (in a separate terminal)
kubectl port-forward svc/argocd-server -n argocd 8080:443
# Access at https://localhost:8080
```

## Phase 3: Configure Application Secrets

### Step 1: Update Kubernetes Secrets

```bash
cd ../k8s

# Get values from Terraform outputs
RDS_ENDPOINT=$(cd ../terraform && terraform output -raw rds_address)
REDIS_ENDPOINT=$(cd ../terraform && terraform output -raw redis_endpoint)
KAFKA_BROKERS=$(cd ../terraform && terraform output -raw msk_bootstrap_brokers)
```

Edit `k8s/secret.yaml` and fill in:
```yaml
DB_HOST: "<RDS_ENDPOINT>"
REDIS_URL: "redis://<REDIS_ENDPOINT>:6379"
KAFKA_BROKERS: "<KAFKA_BROKERS>"
FRONTEND_URL: "https://your-amplify-url.amplify.com"  # Update after frontend deployment
```

### Step 2: Apply Kubernetes Manifests

```bash
# Create namespace
kubectl apply -f namespace.yaml

# Create secrets and configmap
kubectl apply -f secret.yaml

# Don't apply other manifests yet - ArgoCD will handle them
```

## Phase 4: Set Up CI/CD

### Step 1: Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and add:

```
AWS_ACCESS_KEY_ID: <your-access-key>
AWS_SECRET_ACCESS_KEY: <your-secret-key>
```

### Step 2: Update ArgoCD Application

Edit `argocd/application.yaml`:
```yaml
source:
  repoURL: https://github.com/YOUR_USERNAME/YOUR_REPO.git
```

### Step 3: Apply ArgoCD Configuration

```bash
cd ../argocd
kubectl apply -f project.yaml
kubectl apply -f application.yaml
```

## Phase 5: Deploy Backend

### Step 1: Update Deployment Manifest

Edit `k8s/deployment.yaml` and replace placeholders:
```yaml
image: <AWS_ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com/user-registration-backend:latest
```

Get your AWS Account ID:
```bash
aws sts get-caller-identity --query Account --output text
```

### Step 2: Build and Push Initial Image

```bash
cd ../backend

# Build image
docker build -t user-registration-backend .

# Tag image
ECR_URL=$(cd ../terraform && terraform output -raw ecr_repository_url)
docker tag user-registration-backend:latest $ECR_URL:latest

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $ECR_URL

# Push image
docker push $ECR_URL:latest
```

### Step 3: Commit and Push Changes

```bash
cd ..
git add .
git commit -m "Configure deployment"
git push origin main
```

GitHub Actions will automatically build and push new images on subsequent pushes.

### Step 4: Verify Deployment

```bash
# Check ArgoCD sync status
kubectl get application -n argocd

# Check pods
kubectl get pods -n user-registration

# Check logs
kubectl logs -f -n user-registration -l app=backend

# Check service
kubectl get svc -n user-registration
```

## Phase 6: Configure Domain and SSL

### Step 1: Get Load Balancer DNS

```bash
kubectl get ingress -n user-registration
# Note the ADDRESS field
```

### Step 2: Update DNS Records

In your DNS provider (e.g., Route 53, Cloudflare):
- Create A record or CNAME for `api.yourdomain.com`
- Point it to the ALB DNS name from above

### Step 3: Update Ingress

Edit `k8s/ingress.yaml`:
```yaml
spec:
  tls:
  - hosts:
    - api.yourdomain.com  # Your actual domain
  rules:
  - host: api.yourdomain.com  # Your actual domain
```

Also update the email in ClusterIssuer:
```yaml
email: your-email@example.com  # Your actual email
```

### Step 4: Apply Changes

```bash
kubectl apply -f k8s/ingress.yaml

# Watch certificate creation
kubectl get certificate -n user-registration -w
```

Wait for certificate to be ready (may take a few minutes).

## Phase 7: Deploy Frontend

### Step 1: Update Frontend Environment

In `frontend/.env.example`, set:
```
VITE_API_URL=https://api.yourdomain.com/api
```

### Step 2: Deploy to AWS Amplify

1. Go to AWS Amplify Console
2. Click "New app" → "Host web app"
3. Connect your Git repository
4. Configure build settings:
   - App build specification: Use the `amplify.yml` in the frontend folder
   - Build settings path: frontend
5. Add environment variable:
   - Key: `VITE_API_URL`
   - Value: `https://api.yourdomain.com/api`
6. Click "Save and deploy"

### Step 3: Update Backend CORS

After frontend is deployed, get the Amplify URL and update `k8s/secret.yaml`:
```yaml
FRONTEND_URL: "https://your-app.amplifyapp.com"
```

Apply the change:
```bash
kubectl apply -f k8s/secret.yaml
kubectl rollout restart deployment/backend -n user-registration
```

## Phase 8: Verification

### Test Backend API

```bash
# Health check
curl https://api.yourdomain.com/api/health

# Test user registration
curl -X POST https://api.yourdomain.com/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "gender": "prefer-not-to-say",
    "sex": "male",
    "occupation": "Tester"
  }'

# Get users
curl https://api.yourdomain.com/api/users
```

### Test Frontend

1. Open your Amplify URL in a browser
2. Fill in the registration form
3. Submit
4. Verify success message

### Check Database

```bash
# Connect to RDS
psql -h $(cd terraform && terraform output -raw rds_address) \
     -U dbadmin \
     -d userdb

# Query users
SELECT * FROM users;
```

## Monitoring and Maintenance

### View Logs

```bash
# Backend logs
kubectl logs -f -n user-registration -l app=backend

# ArgoCD logs
kubectl logs -f -n argocd -l app.kubernetes.io/name=argocd-server
```

### Monitor Resources

```bash
# Pod status
kubectl get pods -n user-registration -w

# HPA status
kubectl get hpa -n user-registration

# Resource usage
kubectl top pods -n user-registration
kubectl top nodes
```

### ArgoCD Dashboard

Access ArgoCD UI:
```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

Open https://localhost:8080 and monitor deployments.

## Troubleshooting

### Pods not starting

```bash
kubectl describe pod <pod-name> -n user-registration
kubectl logs <pod-name> -n user-registration
```

### Certificate not issuing

```bash
kubectl describe certificate backend-tls -n user-registration
kubectl describe certificaterequest -n user-registration
kubectl logs -n cert-manager -l app=cert-manager
```

### Database connection errors

1. Check security groups allow EKS → RDS traffic
2. Verify RDS endpoint in secrets
3. Check credentials

### Load balancer not provisioning

```bash
kubectl logs -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller
```

## Cleanup

To delete everything:

```bash
# Delete Kubernetes resources
kubectl delete -f k8s/
kubectl delete namespace user-registration

# Delete ArgoCD
kubectl delete namespace argocd

# Destroy infrastructure (WARNING: This deletes all data!)
cd terraform
terraform destroy
```

## Cost Estimate

Monthly costs (us-east-1, approximate):
- EKS Cluster: $73
- EC2 Instances (2x t3.medium): $60
- RDS (db.t3.micro): $15
- ElastiCache (cache.t3.micro): $12
- MSK (2x kafka.t3.small): $120
- Data Transfer: $10-50
- **Total: ~$290-330/month**

To reduce costs:
- Use t3.micro instances
- Single-node Redis
- Smaller Kafka brokers
- Use development environment settings

## Next Steps

- [ ] Set up monitoring (CloudWatch, Prometheus)
- [ ] Configure backups for RDS
- [ ] Set up alerting (CloudWatch Alarms)
- [ ] Enable WAF on ALB
- [ ] Configure autoscaling policies
- [ ] Set up log aggregation
- [ ] Implement authentication
- [ ] Add API rate limiting per user

## Support

For issues:
1. Check logs
2. Review this guide
3. Check AWS service health
4. Open GitHub issue
