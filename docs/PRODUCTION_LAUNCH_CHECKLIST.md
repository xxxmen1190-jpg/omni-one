# Production Launch Checklist

This checklist ensures all components of the Omni One Phase 17 deployment are correctly configured before going live.

## 1. Infrastructure & Environment
- [ ] Production server provisioned (Ubuntu 22.04/24.04, 4GB+ RAM).
- [ ] Domain name DNS A records pointed to the server IP.
- [ ] Docker and Docker Compose installed on the host.
- [ ] Firewall configured (Ports 80 and 443 open, SSH secured).

## 2. Secrets & Configuration
- [ ] `scripts/generate-secrets.sh` executed to create secure keys.
- [ ] `.env.production` created from template.
- [ ] `CORS_ORIGINS` updated with the exact production domain.
- [ ] `DATABASE_URL` and `REDIS_URL` correctly point to internal Docker services.
- [ ] External AI Provider API keys added to `.env.production`.
- [ ] GitHub Actions Secrets configured (`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `PROD_HOST`, `PROD_USERNAME`, `PROD_SSH_KEY`).

## 3. Nginx & SSL
- [ ] `nginx/nginx.conf` updated with the production domain name.
- [ ] `scripts/init-letsencrypt.sh` executed successfully.
- [ ] HTTPS redirect is functioning correctly.
- [ ] SSL certificate scores A/A+ on SSL Labs (HSTS enabled).

## 4. Application Deployment
- [ ] `docker-compose up -d` executed without errors.
- [ ] `docker-compose ps` shows all containers as `Up (healthy)`.
- [ ] Prisma migrations applied (`docker-compose exec backend pnpm dlx prisma migrate deploy`).
- [ ] Frontend loads correctly in the browser without console errors.
- [ ] Backend health check returns 200 OK (`curl https://yourdomain.com/api/health`).

## 5. Security & Performance
- [ ] Nginx rate limiting is active (test by sending rapid requests to `/api/health`).
- [ ] Security headers (CSP, HSTS, X-Frame-Options) are present in responses.
- [ ] Gzip compression is active for static assets and API JSON responses.
- [ ] Unnecessary ports are blocked from external access (e.g., Postgres 5432, Redis 6379).

## 6. Operations & Maintenance
- [ ] Database backup cron job (`scripts/backup-db.sh`) installed and tested.
- [ ] Backup retention policy verified.
- [ ] Docker log rotation configured (via `daemon.json` or Compose).
- [ ] (Optional) Monitoring stack (Grafana/Loki) deployed and accessible.

---
*Author: Manus AI*
