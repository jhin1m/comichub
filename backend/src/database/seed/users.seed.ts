import * as bcrypt from 'bcryptjs';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../schema/index.js';

export type SeededUser = { id: number; name: string };

export async function seedUsers(
  db: PostgresJsDatabase<typeof schema>,
): Promise<SeededUser[]> {
  const pw = await bcrypt.hash('Password123!', 12);
  const adminPw = await bcrypt.hash('Admin123!', 12);

  const usersData = [
    { name: 'Admin', email: 'admin@comichub.com', password: adminPw, role: 'admin' as const },
    { name: 'TanNguyen', email: 'tan@example.com', password: pw },
    { name: 'MinhTran', email: 'minh@example.com', password: pw },
    { name: 'HungLe', email: 'hung@example.com', password: pw },
    { name: 'AnhPham', email: 'anh@example.com', password: pw },
    { name: 'LinhVo', email: 'linh@example.com', password: pw },
  ];

  const inserted = await db
    .insert(schema.users)
    .values(usersData)
    .onConflictDoNothing()
    .returning({ id: schema.users.id, name: schema.users.name });

  if (inserted.length > 0) {
    const profiles = inserted.map((u) => ({
      userId: u.id,
      bio: `Manga enthusiast and avid reader — ${u.name}`,
    }));
    await db.insert(schema.userProfiles).values(profiles).onConflictDoNothing();
  }

  console.log(`  ✓ ${inserted.length} users`);
  return inserted;
}
