# NexRay Redeployment Guide — Domain Change

> **Objective:** Switch domain from `nexray.devhomes.xyz` to `nexray.sarvatralabs.com` on the same AWS EC2 server.

---

## Prerequisites

- SSH access to the EC2 instance
- Access to the `sarvatralabs.com` DNS provider (Route 53, Cloudflare, etc.)
- The EC2 Elastic IP address

---

## Step 1: Update DNS

Create an **A record** in your `sarvatralabs.com` DNS provider:

| Type | Name | Value |
|------|------|-------|
| A | `nexray` | `<EC2_ELASTIC_IP>` |

Wait for DNS propagation (usually 1–5 minutes with low TTL, up to 48 hours for some providers).

Verify propagation:

```bash
dig nexray.sarvatralabs.com +short
# Should return your EC2 Elastic IP
```

---

## Step 2: Update Nginx Server Name

SSH into the server:

```bash
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

Edit the Nginx site config:

```bash
sudo nano /etc/nginx/sites-available/nexray
```

Change the `server_name` directive:

```diff
- server_name nexray.devhomes.xyz;
+ server_name nexray.sarvatralabs.com;
```

Test and reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## Step 3: Obtain SSL Certificate for New Domain

```bash
sudo certbot --nginx -d nexray.sarvatralabs.com
```

Certbot will automatically:
- Obtain a new Let's Encrypt certificate
- Update the Nginx config with SSL directives
- Set up HTTP → HTTPS redirect

Verify auto-renewal:

```bash
sudo certbot renew --dry-run
```

---

## Step 4: Update CORS in Backend

Edit `backend/app.py`:

```bash
nano /home/ubuntu/Medgemma/backend/app.py
```

Update the CORS origins (line 28):

```diff
- CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000"])
+ CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000", "https://nexray.sarvatralabs.com"])
```

---

## Step 5: Restart Services

```bash
sudo systemctl restart nexray
sudo systemctl restart nginx
```

---

## Step 6: Verify

```bash
# Backend service health
sudo systemctl status nexray

# Nginx status
sudo systemctl status nginx

# API health check
curl -s https://nexray.sarvatralabs.com/api/health
```

Open `https://nexray.sarvatralabs.com` in a browser to confirm the application loads correctly.

---

## (Optional) Clean Up Old Domain

If you no longer need the old domain:

1. Remove the old DNS A record for `nexray.devhomes.xyz`
2. Revoke the old certificate:
   ```bash
   sudo certbot revoke --cert-name nexray.devhomes.xyz
   sudo certbot delete --cert-name nexray.devhomes.xyz
   ```

---

*Last updated: April 2026*
