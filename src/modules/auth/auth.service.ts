import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { UserDocument, MigrationStatus, ProviderName } from '../users/schemas/user.schema';
import { JwtPayload } from '../../common/strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(email: string, password: string) {
    const user = await this.usersService.create(email, password);
    const access_token = await this.generateToken(user);
    return {
      access_token,
      user: this.sanitizeUser(user),
    };
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.enabled) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.usersService.validatePassword(
      user,
      password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const access_token = await this.generateToken(user);
    return {
      access_token,
      user: this.sanitizeUser(user),
    };
  }

  async changePassword(
    user: UserDocument,
    currentPassword: string,
    newPassword: string,
  ) {
    // Check if password is managed by provider
    if (
      user.migration_status === MigrationStatus.MIGRATED &&
      user.provider_name !== ProviderName.LEGACY
    ) {
      throw new ConflictException('PASSWORD_MANAGED_BY_PROVIDER');
    }

    // Validate current password
    const isPasswordValid = await this.usersService.validatePassword(
      user,
      currentPassword,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    // Update password
    await this.usersService.updatePassword(user, newPassword);
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }

    const isPasswordValid = await this.usersService.validatePassword(
      user,
      password,
    );
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  private async generateToken(user: UserDocument): Promise<string> {
    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
    };
    return this.jwtService.signAsync(payload);
  }

  private sanitizeUser(user: UserDocument) {
    const userObj = user.toObject();
    delete userObj.password_hash;
    return userObj;
  }
}

