#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "====================================="
echo "Starting Elix Deployment..."
echo "====================================="

# 1. Pull latest code
echo "-> Pulling latest code from repository..."
git pull origin main

# 2. Activate Virtual Environment
echo "-> Activating virtual environment..."
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
elif [ -f "/var/www/elix/venv/bin/activate" ]; then
    source /var/www/elix/venv/bin/activate
else
    echo "-> Virtualenv not found, creating one..."
    python3 -m venv venv
    source venv/bin/activate
fi

# 3. Install Dependencies
echo "-> Installing python dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

# 4. Run Database Migrations
echo "-> Running database migrations..."
python manage.py migrate --noinput

# 5. Collect Static Files
echo "-> Collecting static files..."
python manage.py collectstatic --noinput

# 6. Restart App Services & Nginx
SERVICE_NAME="elix"
echo "-> Restarting app service ($SERVICE_NAME)..."
if systemctl list-unit-files --type=service | grep -q "^${SERVICE_NAME}\.service"; then
    sudo systemctl restart "$SERVICE_NAME"
else
    echo "   Service $SERVICE_NAME not found, attempting restart on gunicorn..."
    sudo systemctl restart gunicorn
fi

echo "-> Reloading Nginx..."
sudo systemctl reload nginx

echo "====================================="
echo "Deployment completed successfully! 🚀"
echo "====================================="
