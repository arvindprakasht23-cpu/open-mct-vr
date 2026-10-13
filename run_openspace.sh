#!/usr/bin/env bash
export DISPLAY="${DISPLAY:-:1}"
export LD_LIBRARY_PATH="/home/stark/OpenSpace_bin/usr/lib/openspace/bin:/home/stark/OpenSpace_bin/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH}"
cd /home/stark/OpenSpace_bin/usr/lib/openspace
exec ./bin/OpenSpace --bypassLauncher "$@"
