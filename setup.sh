#!/bin/bash
set -e

echo "🚀 Pellichupulu Automated Setup"
echo "================================"
echo ""

# Check dependencies
command -v node >/dev/null 2>&1 || { echo "Install Node.js 20+"; exit 1; }
command -v git >/dev/null 2>&1 || { echo "Install git"; exit 1; }

echo "✓ Dependencies OK"
echo ""

# Install
echo "1/5 Installing dependencies..."
npm install

# Login
echo ""
echo "2/5 Cloudflare login..."
npx wrangler login

# Create D1
echo ""
echo "3/5 Creating D1 database..."
npx wrangler d1 create pellichupulu-db

echo ""
echo "⚠️  COPY the database_id above!"
read -p "Press Enter after copying..."

echo ""
echo "4/5 Update wrangler.toml with your database_id"
read -p "Press Enter when done..."

# Create schema
echo ""
echo "5/5 Creating database schema..."
npm run db:schema

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update wrangler.toml with your IDs"
echo "2. Run: npm run deploy"
echo "3. Setup GitHub secrets for auto-deploy"
