# Phase 17 — Deployment, DevOps & Production Launch

This document outlines the complete deployment architecture and operational guidelines for Omni One in a production environment. The infrastructure is designed to be resilient, secure, and scalable using Docker, Nginx, and automated CI/CD pipelines.

## 1. Architecture Overview

Omni One is deployed as a multi-container application orchestrated by Docker Compose:

- **Frontend (`omni_frontend`)**: React/Vite SPA served statically by Nginx.
- **Backend (`omni_backend`)**: Fastify Node.js server running the core API and AI orchestration.
- **Database (`omni_postgres`)**: PostgreSQL with `pgvector` extension for structured data and vector embeddings.
- **Cache/Queue (`omni_redis`)**: Redis for rate limiting, session caching, and background job queues.
- **Reverse Proxy (`omni_nginx`)**: Nginx acting as the main entry point, handling SSL termination, gzip compression, rate limiting, and routing to the frontend/backend.
- **SSL Management (`omni_certbot`)**: Automated Let's Encrypt certificate generation and renewal.

## 2. Prerequisites

To deploy Omni One on a production server, you need:
- A Linux server (Ubuntu 22.04/24.04 recommended) with at least 4GB RAM and 2 CPUs.
- Docker and Docker Compose installed.
- A registered domain name pointing to the server's IP address.
- Open ports 80 (HTTP) and 443 (HTTPS).

## 3. Deployment Steps

### Step 1: Clone and Configure
Clone the repository to your production server (e.g., `/opt/omni-one`).

Generate secure secrets for your environment:
```bash
chmod +x scripts/generate-secrets.sh
./scripts/generate-secrets.sh
```

Copy the template and fill in the values:
```bash
cp .env.production.template .env.production
nano .env.production
```
*Ensure you update `CORS_ORIGINS` with your actual domain name.*

### Step 2: Configure Nginx
Update the Nginx template with your domain name:
```bash
cp nginx/nginx.https.conf.template nginx/nginx.conf
nano nginx/nginx.conf
```
*Replace `yourdomain.com` and `www.yourdomain.com` with your actual domains.*

### Step 3: Initialize SSL Certificates
Before starting the full stack, bootstrap the Let's Encrypt certificates:
```bash
chmod +x scripts/init-letsencrypt.sh
nano scripts/init-letsencrypt.sh # Update the domains and email variables
./scripts/init-letsencrypt.sh
```

### Step 4: Start the Application
Once SSL is configured, bring up the entire stack:
```bash
docker-compose up -d
```

Verify everything is running:
```bash
docker-compose ps
docker-compose logs -f backend
```

### Step 5: Database Migration
Apply the Prisma schema to the production database:
```bash
docker-compose exec backend pnpm dlx prisma migrate deploy
```

## 4. Continuous Integration / Continuous Deployment (CI/CD)

Omni One uses GitHub Actions for automated testing and deployment.

### CI Pipeline (`.github/workflows/ci.yml`)
Triggered on every push and PR to the `main` branch.
- Installs dependencies using `pnpm`.
- Runs type checking.
- Executes the Vitest test suite for both frontend and backend.
- Performs a test build to ensure compilation succeeds.

### CD Pipeline (`.github/workflows/cd.yml`)
Triggered on pushes to `main` or tag creation.
- Builds Docker images for the frontend and backend.
- Pushes images to Docker Hub (requires `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` secrets).
- Connects to the production server via SSH.
- Pulls the latest images and restarts the containers automatically.

## 5. Operations & Maintenance

### Database Backups
A script is provided to automate PostgreSQL backups:
```bash
chmod +x scripts/backup-db.sh
```
Add it to the root crontab (`sudo crontab -e`) to run daily at 2 AM:
```text
0 2 * * * /opt/omni-one/scripts/backup-db.sh >> /var/log/omni-backup.log 2>&1
```
*Backups are stored in `/opt/omni-one/backups` and retained for 7 days by default.*

### Health Checks
The backend provides a comprehensive health check endpoint at `https://yourdomain.com/api/health`. Docker Compose uses this internally to ensure the backend is only marked "healthy" when PostgreSQL and Redis are reachable.

### Centralized Logging (Optional)
For advanced monitoring, a Loki/Promtail/Grafana stack is available:
```bash
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```
Access Grafana at port 3000 (ensure it is secured via firewall or reverse proxy).

## 6. Security Hardening

The Nginx reverse proxy implements several security measures:
- **Rate Limiting**: 10 requests/second globally for API endpoints to prevent abuse.
- **Security Headers**: Strict-Transport-Security (HSTS), X-Frame-Options, X-XSS-Protection, and Content-Security-Policy.
- **Body Size Limits**: Restricted to 10MB to prevent large payload attacks while allowing necessary file uploads.
- **Hidden Files**: Nginx blocks access to all `.` hidden files.

The backend Fastify server also implements `@fastify/helmet`, `@fastify/rate-limit`, and CORS origin validation based on the `.env.production` configuration.

---
*Author: Manus AI*
