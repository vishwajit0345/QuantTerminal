#!/bin/bash
echo ""
echo "  BLOOMBERG  QUANTPORTPRO TERMINAL v5.0"
echo "  Portfolio Optimization System"
echo ""

command -v node &>/dev/null || { echo "Node.js not found. Install from nodejs.org"; exit 1; }
echo "✓ Node.js $(node -v)"

[ ! -d "node_modules" ] && { echo "Installing dependencies..."; npm install; }
echo "✓ Dependencies ready"
echo ""
echo "  Starting at: http://localhost:5173"
echo "  Press Ctrl+C to stop"
echo ""

(sleep 2 && (open http://localhost:5173 2>/dev/null || xdg-open http://localhost:5173 2>/dev/null)) &
npm run dev
