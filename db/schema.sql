-- =====================================================
-- PELLICHUPULU - Complete D1 Database Schema
-- Brand new application - Cloudflare D1 (SQLite)
-- Version: 2.0
-- =====================================================

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------
-- Table: users
-- Core user authentication and account info
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_id TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin', 'moderator')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'deleted', 'pending')),
  email_verified INTEGER DEFAULT 0,
  phone_verified INTEGER DEFAULT 0,
  referral_code TEXT UNIQUE,
  referred_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  last_login_at TEXT,
  deleted_at TEXT,
  FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_referral ON users(referral_code);
CREATE INDEX idx_users_status ON users(status);

-- -----------------------------------------------------
-- Table: profiles
-- Detailed matrimony profiles
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  
  -- Basic info
  gender TEXT CHECK(gender IN ('male', 'female', 'other')),
  date_of_birth TEXT,
  age INTEGER,
  height_cm INTEGER,
  
  -- Cultural
  religion TEXT,
  caste TEXT,
  sub_caste TEXT,
  mother_tongue TEXT DEFAULT 'Telugu',
  languages_known TEXT, -- JSON array
  
  -- Professional
  education_level TEXT,
  education_field TEXT,
  profession TEXT,
  company TEXT,
  annual_income TEXT,
  work_location_city TEXT,
  work_location_country TEXT,
  
  -- Location
  current_city TEXT,
  current_state TEXT,
  current_country TEXT,
  hometown_city TEXT,
  hometown_state TEXT,
  citizenship TEXT,
  visa_status TEXT, -- H1B, GC, Citizen, etc.
  
  -- Lifestyle
  diet TEXT CHECK(diet IN ('veg', 'non-veg', 'eggetarian', 'vegan', 'jain')),
  smoking TEXT CHECK(smoking IN ('never', 'occasionally', 'regularly')),
  drinking TEXT CHECK(drinking IN ('never', 'occasionally', 'socially', 'regularly')),
  marital_status TEXT CHECK(marital_status IN ('never_married', 'divorced', 'widowed', 'awaiting_divorce')),
  
  -- About
  about_me TEXT,
  family_details TEXT,
  partner_preferences TEXT, -- JSON
  
  -- Media
  profile_photo_url TEXT,
  photo_urls TEXT, -- JSON array
  video_intro_url TEXT,
  video_thumbnail_url TEXT,
  
  -- Verification
  verified INTEGER DEFAULT 0,
  verification_level INTEGER DEFAULT 0, -- 0=none, 1=email, 2=phone, 3=id, 4=video
  id_verification_status TEXT DEFAULT 'pending' CHECK(id_verification_status IN ('pending', 'approved', 'rejected')),
  id_verification_document_url TEXT,
  
  -- Matching
  profile_completion INTEGER DEFAULT 0,
  last_active_at TEXT DEFAULT (datetime('now')),
  is_active INTEGER DEFAULT 1,
  is_premium INTEGER DEFAULT 0,
  premium_expires_at TEXT,
  
  -- Timestamps
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_gender ON profiles(gender);
CREATE INDEX idx_profiles_age ON profiles(age);
CREATE INDEX idx_profiles_location ON profiles(current_country, current_city);
CREATE INDEX idx_profiles_verified ON profiles(verified);
CREATE INDEX idx_profiles_active ON profiles(is_active, last_active_at);
CREATE INDEX idx_profiles_premium ON profiles(is_premium);
CREATE INDEX idx_profiles_visa ON profiles(visa_status);

-- -----------------------------------------------------
-- Table: connections
-- Like/pass and matches
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id INTEGER NOT NULL,
  receiver_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'blocked', 'unmatched')),
  initiator_action TEXT CHECK(initiator_action IN ('like', 'superlike')),
  message TEXT,
  compatibility_score INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  responded_at TEXT,
  FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(requester_id, receiver_id)
);

CREATE INDEX idx_connections_requester ON connections(requester_id);
CREATE INDEX idx_connections_receiver ON connections(receiver_id);
CREATE INDEX idx_connections_status ON connections(status);
CREATE INDEX idx_connections_created ON connections(created_at);

-- -----------------------------------------------------
-- Table: messages
-- Real-time chat
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  connection_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  message_text TEXT,
  message_type TEXT DEFAULT 'text' CHECK(message_type IN ('text', 'image', 'video', 'audio', 'system')),
  media_url TEXT,
  reply_to_id INTEGER,
  is_read INTEGER DEFAULT 0,
  read_at TEXT,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL
);

