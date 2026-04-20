# PelliChupulu v2.3 AI - Full Suite

Features:
✓ Face detection (face-api.js)
✓ Background removal (MediaPipe)
✓ Auto captions (Web Speech API)
✓ 30s limit, compression, thumbnails
✓ All client-side, uploads to R2

Deploy:
npx wrangler deploy
npm i && npm run build
npx wrangler pages deploy dist --project-name=pellichupulu
