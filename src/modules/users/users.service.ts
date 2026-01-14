import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import {
  User,
  UserDocument,
  MigrationStatus,
  ProviderName,
} from './schemas/user.schema';

@Injectable()
export class UsersService {
  private readonly saltRounds: number;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
  ) {
    this.saltRounds = parseInt(
      this.configService.get<string>('BCRYPT_SALT_ROUNDS', '10'),
      10,
    );
  }

  async create(email: string, password: string): Promise<UserDocument> {
    const existingUser = await this.userModel.findOne({ email }).exec();
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const password_hash = await bcrypt.hash(password, this.saltRounds);

    const user = new this.userModel({
      email,
      password_hash,
      migration_status: MigrationStatus.NON_MIGRATED,
      provider_name: ProviderName.LEGACY,
      enabled: true,
    });

    return user.save();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase().trim(), deleted_at: null })
      .select('+password_hash')
      .exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async count(): Promise<number> {
    return this.userModel.countDocuments({ deleted_at: null }).exec();
  }

  async validatePassword(
    user: UserDocument,
    password: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, user.password_hash);
  }

  async updatePassword(
    user: UserDocument,
    newPassword: string,
  ): Promise<void> {
    const password_hash = await bcrypt.hash(newPassword, this.saltRounds);
    user.password_hash = password_hash;
    await user.save();
  }

  async markUserMigrated(
    email: string,
    provider_user_id: string,
    provider_name: ProviderName = ProviderName.WORKOS,
  ): Promise<void> {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new ConflictException('User not found');
    }

    // Idempotent: if already migrated with same provider_user_id, do nothing
    if (
      user.migration_status === MigrationStatus.MIGRATED &&
      user.provider_user_id === provider_user_id
    ) {
      return;
    }

    user.migration_status = MigrationStatus.MIGRATED;
    user.provider_user_id = provider_user_id;
    user.provider_name = provider_name;
    user.migration_date = new Date();
    await user.save();
  }

  async checkEmailExists(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase().trim(), deleted_at: null })
      .exec();
  }

  async handleForgotPassword(email: string): Promise<void> {
    const user = await this.checkEmailExists(email);
    if (user) {
      // Log internally that user exists and email should be sent
      // In a real implementation, you would send the password reset email here
      console.log(`Usuario existe, email enviado: ${email}`);
      // TODO: Implement actual email sending logic here
    }
    // Always return without throwing to prevent enumeration
  }
}

