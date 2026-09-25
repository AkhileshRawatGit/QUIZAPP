#!/usr/bin/env node
/**
 * ACM Logic Quest — Supabase Setup Script
 * Run: node setup-db.js
 * 
 * This pushes the Prisma schema to your Supabase PostgreSQL database.
 * Make sure your .env.local has DATABASE_URL and DIRECT_URL set correctly.
 */

const { execSync } = require('child_process');

console.log('\n🚀 ACM Logic Quest — Database Setup\n');
console.log('📡 Pushing schema to Supabase PostgreSQL...\n');

try {
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
    console.log('\n✅ Schema pushed successfully!\n');
    
    console.log('📦 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('\n✅ Prisma client generated!\n');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Database is ready for ACM Logic Quest!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Next steps:');
    console.log('  1. Run: npm run dev');
    console.log('  2. Register your admin account');
    console.log('  3. Manually set role = "ADMIN" in Supabase Table Editor');
    console.log('     (users table → find your email → change role to ADMIN)');
    console.log('  4. Create a quiz in the admin panel');
    console.log('  5. Grant participant access from /admin/access\n');
} catch (err) {
    console.error('\n❌ Setup failed:', err.message);
    console.log('\nMake sure your .env.local has correct DATABASE_URL and DIRECT_URL');
    console.log('Get your DB password from: Supabase Dashboard → Settings → Database\n');
    process.exit(1);
}
