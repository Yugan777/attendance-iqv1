#!/bin/bash
# Raspberry Pi Deployment Script for Attendance System
# Usage: chmod +x deploy_pi.sh && ./deploy_pi.sh

set -e

# --- Configuration ---
# Change these values if needed
APP_DIR="/home/pi/attendance_system"
VENV_DIR="$APP_DIR/venv"
PORT=8000
SERVICE_NAME="attendance"
USER="pi"

echo ">>> Starting Raspberry Pi Deployment..."

# 1. System Updates & Dependencies
echo ">>> Updating system and installing dependencies..."
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y python3-pip python3-venv python3-opencv libatlas-base-dev git libhdf5-dev libopenblas-dev liblapack-dev gfortran

# 2. Setup Directory & Virtual Env
echo ">>> Setting up application directory at $APP_DIR..."
mkdir -p "$APP_DIR"
if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR"
fi

# 3. File Transfer Instructions (Manual Step)
echo ">>> NOTE: Please ensure you have copied the project files to $APP_DIR."
echo ">>> You can use SCP from your PC: scp -r ./* pi@<PI_IP>:$APP_DIR"
# Assuming files are present for this script execution context
# (In a real run, this script would likely be part of the repo)

# 4. Install Python Requirements
echo ">>> Installing Python requirements..."
source "$VENV_DIR/bin/activate"
pip install --upgrade pip
# On Pi, install specific versions compatible with ARM if needed
# We use the existing requirements.txt but ensure tensorflow-cpu or tflite-runtime if full TF is too heavy
# For Pi 4/5, standard tensorflow usually works but is slow; tflite-runtime is preferred for inference only.
# Here we stick to requirements.txt for compatibility with current code.
if [ -f "$APP_DIR/requirements.txt" ]; then
    pip install -r "$APP_DIR/requirements.txt" --extra-index-url https://www.piwheels.org/simple
else
    echo "Warning: requirements.txt not found!"
fi

# 5. Systemd Service for Auto-start
echo ">>> Creating systemd service..."
cat <<EOF | sudo tee /etc/systemd/system/$SERVICE_NAME.service
[Unit]
Description=Attendance System Flask App
After=network.target

[Service]
User=$USER
WorkingDirectory=$APP_DIR
Environment="PATH=$VENV_DIR/bin"
Environment="APP_PORT=$PORT"
Environment="MODEL_BACKEND=legacy"
Environment="OPERATOR_PASSWORD=admin"
# Optimize for Pi
Environment="TF_NUM_INTEROP_THREADS=1"
Environment="TF_NUM_INTRAOP_THREADS=1"
ExecStart=$VENV_DIR/bin/python app.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

echo ">>> Enabling and starting service..."
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl restart $SERVICE_NAME

# 6. Firewall Configuration (UFW)
if command -v ufw > /dev/null; then
    echo ">>> Configuring firewall..."
    sudo ufw allow $PORT/tcp
    sudo ufw allow 22/tcp
    sudo ufw --force enable
fi

# 7. Verification
echo ">>> Verifying deployment..."
sleep 10
STATUS=$(systemctl is-active $SERVICE_NAME)
if [ "$STATUS" == "active" ]; then
    echo ">>> Service is ACTIVE."
    echo ">>> Access at http://$(hostname -I | awk '{print $1}'):$PORT/"
else
    echo ">>> Service failed to start. Check logs with: sudo journalctl -u $SERVICE_NAME -f"
    exit 1
fi

echo ">>> Deployment Complete!"
