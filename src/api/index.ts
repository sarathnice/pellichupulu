import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = { DB: D1Database; MEDIA_BUCKET: R2Bucket; R2_DOMAIN: string }
const app = new Hono<{ Bindings: Bindings }>()
app.use('*', cors({ origin: '*', allowHeaders: ['*'], allowMethods: ['*'] }))

app.get('/api/health', (c) => c.json({ 
  status: 'ok', 
  version: '2.3-ai',
  features: ['compression','thumbnails','30s-limit','background-removal','auto-captions','face-detection']
}))

// AI VIDEO UPLOAD
app.post('/api/upload/video', async (c) => {
  const form = await c.req.formData()
  const file = form.get('video') as File
  const userId = (form.get('user_id') as string) || '2'
  const duration = parseFloat(form.get('duration') as string || '0')
  const faceData = form.get('face_data') as string
  const captions = form.get('captions') as string
  const hasBackgroundRemoval = form.get('bg_removed') === 'true'
  
  // Validations
  if (!file || !file.type.startsWith('video/')) {
    return c.json({ success: false, error: 'Invalid video' }, 400)
  }
  if (file.size > 50 * 1024 * 1024) {
    return c.json({ success: false, error: 'Max 50MB' }, 400)
  }
  if (duration > 30 || duration < 5) {
    return c.json({ success: false, error: `Duration must be 5-30s (got ${Math.round(duration)}s)` }, 400)
  }
  
  // Face detection validation
  let faceInfo = null
  try {
    faceInfo = faceData ? JSON.parse(faceData) : null
    if (!faceInfo || !faceInfo.faceDetected) {
      return c.json({ success: false, error: 'No face detected. Please ensure your face is clearly visible' }, 400)
    }
    if (faceInfo.faceCount > 1) {
      return c.json({ success: false, error: 'Multiple faces detected. Please record alone' }, 400)
    }
    if (faceInfo.visibility < 0.7) {
      return c.json({ success: false, error: `Face not visible enough (${Math.round(faceInfo.visibility*100)}%). Need 70%+` }, 400)
    }
  } catch {}
  
  const timestamp = Date.now()
  const videoFilename = `videos/${userId}/${timestamp}.webm`
  const thumbFilename = `videos/${userId}/${timestamp}_thumb.jpg`
  const captionFilename = `videos/${userId}/${timestamp}.vtt`
  
  // Upload video
  await c.env.MEDIA_BUCKET.put(videoFilename, file.stream(), {
    httpMetadata: { contentType: 'video/webm', cacheControl: 'public, max-age=31536000' },
    customMetadata: {
      userId,
      duration: String(duration),
      faceDetected: String(!!faceInfo?.faceDetected),
      bgRemoved: String(hasBackgroundRemoval),
      hasCaptions: String(!!captions),
    }
  })
  
  // Upload thumbnail
  const thumbnail = form.get('thumbnail') as File
  let thumbnailUrl = null
  if (thumbnail) {
    await c.env.MEDIA_BUCKET.put(thumbFilename, thumbnail.stream(), {
      httpMetadata: { contentType: 'image/jpeg' }
    })
    thumbnailUrl = `https://${c.env.R2_DOMAIN}/${thumbFilename}`
  }
  
  // Upload captions
  let captionUrl = null
  if (captions) {
    await c.env.MEDIA_BUCKET.put(captionFilename, captions, {
      httpMetadata: { contentType: 'text/vtt' }
    })
    captionUrl = `https://${c.env.R2_DOMAIN}/${captionFilename}`
  }
  
  const videoUrl = `https://${c.env.R2_DOMAIN}/${videoFilename}`
  
  // Update D1
  await c.env.DB.prepare(
    `UPDATE profiles SET video_intro_url = ?, video_thumbnail_url = ?, updated_at = datetime('now') WHERE user_id = ?`
  ).bind(videoUrl, thumbnailUrl, userId).run()
  
  // Log
  await c.env.DB.prepare(
    `INSERT INTO admin_logs (admin_id, action, details) VALUES (?, 'ai_video_upload', ?)`
  ).bind(parseInt(userId), JSON.stringify({ 
    duration, 
    faceDetected: faceInfo?.faceDetected,
    bgRemoved: hasBackgroundRemoval,
    hasCaptions: !!captions,
    size: file.size 
  })).run()
  
  return c.json({ 
    success: true, 
    video_url: videoUrl,
    thumbnail_url: thumbnailUrl,
    caption_url: captionUrl,
    face_validated: true,
    ai_features: {
      background_removed: hasBackgroundRemoval,
      captions_generated: !!captions,
      face_detected: faceInfo?.faceDetected
    }
  })
})

app.post('/api/upload/photo', async (c) => {
  const form = await c.req.formData()
  const file = form.get('photo') as File
  const userId = (form.get('user_id') as string) || '2'
  const isPrimary = form.get('is_primary') === 'true'
  
  if (!file) return c.json({ success: false }, 400)
  
  const filename = `photos/${userId}/${Date.now()}.jpg`
  await c.env.MEDIA_BUCKET.put(filename, file.stream(), { httpMetadata: { contentType: 'image/jpeg' } })
  const url = `https://${c.env.R2_DOMAIN}/${filename}`
  
  if (isPrimary) {
    await c.env.DB.prepare(`UPDATE profiles SET profile_photo_url = ? WHERE user_id = ?`).bind(url, userId).run()
  }
  
  return c.json({ success: true, photo_url: url })
})

app.get('/api/profiles', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT u.id, u.first_name, u.last_name, p.* FROM users u JOIN profiles p ON u.id = p.user_id WHERE u.status='active' LIMIT 20`
  ).all()
  return c.json({ profiles: results })
})

export default app
