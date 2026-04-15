// src/db/schema.ts
// Drizzle ORM schema for Cloudflare D1
// Type-safe database access

import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users table
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  googleId: text('google_id').unique(),
  email: text('email').notNull().unique(),
  phone: text('phone').unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  role: text('role', { enum: ['user', 'admin', 'moderator'] }).default('user'),
  status: text('status', { enum: ['active', 'suspended', 'deleted', 'pending'] }).default('active'),
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
  phoneVerified: integer('phone_verified', { mode: 'boolean' }).default(false),
  referralCode: text('referral_code').unique(),
  referredBy: integer('referred_by').references(() => users.id),
  createdAt: text('created_at').default(sql`datetime('now')`),
  updatedAt: text('updated_at').default(sql`datetime('now')`),
  lastLoginAt: text('last_login_at'),
  deletedAt: text('deleted_at'),
});

// Profiles table
export const profiles = sqliteTable('profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  
  // Basic
  gender: text('gender', { enum: ['male', 'female', 'other'] }),
  dateOfBirth: text('date_of_birth'),
  age: integer('age'),
  heightCm: integer('height_cm'),
  
  // Cultural
  religion: text('religion'),
  caste: text('caste'),
  subCaste: text('sub_caste'),
  motherTongue: text('mother_tongue').default('Telugu'),
  languagesKnown: text('languages_known'), // JSON
  
  // Professional
  educationLevel: text('education_level'),
  educationField: text('education_field'),
  profession: text('profession'),
  company: text('company'),
  annualIncome: text('annual_income'),
  workLocationCity: text('work_location_city'),
  workLocationCountry: text('work_location_country'),
  
  // Location
  currentCity: text('current_city'),
  currentState: text('current_state'),
  currentCountry: text('current_country'),
  hometownCity: text('hometown_city'),
  hometownState: text('hometown_state'),
  citizenship: text('citizenship'),
  visaStatus: text('visa_status'),
  
  // Lifestyle
  diet: text('diet', { enum: ['veg', 'non-veg', 'eggetarian', 'vegan', 'jain'] }),
  smoking: text('smoking', { enum: ['never', 'occasionally', 'regularly'] }),
  drinking: text('drinking', { enum: ['never', 'occasionally', 'socially', 'regularly'] }),
  maritalStatus: text('marital_status', { enum: ['never_married', 'divorced', 'widowed', 'awaiting_divorce'] }),
  
  // About
  aboutMe: text('about_me'),
  familyDetails: text('family_details'),
  partnerPreferences: text('partner_preferences'), // JSON
  
  // Media
  profilePhotoUrl: text('profile_photo_url'),
  photoUrls: text('photo_urls'), // JSON
  videoIntroUrl: text('video_intro_url'),
  videoThumbnailUrl: text('video_thumbnail_url'),
  
  // Verification
  verified: integer('verified', { mode: 'boolean' }).default(false),
  verificationLevel: integer('verification_level').default(0),
  idVerificationStatus: text('id_verification_status', { enum: ['pending', 'approved', 'rejected'] }).default('pending'),
  idVerificationDocumentUrl: text('id_verification_document_url'),
  
  // Matching
  profileCompletion: integer('profile_completion').default(0),
  lastActiveAt: text('last_active_at').default(sql`datetime('now')`),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  isPremium: integer('is_premium', { mode: 'boolean' }).default(false),
  premiumExpiresAt: text('premium_expires_at'),
  
  createdAt: text('created_at').default(sql`datetime('now')`),
  updatedAt: text('updated_at').default(sql`datetime('now')`),
});

// Connections table
export const connections = sqliteTable('connections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  requesterId: integer('requester_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  receiverId: integer('receiver_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['pending', 'accepted', 'rejected', 'blocked', 'unmatched'] }).default('pending'),
  initiatorAction: text('initiator_action', { enum: ['like', 'superlike'] }),
  message: text('message'),
  compatibilityScore: integer('compatibility_score'),
  createdAt: text('created_at').default(sql`datetime('now')`),
  updatedAt: text('updated_at').default(sql`datetime('now')`),
  respondedAt: text('responded_at'),
});

// Messages table
export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  connectionId: integer('connection_id').notNull().references(() => connections.id, { onDelete: 'cascade' }),
  senderId: integer('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  messageText: text('message_text'),
  messageType: text('message_type', { enum: ['text', 'image', 'video', 'audio', 'system'] }).default('text'),
  mediaUrl: text('media_url'),
  replyToId: integer('reply_to_id').references(() => messages.id),
  isRead: integer('is_read', { mode: 'boolean' }).default(false),
  readAt: text('read_at'),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`datetime('now')`),
});

// Referrals table
export const referrals = sqliteTable('referrals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  referrerId: integer('referrer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  friendEmail: text('friend_email'),
  friendUserId: integer('friend_user_id').references(() => users.id),
  status: text('status', { enum: ['pending', 'signed_up', 'completed', 'expired'] }).default('pending'),
  rewardType: text('reward_type').default('premium_months'),
  rewardValue: integer('reward_value').default(1),
  rewardClaimed: integer('reward_claimed', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`datetime('now')`),
  completedAt: text('completed_at'),
  expiresAt: text('expires_at'),
});

// Subscriptions table
export const subscriptions = sqliteTable('subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  plan: text('plan', { enum: ['free', 'premium', 'elite', 'concierge'] }).notNull(),
  status: text('status', { enum: ['active', 'cancelled', 'expired', 'past_due'] }).default('active'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  currentPeriodStart: text('current_period_start'),
  currentPeriodEnd: text('current_period_end'),
  cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`datetime('now')`),
  updatedAt: text('updated_at').default(sql`datetime('now')`),
});


// Payments table
export const payments = sqliteTable('payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  subscriptionId: integer('subscription_id').references(() => subscriptions.id),
  amountCents: integer('amount_cents').notNull(),
  currency: text('currency').default('USD'),
  status: text('status', { enum: ['pending', 'succeeded', 'failed', 'refunded'] }),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  description: text('description'),
  createdAt: text('created_at').default(sql`datetime('now')`),
});

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Connection = typeof connections.$inferSelect;
export type Message = typeof messages.$inferSelect;
