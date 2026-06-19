#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "Pulling latest code..."
git pull

echo "Installing dependencies..."
npm install

echo "Building..."
npm run build

echo "Restarting app..."
pm2 restart stocks

echo "Done."
