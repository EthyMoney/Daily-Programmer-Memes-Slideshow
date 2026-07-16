#!/bin/bash
# This is a shell script used to start the program, can be called on OS startup to auto start the program
# Don't forget to make this file executable with sudo chmod +x begin.sh
# The script starts the copy of the app located beside this file.

cd -- "$(dirname -- "${BASH_SOURCE[0]}")" || exit 1
exec npm start
