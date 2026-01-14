import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class AdminTokenGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const adminToken = this.configService.get<string>('ADMIN_SYNC_TOKEN');

    if (!adminToken) {
      throw new UnauthorizedException('Admin token not configured');
    }

    // Timing-safe comparison
    const tokenBuffer = Buffer.from(token, 'utf8');
    const adminTokenBuffer = Buffer.from(adminToken, 'utf8');

    if (tokenBuffer.length !== adminTokenBuffer.length) {
      throw new UnauthorizedException('Invalid admin token');
    }

    const isValid = timingSafeEqual(tokenBuffer, adminTokenBuffer);

    if (!isValid) {
      throw new UnauthorizedException('Invalid admin token');
    }

    return true;
  }
}