CREATE INDEX idx_messages_connection ON messages(connection_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_messages_unread ON messages(connection_id, is_read);

-- -----------------------------------------------------
-- Table: referrals
-- Viral growth
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  referrer_id INTEGER NOT NULL,
  friend_email TEXT,
  friend_user_id INTEGER,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'signed_up', 'completed', 'expired')),
  reward_type TEXT DEFAULT 'premium_months',
  reward_value INTEGER DEFAULT 1,
  reward_claimed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  expires_at TEXT,
  FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (friend_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_referrals_code ON referrals(code);
CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_friend ON referrals(friend_user_id);

-- -----------------------------------------------------
-- Table: verifications
-- ID and document verification
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  verification_type TEXT NOT NULL CHECK(verification_type IN ('email', 'phone', 'government_id', 'video', 'linkedin', 'education', 'employment')),
  document_url TEXT,
  document_type TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'expired')),
  reviewed_by INTEGER,
  reviewed_at TEXT,
  rejection_reason TEXT,
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_verifications_user ON verifications(user_id);
CREATE INDEX idx_verifications_status ON verifications(status);
CREATE INDEX idx_verifications_type ON verifications(verification_type);

-- -----------------------------------------------------
-- Table: subscriptions
-- Premium memberships
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  plan TEXT NOT NULL CHECK(plan IN ('free', 'premium', 'elite', 'concierge')),
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'cancelled', 'expired', 'past_due')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TEXT,
  current_period_end TEXT,
  cancel_at_period_end INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_customer_id);

-- -----------------------------------------------------
-- Table: payments
-- Transaction history
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  subscription_id INTEGER,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT CHECK(status IN ('pending', 'succeeded', 'failed', 'refunded')),
  stripe_payment_intent_id TEXT,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
);

CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);

-- -----------------------------------------------------
-- Table: user_preferences
-- Matching preferences
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  age_min INTEGER DEFAULT 18,
  age_max INTEGER DEFAULT 60,
  height_min_cm INTEGER,
  height_max_cm INTEGER,
  religions TEXT, -- JSON array
  castes TEXT, -- JSON array
  locations TEXT, -- JSON array of countries/cities
  education_levels TEXT, -- JSON
  professions TEXT, -- JSON
  diet_preferences TEXT, -- JSON
  marital_statuses TEXT, -- JSON
  visa_statuses TEXT, -- JSON
  show_verified_only INTEGER DEFAULT 0,
  show_premium_only INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -----------------------------------------------------
-- Table: profile_views
-- Track who viewed whom
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS profile_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  viewer_id INTEGER NOT NULL,
  viewed_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (viewer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (viewed_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(viewer_id, viewed_id, date(created_at))
);

CREATE INDEX idx_views_viewer ON profile_views(viewer_id);
CREATE INDEX idx_views_viewed ON profile_views(viewed_id);

-- -----------------------------------------------------
-- Table: blocks_reports
-- Safety and moderation
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS blocks_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL,
  reported_id INTEGER NOT NULL,
  type TEXT CHECK(type IN ('block', 'report')),
  reason TEXT,
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  created_at TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT,
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reported_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_blocks_reporter ON blocks_reports(reporter_id);
CREATE INDEX idx_blocks_reported ON blocks_reports(reported_id);

-- -----------------------------------------------------
-- Table: notifications
-- In-app and push notifications
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data TEXT, -- JSON
  is_read INTEGER DEFAULT 0,
  read_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- -----------------------------------------------------
-- Table: admin_logs
-- Admin activity tracking
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id INTEGER,
  details TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_admin_logs_admin ON admin_logs(admin_id);
CREATE INDEX idx_admin_logs_created ON admin_logs(created_at);

-- =====================================================
-- SEED DATA - Sample admin user
-- =====================================================
INSERT INTO users (id, email, first_name, last_name, role, status, email_verified) 
VALUES (1, 'admin@pellichupulu.ai', 'Admin', 'User', 'admin', 'active', 1);

INSERT INTO users (id, email, first_name, last_name, referral_code, status, email_verified)
VALUES 
  (2, 'demo@pellichupulu.ai', 'Demo', 'User', 'DEMO001', 'active', 1);

INSERT INTO profiles (user_id, gender, age, current_city, current_country, profession, verified, profile_completion)
VALUES 
  (2, 'female', 28, 'Dallas', 'USA', 'Software Engineer', 1, 85);

INSERT INTO subscriptions (user_id, plan, status, current_period_end)
VALUES 
  (1, 'elite', 'active', datetime('now', '+1 year')),
  (2, 'premium', 'active', datetime('now', '+30 days'));

-- =====================================================
-- VIEWS - Useful queries
-- =====================================================
CREATE VIEW IF NOT EXISTS active_profiles AS
SELECT 
  u.id, u.email, u.first_name, u.last_name,
  p.gender, p.age, p.current_city, p.current_country,
  p.profession, p.verified, p.is_premium,
  p.profile_photo_url, p.last_active_at
FROM users u
JOIN profiles p ON u.id = p.user_id
WHERE u.status = 'active' AND p.is_active = 1;

CREATE VIEW IF NOT EXISTS match_stats AS
SELECT 
  u.id,
  COUNT(DISTINCT c1.id) as likes_sent,
  COUNT(DISTINCT c2.id) as likes_received,
  COUNT(DISTINCT CASE WHEN c1.status = 'accepted' THEN c1.id END) as matches
FROM users u
LEFT JOIN connections c1 ON u.id = c1.requester_id
LEFT JOIN connections c2 ON u.id = c2.receiver_id
GROUP BY u.id;
