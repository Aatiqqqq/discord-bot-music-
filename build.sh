#!/usr/bin/env bash

set -e

echo "Installing Python and yt-dlp..."

python3 --version

python3 -m pip install --upgrade pip

python3 -m pip install --upgrade yt-dlp

echo "yt-dlp installed successfully."

yt-dlp --version

npm install
