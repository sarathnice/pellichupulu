import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = { DB: D1Database; MEDIA_BUCKET: R2Bucket; R2_DOMAIN: string }
const app = new Hono<{ Bindings: Bindings }>()
app.use('*', cors({ origin: '*', allowHeaders: ['*'], allowMethods: ['*'] }))

function parseUserId(value: FormDataEntryValue | string | null | undefined) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

app.get('/api/health', (c) => c.json({ 
  status: 'ok', 
  version: '2.3-ai',
  features: ['compression','thumbnails','30s-limit','background-removal','auto-captions','face-detection']
}))

// AI VIDEO UPLOAD
app.post('/api/upload/video', async (c) => {
  let form: FormData
  try {
    form = await c.req.formData()
  } catch {
    return c.json({ success: false, error: 'Invalid multipart form data' }, 400)
  }
  const videoEntry = form.get('video')
  const file = videoEntry instanceof File ? videoEntry : null
  const userId = parseUserId(form.get('user_id')) ?? 2
  const duration = parseFloat(form.get('duration') as string || '0')
  const faceData = form.get('face_data') as string
  const captions = form.get('captions') as string
  const hasBackgroundRemoval = form.get('bg_removed') === 'true'
  
  // Validations
  if (!file || !file.type || !file.type.startsWith('video/')) {
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
  if (faceData) {
    try {
      faceInfo = JSON.parse(faceData)
    } catch {
      return c.json({ success: false, error: 'Invalid face validation payload' }, 400)
    }
  }

  try {
    if (!faceInfo || !faceInfo.faceDetected) {
      return c.json({ success: false, error: 'No face detected. Please ensure your face is clearly visible' }, 400)
    }
    if (faceInfo.faceCount > 1) {
      return c.json({ success: false, error: 'Multiple faces detected. Please record alone' }, 400)
    }
    if (faceInfo.visibility < 0.7) {
      return c.json({ success: false, error: `Face not visible enough (${Math.round(faceInfo.visibility*100)}%). Need 70%+` }, 400)
    }
  } catch {
    return c.json({ success: false, error: 'Face validation failed' }, 400)
  }
  
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
  const thumbnailEntry = form.get('thumbnail')
  const thumbnail = thumbnailEntry instanceof File ? thumbnailEntry : null
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
  
  // Update D1 profile media and promote verification level for successful video upload.
  await c.env.DB.prepare(
    `INSERT INTO profiles (user_id, video_intro_url, video_thumbnail_url, verification_level, verified, updated_at)
     VALUES (?, ?, ?, 4, 1, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       video_intro_url = excluded.video_intro_url,
       video_thumbnail_url = excluded.video_thumbnail_url,
       verification_level = CASE
         WHEN profiles.verification_level IS NULL OR profiles.verification_level < 4 THEN 4
         ELSE profiles.verification_level
       END,
       verified = CASE
         WHEN profiles.verified IS NULL OR profiles.verified = 0 THEN 1
         ELSE profiles.verified
       END,
       updated_at = datetime('now')`
  ).bind(userId, videoUrl, thumbnailUrl).run()
  
  // Log
  await c.env.DB.prepare(
    `INSERT INTO admin_logs (admin_id, action, details) VALUES (?, 'ai_video_upload', ?)`
  ).bind(userId, JSON.stringify({ 
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
    face_validated: Boolean(faceInfo?.faceDetected),
    ai_features: {
      background_removed: hasBackgroundRemoval,
      captions_generated: !!captions,
      face_detected: faceInfo?.faceDetected
    }
  })
})

app.post('/api/upload/photo', async (c) => {
  let form: FormData
  try {
    form = await c.req.formData()
  } catch {
    return c.json({ success: false, error: 'Invalid multipart form data' }, 400)
  }
  const photoEntry = form.get('photo')
  const file = photoEntry instanceof File ? photoEntry : null
  const userId = parseUserId(form.get('user_id')) ?? 2
  const isPrimary = form.get('is_primary') === 'true'
  
  if (!file || !file.type || !file.type.startsWith('image/')) {
    return c.json({ success: false, error: 'Invalid photo' }, 400)
  }
  if (file.size > 10 * 1024 * 1024) {
    return c.json({ success: false, error: 'Max 10MB' }, 400)
  }
  
  const filename = `photos/${userId}/${Date.now()}.jpg`
  await c.env.MEDIA_BUCKET.put(filename, file.stream(), { httpMetadata: { contentType: 'image/jpeg' } })
  const url = `https://${c.env.R2_DOMAIN}/${filename}`
  
  if (isPrimary) {
    await c.env.DB.prepare(`UPDATE profiles SET profile_photo_url = ? WHERE user_id = ?`).bind(url, userId).run()
  }
  
  return c.json({ success: true, photo_url: url })
})

app.get('/api/profiles', async (c) => {
  const gender = c.req.query('gender')
  const statement = gender
    ? c.env.DB.prepare(
        `SELECT
          u.id,
          u.first_name AS firstName,
          u.last_name AS lastName,
          p.user_id AS userId,
          p.gender,
          p.age,
          p.current_city AS city,
          p.current_country AS country,
          p.profession,
          p.about_me AS aboutMe,
          p.verified,
          p.is_premium AS isPremium,
          p.profile_photo_url AS profilePhotoUrl,
          p.video_intro_url AS videoIntroUrl,
          p.video_thumbnail_url AS videoThumbnailUrl,
          p.last_active_at AS lastActiveAt
        FROM users u
        JOIN profiles p ON u.id = p.user_id
        WHERE u.status = 'active' AND p.is_active = 1 AND p.gender = ?
        ORDER BY p.last_active_at DESC
        LIMIT 20`
      ).bind(gender)
    : c.env.DB.prepare(
        `SELECT
          u.id,
          u.first_name AS firstName,
          u.last_name AS lastName,
          p.user_id AS userId,
          p.gender,
          p.age,
          p.current_city AS city,
          p.current_country AS country,
          p.profession,
          p.about_me AS aboutMe,
          p.verified,
          p.is_premium AS isPremium,
          p.profile_photo_url AS profilePhotoUrl,
          p.video_intro_url AS videoIntroUrl,
          p.video_thumbnail_url AS videoThumbnailUrl,
          p.last_active_at AS lastActiveAt
        FROM users u
        JOIN profiles p ON u.id = p.user_id
        WHERE u.status = 'active' AND p.is_active = 1
        ORDER BY p.last_active_at DESC
        LIMIT 20`
      )

  const { results } = await statement.all()
  return c.json({ profiles: results })
})

app.post('/api/users', async (c) => {
  const body = await c.req.json()
  const firstName = String(body.firstName || '').trim()
  const lastName = String(body.lastName || '').trim()
  const email = String(body.email || '').trim().toLowerCase()

  if (!firstName || !lastName || !email) {
    return c.json({ success: false, error: 'firstName, lastName, and email are required' }, 400)
  }

  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO users (first_name, last_name, email, status) VALUES (?, ?, ?, 'active')`
  ).bind(firstName, lastName, email).run()

  const { results } = await c.env.DB.prepare(
    `SELECT id, first_name AS firstName, last_name AS lastName, email FROM users WHERE email = ? LIMIT 1`
  ).bind(email).all()

  return c.json({ success: true, ...(results[0] || {}) })
})

app.post('/api/profiles', async (c) => {
  const body = await c.req.json()
  const firstName = String(body.firstName || '').trim()
  const lastName = String(body.lastName || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const gender = String(body.gender || '').trim().toLowerCase()
  const age = Number.parseInt(String(body.age || ''), 10)
  const city = String(body.city || '').trim()
  const country = String(body.country || '').trim()
  const profession = String(body.profession || '').trim()
  const aboutMe = String(body.aboutMe || '').trim()

  if (!firstName || !lastName || !email) {
    return c.json({ success: false, error: 'firstName, lastName, and email are required' }, 400)
  }

  let userId = parseUserId(body.userId)

  if (!userId) {
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO users (first_name, last_name, email, status) VALUES (?, ?, ?, 'active')`
    ).bind(firstName, lastName, email).run()

    const { results } = await c.env.DB.prepare(
      `SELECT id FROM users WHERE email = ? LIMIT 1`
    ).bind(email).all()

    userId = parseUserId(results[0]?.id)
  }

  if (!userId) {
    return c.json({ success: false, error: 'Unable to create profile user' }, 500)
  }

  await c.env.DB.prepare(
    `INSERT INTO profiles (user_id, gender, age, current_city, current_country, profession, about_me, profile_completion, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 40, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET
       gender = excluded.gender,
       age = excluded.age,
       current_city = excluded.current_city,
       current_country = excluded.current_country,
       profession = excluded.profession,
       about_me = excluded.about_me,
       updated_at = datetime('now')`
  ).bind(userId, gender || null, Number.isNaN(age) ? null : age, city || null, country || null, profession || null, aboutMe || null).run()

  return c.json({ success: true, userId })
})

export default app
