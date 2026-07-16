#!/bin/bash
# This is a shell script used to start the program, can be called on OS startup to auto start the program
# Don't forget to make this file executable with chmod +x scripts/begin.sh
# Resolve the project root from this script's location.

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." || exit 1
exec npm start
