import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { User, UserSchema } from './schemas/user.schema';
import { InternalController } from './internal.controller';
import { UsersController } from './users.controller';
import { TenantService } from '../../common/services/tenant.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [UsersService],
  controllers: [InternalController, UsersController],
  exports: [UsersService],
})
export class UsersModule implements OnModuleInit {
  private readonly logger = new Logger(UsersModule.name);

  constructor(private readonly tenantService: TenantService) {}

  async onModuleInit() {
    // Get all known tenants including default (null)
    const tenants = [null, ...this.tenantService.getKnownTenants()];

    this.logger.log(`Initializing users for ${tenants.length} tenant(s)...`);

    for (const tenant of tenants) {
      const tenantName = tenant || 'default';
      this.logger.log(`Checking tenant: ${tenantName}`);

      try {
        // Create a temporary service instance for this tenant
        // We need to manually create the model for this tenant
        const connection = this.tenantService.getConnectionForTenant(tenant);
        const userModel = connection.model(User.name, UserSchema);

        const userCount = await userModel
          .countDocuments({ deleted_at: null })
          .exec();

        if (userCount === 0) {
          this.logger.log(
            `No users found in ${tenantName}. Creating default user...`,
          );

          try {
            const password_hash = await this.hashPassword('Secretsystem1@');

            const user = new userModel({
              email: 'test@paybook.com',
              password_hash,
              migration_status: 'non-migrated',
              provider_name: 'legacy',
              enabled: true,
            });

            await user.save();
            this.logger.log(
              `✅ Default user created in ${tenantName}: test@paybook.com`,
            );
          } catch (error) {
            this.logger.error(
              `Failed to create default user in ${tenantName}:`,
              error,
            );
          }
        } else {
          this.logger.log(
            `Found ${userCount} existing user(s) in ${tenantName}. Skipping seed.`,
          );
        }
      } catch (error) {
        this.logger.error(`Error checking users in ${tenantName}:`, error);
      }
    }
  }

  private async hashPassword(password: string): Promise<string> {
    const bcrypt = await import('bcrypt');
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
    return bcrypt.hash(password, saltRounds);
  }
}
