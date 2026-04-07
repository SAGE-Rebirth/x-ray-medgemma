# NexRay Production Deployment Guide

> **Stack:** Python 3.10 + Flask/Gunicorn | Node.js 20 LTS | Nginx Reverse Proxy | Ubuntu 22.04 LTS  
> **Platform:** AWS EC2

---

## Table of Contents

1. [Infrastructure Requirements](#1-infrastructure-requirements)
2. [Server Provisioning](#2-server-provisioning)
3. [System Dependencies](#3-system-dependencies)
4. [Application Setup](#4-application-setup)
5. [Backend Configuration](#5-backend-configuration)
6. [Frontend Build](#6-frontend-build)
7. [Process Management with systemd](#7-process-management-with-systemd)
8. [Nginx Reverse Proxy Configuration](#8-nginx-reverse-proxy-configuration)
9. [SSL/TLS with Let's Encrypt](#9-ssltls-with-lets-encrypt)
10. [CORS Configuration](#10-cors-configuration)
11. [Deployment Verification](#11-deployment-verification)
12. [Operations Reference](#12-operations-reference)
13. [Security Hardening](#13-security-hardening)

---

## 1. Infrastructure Requirements

| Component | Specification |
|-----------|---------------|
| **Instance Type** | `t3.medium` (2 vCPU, 4 GB RAM) — minimum for API-only mode. Use `g4dn.xlarge` for local model inference via Ollama. |
| **AMI** | Ubuntu 22.04 LTS (`ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*`) |
| **Storage** | 30 GB gp3 (API-only) / 50+ GB gp3 (with Ollama models) |
| **Security Group** | Inbound: SSH (`22`), HTTP (`80`), HTTPS (`443`) — restrict SSH to known IPs |
| **Elastic IP** | Recommended for stable DNS mapping |

---

## 2. Server Provisioning

Connect to your instance:

```bash
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

---

## 3. System Dependencies

### 3.1 Update system packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3.10 python3.10-venv python3-pip git curl
```

### 3.2 Install Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify the installation:

```bash
node --version   # Expected: v20.x.x
npm --version    # Expected: 10.x.x
```

### 3.3 Install Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
```

### 3.4 (Optional) Install Ollama for local model inference

> Only required if you intend to run NexRay models locally on the instance.

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull amsaravi/nexray-4b-it:q6
```

---

## 4. Application Setup

```bash
cd /home/ubuntu
git clone https://github.com/idevanshu/Medgemma.git
cd Medgemma
```

---

## 5. Backend Configuration

### 5.1 Create a Python virtual environment

```bash
cd /home/ubuntu/Medgemma/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn gevent
```

### 5.2 Configure environment variables

```bash
cp .env.example .env
nano .env
```

Set the required keys:

```
GEMINI_API_KEY=your_gemini_api_key
HF_TOKEN=your_huggingface_token
```

### 5.3 Smoke test

```bash
python app.py
# Confirm the server starts, then press Ctrl+C
```

---

## 6. Frontend Build

```bash
cd /home/ubuntu/Medgemma/frontend
npm install
npm run build
```

This produces a production-optimized `dist/` directory containing the static assets served by Nginx.

---

## 7. Process Management with systemd

Create a systemd service unit for the backend:

```bash
sudo nano /etc/systemd/system/nexray.service
```

```ini
[Unit]
Description=NexRay Backend (Gunicorn)
After=network.target

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=/home/ubuntu/Medgemma/backend
Environment="PATH=/home/ubuntu/Medgemma/backend/venv/bin:/usr/bin"
EnvironmentFile=/home/ubuntu/Medgemma/backend/.env
ExecStart=/home/ubuntu/Medgemma/backend/venv/bin/gunicorn \
    --bind 127.0.0.1:5000 \
    --workers 2 \
    --worker-class gevent \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    app:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

> **Why `gevent`?** NexRay uses Server-Sent Events (SSE) for streaming responses. The default sync workers buffer output, which breaks real-time streaming. The `gevent` worker class handles concurrent long-lived connections properly.

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable nexray
sudo systemctl start nexray
sudo systemctl status nexray
```

---

## 8. Nginx Reverse Proxy Configuration

### 8.1 Create the site configuration

```bash
sudo nano /etc/nginx/sites-available/nexray
```

```nginx
server {
    listen 80;
    server_name nexray.devhomes.xyz;

    # --- Frontend (Static Assets) ---
    root /home/ubuntu/Medgemma/frontend/dist;
    index index.html;

    # --- Backend API Proxy ---
    location /api/ {
        proxy_pass         http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # SSE / Streaming support
        proxy_buffering    off;
        proxy_cache        off;
        proxy_read_timeout 300s;
        chunked_transfer_encoding on;
    }

    # --- SPA Fallback ---
    location / {
        try_files $uri $uri/ /index.html;
    }

    # --- Upload Limit (medical images) ---
    client_max_body_size 50M;

    # --- Security Headers ---
    add_header X-Frame-Options        "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection       "1; mode=block" always;
    add_header Referrer-Policy         "strict-origin-when-cross-origin" always;
}
```

### 8.2 Enable the site

```bash
sudo ln -s /etc/nginx/sites-available/nexray /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

## 9. SSL/TLS with Let's Encrypt

**Prerequisite:** Create an **A record** pointing `nexray.devhomes.xyz` to your EC2 instance's public IP.

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d nexray.devhomes.xyz
```

Certbot will automatically:
- Obtain and install the SSL certificate
- Update the Nginx configuration to redirect HTTP to HTTPS
- Configure automatic certificate renewal via a systemd timer

Verify auto-renewal:

```bash
sudo certbot renew --dry-run
```

---

## 10. CORS Configuration

In `backend/app.py`, update the allowed origins:

```python
CORS(app, origins=[
    "http://localhost:3000",
    "https://nexray.devhomes.xyz",
])
```

> **Note:** Since Nginx serves both the frontend and proxies the API from the same origin, CORS headers are not strictly necessary in production. However, keeping them configured avoids issues during development and debugging.

---

## 11. Deployment Verification

Run the following checks to confirm a successful deployment:

```bash
# 1. Backend service health
sudo systemctl status nexray

# 2. Nginx status
sudo systemctl status nginx

# 3. API health check (local)
curl -s http://localhost:5000/api/health

# 4. Full-stack health check (public)
curl -s http://<EC2_PUBLIC_IP>/api/health
```

Open `https://nexray.devhomes.xyz` in a browser to confirm the application loads correctly.

---

## 12. Operations Reference

### Common Commands

| Action | Command |
|--------|---------|
| View backend logs (live) | `sudo journalctl -u nexray -f` |
| View Nginx access logs | `sudo tail -f /var/log/nginx/access.log` |
| View Nginx error logs | `sudo tail -f /var/log/nginx/error.log` |
| Restart backend | `sudo systemctl restart nexray` |
| Restart Nginx | `sudo systemctl restart nginx` |
| Redeploy frontend | `cd frontend && npm run build && sudo systemctl restart nginx` |
| Redeploy backend | `cd backend && source venv/bin/activate && pip install -r requirements.txt && sudo systemctl restart nexray` |
| Pull latest code | `cd /home/ubuntu/Medgemma && git pull origin main` |

### Redeployment Workflow

```bash
cd /home/ubuntu/Medgemma
git pull origin main

# Backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart nexray

# Frontend
cd ../frontend
npm install
npm run build

sudo systemctl restart nginx
```

---

## 13. Security Hardening

- [ ] Restrict SSH inbound access to known IP addresses only
- [ ] Store all API keys and secrets in `.env` — never commit them to version control
- [ ] Enable HTTPS with a valid SSL certificate (see [Section 9](#9-ssltls-with-lets-encrypt))
- [ ] Configure UFW firewall to allow only ports 22, 80, and 443
- [ ] Set up CloudWatch alarms for CPU, memory, and disk utilization
- [ ] Enable automatic security updates: `sudo apt install -y unattended-upgrades`
- [ ] Regularly rotate API keys and credentials
- [ ] Consider placing the instance behind an Application Load Balancer for high availability

---

*Last updated: April 2026*
