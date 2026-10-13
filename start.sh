#!/usr/bin/env bash
# ==============================================================================
# NASA Open MCT VR Mission Control - One-Click Launcher
# ==============================================================================

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "================================================================="
echo "   🚀 Starting NASA Open MCT VR Mission Control Server..."
echo "================================================================="

# Stop any previous hanging server instances
pkill -f "node server.js" 2>/dev/null
sleep 1

# Start the Node.js server
node server.js
