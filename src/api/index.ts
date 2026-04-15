// src/api/index.ts
// Complete CRUD API for Pellichupulu
// Cloudflare Worker with D1

import { drizzle } from 'drizzle-orm/d1';
import { eq, and, or, desc, sql, like, inArray } from 'drizzle-orm';
import * as schema from '../db/schema';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const db = drizzle(env.DB);
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') return new Response(null, { headers: cors });

    try {
      // ===== USERS =====
      if (path === '/api/users' && method === 'POST') {
        const data = await request.json();
        const [user] = await db.insert(schema.users).values({
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          googleId: data.googleId,
          referralCode: generateReferralCode(),
        }).returning();
        return json({ user });
      }

      if (path.match(/^\/api\/users\/\d+$/) && method === 'GET') {
        const id = parseInt(path.split('/')[3]);
        const user = await db.query.users.findFirst({
          where: eq(schema.users.id, id),
          with: { profile: true }
        });
        return json({ user });
      }

      // ===== PROFILES =====
      if (path === '/api/profiles' && method === 'POST') {
        const data = await request.json();
        const [profile] = await db.insert(schema.profiles).values({
          userId: data.userId,
          gender: data.gender,
          age: data.age,
          currentCity: data.currentCity,
          currentCountry: data.currentCountry,
          profession: data.profession,
          aboutMe: data.aboutMe,
        }).returning();
        return json({ profile });
      }

      if (path === '/api/profiles' && method === 'GET') {
        const gender = url.searchParams.get('gender');
        const ageMin = parseInt(url.searchParams.get('ageMin') || '18');
        const ageMax = parseInt(url.searchParams.get('ageMax') || '60');
        const country = url.searchParams.get('country');
        const verified = url.searchParams.get('verified') === 'true';

        let query = db.select().from(schema.profiles)
          .innerJoin(schema.users, eq(schema.profiles.userId, schema.users.id))
          .where(and(
            eq(schema.profiles.isActive, true),
            gender ? eq(schema.profiles.gender, gender) : undefined,
            country ? eq(schema.profiles.currentCountry, country) : undefined,
            verified ? eq(schema.profiles.verified, true) : undefined,
          ))
          .orderBy(desc(schema.profiles.verified), desc(schema.profiles.lastActiveAt))
          .limit(20);

        const profiles = await query;
        return json({ profiles });
      }

      if (path.match(/^\/api\/profiles\/\d+$/) && method === 'PUT') {
        const userId = parseInt(path.split('/')[3]);
        const data = await request.json();
        const [updated] = await db.update(schema.profiles)
          .set({ ...data, updatedAt: new Date().toISOString() })
          .where(eq(schema.profiles.userId, userId))
          .returning();
        return json({ profile: updated });
      }

      // ===== CONNECTIONS (Likes/Matches) =====
      if (path === '/api/connections' && method === 'POST') {
        const { requesterId, receiverId, action } = await request.json();
        
        // Check if reverse connection exists (mutual like)
        const existing = await db.query.connections.findFirst({
          where: and(
            eq(schema.connections.requesterId, receiverId),
            eq(schema.connections.receiverId, requesterId)
          )
        });

        if (existing && action === 'like') {
          // It's a match!
          await db.update(schema.connections)
            .set({ status: 'accepted', respondedAt: new Date().toISOString() })
            .where(eq(schema.connections.id, existing.id));
          
          const [match] = await db.insert(schema.connections).values({
            requesterId,
            receiverId,
            status: 'accepted',
            initiatorAction: action,
          }).returning();
          
          return json({ match, isNewMatch: true });
        }

        const [connection] = await db.insert(schema.connections).values({
          requesterId,
          receiverId,
          initiatorAction: action,
          status: 'pending',
        }).returning();
        
        return json({ connection, isNewMatch: false });
      }

      if (path === '/api/connections' && method === 'GET') {
        const userId = parseInt(url.searchParams.get('userId') || '0');
        const status = url.searchParams.get('status') || 'accepted';
        
        const connections = await db.query.connections.findMany({
          where: and(
            or(
              eq(schema.connections.requesterId, userId),
              eq(schema.connections.receiverId, userId)
            ),
            eq(schema.connections.status, status)
          ),
          with: {
            requester: true,
            receiver: true,
          },
          orderBy: desc(schema.connections.updatedAt),
        });
        
        return json({ connections });
      }

      // ===== MESSAGES =====
      if (path === '/api/messages' && method === 'POST') {
        const { connectionId, senderId, messageText } = await request.json();
        const [message] = await db.insert(schema.messages).values({
          connectionId,
          senderId,
          messageText,
        }).returning();
        return json({ message });
      }

      if (path === '/api/messages' && method === 'GET') {
        const connectionId = parseInt(url.searchParams.get('connectionId') || '0');
        const messages = await db.query.messages.findMany({
          where: eq(schema.messages.connectionId, connectionId),
          orderBy: desc(schema.messages.createdAt),
          limit: 50,
        });
        return json({ messages: messages.reverse() });
      }

      // ===== REFERRALS =====
      if (path === '/api/referrals' && method === 'POST') {
        const { referrerId, friendEmail } = await request.json();
        const code = generateReferralCode();
        
        const [referral] = await db.insert(schema.referrals).values({
          code,
          referrerId,
          friendEmail,
          expiresAt: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
        }).returning();
        
        return json({ 
          referral,
          link: `https://pellichupulu.ai/join?ref=${code}`
        });
      }

      // ===== SEARCH =====
      if (path === '/api/search' && method === 'GET') {
        const q = url.searchParams.get('q') || '';
        const results = await db.select().from(schema.profiles)
          .innerJoin(schema.users, eq(schema.profiles.userId, schema.users.id))
          .where(or(
            like(schema.users.firstName, `%${q}%`),
            like(schema.users.lastName, `%${q}%`),
            like(schema.profiles.profession, `%${q}%`),
            like(schema.profiles.currentCity, `%${q}%`)
          ))
          .limit(20);
        return json({ results });
      }

      return new Response('Not Found', { status: 404, headers: cors });
      
    } catch (error) {
      return json({ error: error.message }, 500);
    }
  }
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

function generateReferralCode(): string {
  return 'PELLI' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

interface Env {
  DB: D1Database;
}
