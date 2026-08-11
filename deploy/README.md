# Deploying Elix (demo) to the Oracle VM

Target: a separate Oracle Compute VM (`140.245.207.15`, Ubuntu 22.04/24.04)
from the Postgres DB VM (`140.245.231.34`), reachable at
**elix.vindhyatech.in**. This VM also runs other, unrelated projects —
everything here is scoped to `elix` (service name, socket, nginx site
file, `/var/www/elix`) so it never touches them. Demo deployment, not
hardened production: one gunicorn instance behind nginx, systemd for
process supervision, certbot for HTTPS.

## One-time setup

1. **DNS**: point `elix.vindhyatech.in` at `140.245.207.15`.
2. **Firewall / Security List**: allow inbound TCP 80 and 443 on this VM
   (Oracle Cloud's Security List/NSG, plus the OS firewall if one is
   active — `ufw allow 80,443/tcp` on Ubuntu).
3. **Git access**: this VM needs to be able to clone
   `git@github-vindhyatech:vindhyatech-in/Elix-Premium.git` — either add a
   deploy key for this repo, or set `REPO_URL` to an HTTPS URL with a
   personal access token when you run the script.
4. **Postgres**: confirm this VM can actually reach `140.245.231.34:5432`
   (Oracle's Security List on the *DB* VM needs to allow inbound Postgres
   traffic from this app VM's IP/subnet, not just this VM's own firewall).
5. **Google/Apple OAuth consoles**: if social login should work on the
   demo, add `https://elix.vindhyatech.in/accounts/google/login/callback/`
   (and the Apple equivalent) as an authorized redirect URI in the
   Google Cloud Console / Apple Developer portal — outside this repo's
   control, has to be done by whoever owns those console accounts. The
   `django.contrib.sites` row driving these callback URLs has already
   been updated to `elix.vindhyatech.in`.

## Deploy

```bash
cd ~/Elix-Premium
sudo CERTBOT_EMAIL=you@example.com ./deploy.sh
```

First run will:

1. Install nginx/certbot/python3-venv (skips anything already present —
   safe on a VM that already has these for the other projects).
2. Clone the repo into `/var/www/elix`.
3. Create a venv and install `requirements.txt`.
4. **Stop and print instructions** if `/var/www/elix/.env` doesn't exist
   yet or still has `DEBUG=True` — it copies `.env.example` for you, but
   **you must fill in real values yourself** (this script never invents
   or commits secrets). At minimum:
   - `SECRET_KEY` — generate one: `python3 -c "import secrets; print(secrets.token_urlsafe(50))"`
   - `DEBUG=False`
   - `ALLOWED_HOSTS=elix.vindhyatech.in`
   - `CSRF_TRUSTED_ORIGINS=https://elix.vindhyatech.in`
   - `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST=140.245.231.34`, `DB_PORT=5432`
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - `BREVO_API_KEY`, `DEFAULT_FROM_EMAIL` (optional — falls back to
     console-only email if left blank)
5. Re-run the same command — this time it migrates, collects static
   files, installs the `elix` systemd service + nginx site, and requests
   an HTTPS cert via certbot.

## Redeploying (after pushing new code)

Same command, from the VM:

```bash
cd /var/www/elix && sudo ./deploy/deploy.sh
```

It's idempotent — pulls latest `main`, reinstalls any changed
dependencies, re-migrates, restarts the `elix` service, and no-ops the
certbot step if the certificate is still valid.

## Checking on it

```bash
sudo systemctl status elix          # is gunicorn running?
sudo journalctl -u elix -f          # live app logs
sudo nginx -t                       # validate nginx config
curl -I https://elix.vindhyatech.in
```

## What this deliberately does NOT do (demo scope)

No CI/CD, no zero-downtime restarts, no log rotation/monitoring/alerting,
no firewall hardening beyond what's noted above, no separate
staging/production split. Good enough to demo reliably; not a production
hardening checklist.
