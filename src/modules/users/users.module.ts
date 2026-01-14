import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { User, UserSchema } from './schemas/user.schema';
import { InternalController } from './internal.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [UsersService],
  controllers: [InternalController],
  exports: [UsersService],
})
export class UsersModule implements OnModuleInit {
  private readonly logger = new Logger(UsersModule.name);

  constructor(private readonly usersService: UsersService) {}

  async onModuleInit() {
    try {
      const userCount = await this.usersService.count();

      if (userCount === 0) {
        this.logger.log('No users found. Creating default user...');

        try {
          await this.usersService.create('test@paybook.com', 'Secretsystem1@');
          this.logger.log('✅ Default user created: test@paybook.com');
        } catch (error) {
          this.logger.error('Failed to create default user:', error);
        }
      } else {
        this.logger.log(`Found ${userCount} existing user(s). Skipping seed.`);
      }
    } catch (error) {
      this.logger.error('Error checking users on module init:', error);
    }
  }
}
