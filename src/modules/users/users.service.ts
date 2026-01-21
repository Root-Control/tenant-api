import {
  Injectable,
  ConflictException,
  Inject,
  Scope,
} from '@nestjs/common';
import { InjectModel, getModelToken } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { REQUEST } from '@nestjs/core';
import {
  User,
  UserDocument,
  UserSchema,
  MigrationStatus,
  ProviderName,
} from './schemas/user.schema';
import { TenantService } from '../../common/services/tenant.service';

@Injectable({ scope: Scope.REQUEST })
export class UsersService {
  private readonly saltRounds: number;
  private _userModel: Model<UserDocument> | null = null;

  constructor(
    @InjectModel(User.name) private defaultUserModel: Model<UserDocument>,
    @Inject(REQUEST) private request: any,
    private configService: ConfigService,
    private tenantService: TenantService,
  ) {
    this.saltRounds = parseInt(
      this.configService.get<string>('BCRYPT_SALT_ROUNDS', '10'),
      10,
    );
    // Don't initialize model here - do it lazily when needed
  }

  private get userModel(): Model<UserDocument> {
    if (!this._userModel) {
      this.initializeModel();
    }
    return this._userModel!;
  }

  private initializeModel() {
    const tenant = this.request?.tenant || null;
    console.log(
      `\n🔧 UsersService.initializeModel() - Tenant detectado: ${tenant}`,
    );
    console.log(
      `🔧 UsersService.initializeModel() - Request.tenant: ${this.request?.tenant}`,
    );
    console.log(
      `🔧 UsersService.initializeModel() - Request.dbName: ${this.request?.dbName}`,
    );

    const connection = this.tenantService.getConnectionForTenant(tenant);
    console.log(
      `🔧 UsersService.initializeModel() - Connection name: ${connection.name}`,
    );
    const dbName = (connection as any).db?.databaseName || connection.name;
    console.log(
      `🔧 UsersService.initializeModel() - Connection db: ${dbName}`,
    );

    // Register schema if not already registered
    if (!connection.models[User.name]) {
      connection.model(User.name, UserSchema);
      console.log(`🔧 UsersService.initializeModel() - Schema registrado`);
    }

    this._userModel = connection.model<UserDocument>(User.name);
    console.log(
      `🔧 UsersService.initializeModel() - Model inicializado para DB: ${dbName}\n`,
    );
  }

  /**
   * Get model for a specific tenant (for initialization purposes)
   */
  getModelForTenant(tenant: string | null): Model<UserDocument> {
    const connection = this.tenantService.getConnectionForTenant(tenant);
    return connection.model<UserDocument>(User.name);
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

  async findAll(): Promise<UserDocument[]> {
    console.log(`\n🔍 UsersService.findAll() - Buscando usuarios`);
    const dbName =
      (this.userModel.db as any)?.databaseName ||
      (this.userModel.db as any)?.name ||
      this.userModel.db?.name ||
      'unknown';
    console.log(`🔍 UsersService.findAll() - Model DB: ${dbName}`);
    console.log(
      `🔍 UsersService.findAll() - Collection: ${this.userModel.collection.name}`,
    );
    console.log(
      `🔍 UsersService.findAll() - Connection: ${this.userModel.db?.name || 'unknown'}`,
    );
    console.log(
      `🔍 UsersService.findAll() - Request tenant: ${this.request?.tenant || 'null'}`,
    );
    console.log(
      `🔍 UsersService.findAll() - Request dbName: ${this.request?.dbName || 'null'}`,
    );

    const users = await this.userModel
      .find({ deleted_at: null })
      .select('-password_hash')
      .exec();

    console.log(
      `🔍 UsersService.findAll() - Encontrados ${users.length} usuario(s)`,
    );
    if (users.length > 0) {
      console.log(`🔍 UsersService.findAll() - Primer usuario:`, {
        id: users[0]._id.toString(),
        email: users[0].email,
        migration_status: users[0].migration_status,
        provider_user_id: users[0].provider_user_id,
      });
    }
    console.log(`\n`);

    return users;
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
  ): Promise<UserDocument> {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new ConflictException('User not found');
    }

    // Idempotent: if already migrated with same provider_user_id, do nothing
    if (
      user.migration_status === MigrationStatus.MIGRATED &&
      user.provider_user_id === provider_user_id
    ) {
      return user;
    }

    user.migration_status = MigrationStatus.MIGRATED;
    user.provider_user_id = provider_user_id;
    user.provider_name = provider_name;
    user.migration_date = new Date();
    await user.save();

    return user;
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

