#!/bin/bash

# Start the backend
./scripts/start_backend.sh &

# Start the frontend
./scripts/start_frontend.sh &

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?
