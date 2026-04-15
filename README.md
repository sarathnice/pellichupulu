<<<<<<< HEAD
# Pellichupulu.ai - Complete Deployment Guide

AI-powered Telugu matrimony platform on Cloudflare.

## 🚀 One-Time Setup (Automated)

### Prerequisites
- Cloudflare account
- GitHub account
- Node.js 20+

### Step 1: Clone and Setup (2 minutes)
```bash
git clone https://github.com/YOURUSERNAME/pellichupulu.git
cd pellichupulu
npm install
```

### Step 2: Create Cloudflare Resources (3 minutes)
```bash
# Login to Cloudflare
npx wrangler login

# Create D1 database
npm run db:create
# Copy the database_id from output

# Create R2 bucket
npx wrangler r2 bucket create pellichupulu-media

# Update wrangler.toml with your database_id
```

### Step 3: Deploy Database Schema (1 minute)
```bash
npm run db:schema
```

### Step 4: Deploy to Cloudflare (1 minute)
```bash
npm run deploy
```

### Step 5: Setup GitHub Actions (2 minutes)
1. Go to GitHub repo → Settings → Secrets → Actions
2. Add secrets:
   - `CLOUDFLARE_API_TOKEN` (create at dash.cloudflare.com/profile/api-tokens)
   - `CLOUDFLARE_ACCOUNT_ID` (from Cloudflare dashboard)
3. Push to main → auto-deploys

## 📁 Project Structure
```
├── db/
│   └── schema.sql          # Complete database schema
├── src/
│   ├── db/schema.ts        # Drizzle ORM types
│   ├── api/index.ts        # API endpoints
│   └── admin/queries.ts    # Admin queries
├── frontend/
│   └── index.html          # Website
├── .github/workflows/
│   └── deploy.yml          # Auto-deploy
├── wrangler.toml           # Cloudflare config
└── package.json
```

## 🔧 Daily Development
```bash
# Local dev
npm run dev

# Deploy changes
git add .
git commit -m "update feature"
git push
# → Auto-deploys to Cloudflare in 45 seconds
```

## 📊 Database Management
```bash
# View data
npx wrangler d1 execute pellichupulu-db --command="SELECT * FROM users LIMIT 10" --remote

# Backup
npx wrangler d1 export pellichupulu-db --output=backup.sql

# Run migrations
npm run db:schema
```

## ✅ Verification Checklist
After deployment:
- [ ] https://pellichupulu.ai loads
- [ ] https://api.pellichupulu.ai works
- [ ] D1 database has 13 tables
- [ ] R2 bucket created
- [ ] GitHub Actions passing
=======
# pellichupulu
>>>>>>> 155366dae825cfc09a3798f207a27d53c7cf89e1
