# Raspberry Pi Deployment Guide

This guide helps you deploy the Attendance System to a Raspberry Pi (Pi 4 or 5 recommended).

## Prerequisites
- Raspberry Pi with Raspberry Pi OS (64-bit recommended)
- Internet connection on the Pi
- SSH access enabled

## Step 1: Transfer Files
From your Windows PC (PowerShell), copy the project to the Pi. Replace `<PI_IP>` with your Pi's IP address and `<USER>` with your username (default: `pi`).

```powershell
# Inside attendence1/attendance_model folder
scp -r . <USER>@<PI_IP>:/home/<USER>/attendance_system
```

## Step 2: Run Deployment Script
SSH into your Pi:

```bash
ssh <USER>@<PI_IP>
```

Navigate to the folder and run the script:

```bash
cd ~/attendance_system
chmod +x deploy_pi.sh
./deploy_pi.sh
```

This script will:
1. Update the system and install system libraries (OpenCV, Atlas).
2. Create a Python virtual environment (`venv`).
3. Install Python dependencies (`requirements.txt`).
4. Setup a Systemd service (`attendance.service`) to auto-run on boot.
5. Configure the firewall to allow port 8000.

## Step 3: Verify
Open your browser and visit:
`http://<PI_IP>:8000/`

## Operations
- **Stop Server:** `sudo systemctl stop attendance`
- **Start Server:** `sudo systemctl start attendance`
- **View Logs:** `sudo journalctl -u attendance -f`
- **Restart:** `sudo systemctl restart attendance`

## Troubleshooting
- **Slow Performance:** The Pi CPU is slower than a laptop. Ensure you use the "legacy" backend (FaceNet) configured in the service file.
- **Camera Issues:** If using a Pi Camera module, ensure `libcamera` or legacy camera support is enabled in `sudo raspi-config`.
- **Memory:** If the Pi freezes, increase swap size (`sudo dphys-swapfile setup`).

## Rollback
To remove the deployment:
```bash
sudo systemctl stop attendance
sudo systemctl disable attendance
sudo rm /etc/systemd/system/attendance.service
rm -rf ~/attendance_system
```
