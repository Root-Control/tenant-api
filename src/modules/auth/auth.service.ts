import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as jwt from 'jsonwebtoken';
import { UsersService } from '../users/users.service';
import {
  UserDocument,
  MigrationStatus,
  ProviderName,
} from '../users/schemas/user.schema';
import { JwtPayload } from '../../common/strategies/jwt.strategy';
import { AuthorizeDto } from './dtos/authorize.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private httpService: HttpService,
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

  async authorize(authorizeDto: AuthorizeDto): Promise<string> {
    try {
      // Llamar al endpoint externo
      const response = await firstValueFrom(
        this.httpService.post('http://localhost:9000/api/authorize', {
          code: authorizeDto.code,
          code_verifier: authorizeDto.code_verifier,
        }),
      );

      // Convertir la respuesta en JWT token
      // Usamos la respuesta completa como payload del JWT
      const payload = response.data;

      // Generar JWT token usando el secreto configurado
      const secret =
        this.configService.get<string>('JWT_SECRET') || 'default-secret-key';
      const token = jwt.sign(payload, secret, { expiresIn: '1h' });

      return token;
    } catch (error) {
      throw new Error(`Error al autorizar: ${error.message}`);
    }
  }

  private sanitizeUser(user: UserDocument) {
    const userObj = user.toObject();
    delete userObj.password_hash;
    return userObj;
  }
}
