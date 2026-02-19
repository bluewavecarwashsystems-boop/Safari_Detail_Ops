/**
 * Seed script to create the first admin (MANAGER) user
 * 
 * Usage:
 *   ts-node scripts/seed-admin-user.ts
 * 
 * This script will prompt for user details and create the first MANAGER account
 * in the DynamoDB users table.
 */

import * as readline from 'readline';
import { createUser } from '../lib/services/user-service';
import { hashPassword } from '../lib/auth/password';
import { UserRole } from '../lib/types';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log('\n🚀 Safari Detail Ops - Admin User Setup\n');
  console.log('This script will create the first MANAGER account.\n');

  try {
    // Collect user information
    const name = await question('Enter admin name: ');
    if (!name.trim()) {
      throw new Error('Name is required');
    }

    const email = await question('Enter admin email: ');
    if (!email.trim() || !email.includes('@')) {
      throw new Error('Valid email is required');
    }

    const password = await question('Enter password (min 8 characters): ');
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const passwordConfirm = await question('Confirm password: ');
    if (password !== passwordConfirm) {
      throw new Error('Passwords do not match');
    }

    console.log('\nCreating admin user...');

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user in DynamoDB
    const user = await createUser({
      email: email.trim(),
      name: name.trim(),
      role: UserRole.MANAGER,
      passwordHash,
    });

    console.log('\n✅ Admin user created successfully!\n');
    console.log('User Details:');
    console.log(`  User ID: ${user.userId}`);
    console.log(`  Name:    ${user.name}`);
    console.log(`  Email:   ${user.email}`);
    console.log(`  Role:    ${user.role}`);
    console.log(`\nYou can now log in at: http://localhost:3000/login\n`);

  } catch (error) {
    console.error('\n❌ Error creating admin user:', error);
    if (error instanceof Error) {
      console.error(`   ${error.message}\n`);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
