// src/admin/queries.ts
// Admin panel database queries

import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, sql, and, gte, count } from 'drizzle-orm';
import * as schema from '../db/schema';

export class AdminQueries {
  constructor(private db: ReturnType<typeof drizzle>) {}

  // Dashboard stats
  async getDashboardStats() {
    const [users, profiles, connections, messages] = await Promise.all([
      this.db.select({ count: count() }).from(schema.users),
      this.db.select({ count: count() }).from(schema.profiles).where(eq(schema.profiles.verified, true)),
      this.db.select({ count: count() }).from(schema.connections).where(eq(schema.connections.status, 'accepted')),
      this.db.select({ count: count() }).from(schema.messages),
    ]);

    const recentUsers = await this.db.select()
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt))
      .limit(5);

    return {
      totalUsers: users[0].count,
      verifiedProfiles: profiles[0].count,
      totalMatches: connections[0].count,
      totalMessages: messages[0].count,
      recentUsers,
    };
  }

  // User management
  async getUsers(page = 1, limit = 20, search = '') {
    const offset = (page - 1) * limit;
    
    let query = this.db.select({
      id: schema.users.id,
      email: schema.users.email,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      status: schema.users.status,
      createdAt: schema.users.createdAt,
      profile: {
        age: schema.profiles.age,
        currentCity: schema.profiles.currentCity,
        currentCountry: schema.profiles.currentCountry,
        verified: schema.profiles.verified,
        isPremium: schema.profiles.isPremium,
      }
    })
    .from(schema.users)
    .leftJoin(schema.profiles, eq(schema.users.id, schema.profiles.userId))
    .orderBy(desc(schema.users.createdAt))
    .limit(limit)
    .offset(offset);

    if (search) {
      query = query.where(
        sql`${schema.users.email} LIKE ${'%' + search + '%'} OR 
            ${schema.users.firstName} LIKE ${'%' + search + '%'}`
      );
    }

    return await query;
  }

  async suspendUser(userId: number, reason: string) {
    await this.db.update(schema.users)
      .set({ status: 'suspended', updatedAt: new Date().toISOString() })
      .where(eq(schema.users.id, userId));
    
    await this.db.insert(schema.adminLogs).values({
      adminId: 1, // TODO: get from auth
      action: 'suspend_user',
      targetType: 'user',
      targetId: userId,
      details: reason,
    });
  }

  // Verification queue
  async getPendingVerifications() {
    return await this.db.select({
      id: schema.verifications.id,
      userId: schema.verifications.userId,
      type: schema.verifications.verificationType,
      documentUrl: schema.verifications.documentUrl,
      createdAt: schema.verifications.createdAt,
      user: {
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        email: schema.users.email,
      }
    })
    .from(schema.verifications)
    .innerJoin(schema.users, eq(schema.verifications.userId, schema.users.id))
    .where(eq(schema.verifications.status, 'pending'))
    .orderBy(schema.verifications.createdAt);
  }

  async approveVerification(verificationId: number, adminId: number) {
    await this.db.update(schema.verifications)
      .set({ 
        status: 'approved', 
        reviewedBy: adminId,
        reviewedAt: new Date().toISOString()
      })
      .where(eq(schema.verifications.id, verificationId));
    
    // Update profile verification level
    const verification = await this.db.query.verifications.findFirst({
      where: eq(schema.verifications.id, verificationId)
    });
    
    if (verification) {
      await this.db.update(schema.profiles)
        .set({ 
          verified: true,
          verificationLevel: sql`verification_level + 1`
        })
        .where(eq(schema.profiles.userId, verification.userId));
    }
  }

  // Analytics
  async getUserGrowth(days = 30) {
    return await this.db.all(sql`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as new_users
      FROM users
      WHERE created_at >= datetime('now', '-${days} days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `);
  }

  async getRevenueStats() {
    const result = await this.db.all(sql`
      SELECT 
        s.plan,
        COUNT(*) as subscribers,
        SUM(CASE WHEN s.status = 'active' THEN 1 ELSE 0 END) as active
      FROM subscriptions s
      GROUP BY s.plan
    `);
    return result;
  }

  // Moderation
  async getReportedUsers() {
    return await this.db.select({
      id: schema.blocksReports.id,
      reporter: {
        name: sql`${schema.users.firstName} || ' ' || ${schema.users.lastName}`,
        email: schema.users.email,
      },
      reason: schema.blocksReports.reason,
      details: schema.blocksReports.details,
      createdAt: schema.blocksReports.createdAt,
    })
    .from(schema.blocksReports)
    .innerJoin(schema.users, eq(schema.blocksReports.reporterId, schema.users.id))
    .where(eq(schema.blocksReports.status, 'pending'))
    .orderBy(desc(schema.blocksReports.createdAt));
  }
}

// Usage in Worker:
// const admin = new AdminQueries(db);
// const stats = await admin.getDashboardStats();
