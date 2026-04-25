#!/bin/bash
# Start the SahabNote backend server
echo "Starting SahabNote Backend..."
cd "$(dirname "$0")/backend"
pip3 install -q -r requirements.txt 2>/dev/null
python3 run.py
