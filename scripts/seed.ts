import { connect, disconnect, model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { UserSchema, MigrationStatus, ProviderName } from '../src/modules/users/schemas/user.schema';

dotenv.config();

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);

interface SeedUser {
  email: string;
  password: string;
  migration_status?: MigrationStatus;
  provider_name?: ProviderName;
  provider_user_id?: string;
}

const seedUsers: SeedUser[] = [
  {
    email: 'admin@test.com',
    password: 'admin123',
    migration_status: MigrationStatus.NON_MIGRATED,
    provider_name: ProviderName.LEGACY,
  },
  {
    email: 'user@test.com',
    password: 'user123',
    migration_status: MigrationStatus.NON_MIGRATED,
    provider_name: ProviderName.LEGACY,
  },
  {
    email: 'migrated@test.com',
    password: 'migrated123',
    migration_status: MigrationStatus.MIGRATED,
    provider_name: ProviderName.WORKOS,
    provider_user_id: 'workos_user_123',
  },
];

async function seed() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB || 'tenant_api';

  try {
    console.log('Connecting to MongoDB...');
    await connect(mongoUri, {
      dbName,
    });
    console.log('Connected to MongoDB');

    const UserModel = model('User', UserSchema);

    console.log('\nSeeding users...');
    for (const seedUser of seedUsers) {
      const existingUser = await UserModel.findOne({ email: seedUser.email });
      
      if (existingUser) {
        console.log(`⚠️  User ${seedUser.email} already exists, skipping...`);
        continue;
      }

      const password_hash = await bcrypt.hash(seedUser.password, SALT_ROUNDS);
      
      const userData: any = {
        email: seedUser.email,
        password_hash,
        migration_status: seedUser.migration_status || MigrationStatus.NON_MIGRATED,
        provider_name: seedUser.provider_name || ProviderName.LEGACY,
        enabled: true,
        deleted_at: null,
      };

      if (seedUser.provider_user_id) {
        userData.provider_user_id = seedUser.provider_user_id;
        userData.migration_date = new Date();
      }

      const user = new UserModel(userData);
      await user.save();
      
      console.log(`✅ Created user: ${seedUser.email} / ${seedUser.password}`);
    }

    console.log('\n✅ Seed completed successfully!');
    console.log('\n📋 Test Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    seedUsers.forEach((user) => {
      console.log(`Email: ${user.email}`);
      console.log(`Password: ${user.password}`);
      console.log(`Status: ${user.migration_status || MigrationStatus.NON_MIGRATED}`);
      console.log(`Provider: ${user.provider_name || ProviderName.LEGACY}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

seed()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

