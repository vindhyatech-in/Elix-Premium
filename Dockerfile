# Use a stable, lightweight Python environment
FROM python:3.12-slim

# Prevent Python from writing .pyc files and buffer outputs
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set the active folder inside the container
WORKDIR /app

# Copy and install dependencies first (optimizes build speed)
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy your entire Django project into the container
COPY . /app/

# Open port 8000 for network traffic
EXPOSE 8005

# Start the Django development server
CMD ["python", "manage.py", "runserver", "0.0.0.0:8005"]
