#!/bin/bash

# Activate virtual environment
.\pcb-env\Scripts\activate

# Start backend server
cd ./pcb-detection-frontend/api/
python ./4ram_pcb.py 