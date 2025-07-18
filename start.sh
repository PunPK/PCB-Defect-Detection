#!/bin/bash

# bash start.sh 

source ./pcb-env/bin/activate

# รัน backend ใน background
python ./pcb-detection-backend/server.py &

# เก็บ process id ของ backend
BACKEND_PID=$!

# รัน frontend ใน foreground
cd ./pcb-detection-frontend && npm start

# รอให้ frontend จบ (ถ้ามี)
wait $BACKEND_PID
