import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { PasswordCheckDto } from './dtos/password-check.dto';
import { MarkUserMigratedDto } from './dtos/mark-user-migrated.dto';
import { LookupEmailDto } from './dtos/lookup-email.dto';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { AdminTokenGuard } from '../../common/guards/admin-token.guard';
import { ProviderName } from './schemas/user.schema';

@Controller('internal')
@UseGuards(AdminTokenGuard)
export class InternalController {
  constructor(private usersService: UsersService) {}

  @Post('password-check')
  @HttpCode(HttpStatus.OK)
  async passwordCheck(
    @Body() passwordCheckDto: PasswordCheckDto,
    @Req() request: Request,
  ) {
    const host = request.headers.host || request.hostname || 'unknown';
    const tenant = (request as any).tenant || 'default';
    const dbName = (request as any).dbName || 'unknown';

    console.log('\n🔐 PASSWORD CHECK - Request recibido');
    console.log(`   🌐 Dominio: ${host}`);
    console.log(`   🏢 Tenant: ${tenant}`);
    console.log(`   💾 Base de datos: ${dbName}`);
    console.log(`   📧 Email: ${passwordCheckDto.email}`);

    const user = await this.usersService.findByEmail(passwordCheckDto.email);

    if (!user) {
      console.log(`   ❌ Usuario no encontrado`);
      return {
        ok: false,
        error_code: 'USER_NOT_FOUND',
      };
    }

    const isValid = await this.usersService.validatePassword(
      user,
      passwordCheckDto.password,
    );

    if (!isValid) {
      console.log(`   ❌ Credenciales inválidas`);
      return {
        ok: false,
        error_code: 'INVALID_CREDENTIALS',
      };
    }

    console.log(`   ✅ Password válido para usuario: ${user.email}`);

    return {
      ok: true,
      user: {
        id: user._id,
        email: user.email,
        migration_status: user.migration_status,
        provider_user_id: user.provider_user_id,
        provider_name: user.provider_name,
        migration_date: user.migration_date,
      },
    };
  }

  @Post('mark-user-migrated')
  @HttpCode(HttpStatus.OK)
  async markUserMigrated(
    @Body() markUserMigratedDto: MarkUserMigratedDto,
    @Req() request: Request,
  ) {
    const host = request.headers.host || request.hostname || 'unknown';
    const tenant = (request as any).tenant || 'default';
    const dbName = (request as any).dbName || 'unknown';

    console.log('\n🔄 MARK USER MIGRATED - Request recibido');
    console.log(`   🌐 Dominio: ${host}`);
    console.log(`   🏢 Tenant: ${tenant}`);
    console.log(`   💾 Base de datos: ${dbName}`);
    console.log(`   📧 Email: ${markUserMigratedDto.email}`);
    console.log(
      `   🆔 Provider User ID: ${markUserMigratedDto.provider_user_id}`,
    );

    const provider_name =
      markUserMigratedDto.provider_name || ProviderName.WORKOS;

    const user = await this.usersService.markUserMigrated(
      markUserMigratedDto.email,
      markUserMigratedDto.provider_user_id,
      provider_name,
    );

    // Log escandaloso cuando se marca el usuario como migrado
    console.log('\n');
    console.log(
      '╔════════════════════════════════════════════════════════════╗',
    );
    console.log(
      '║                                                            ║',
    );
    console.log(
      '║          ✅✅✅ USUARIO MIGRADO ✅✅✅                      ║',
    );
    console.log(
      '║                                                            ║',
    );
    console.log(
      '╠════════════════════════════════════════════════════════════╣',
    );
    console.log(`║  🌐 Dominio: ${host.padEnd(52)} ║`);
    console.log(`║  🏢 Tenant: ${tenant.padEnd(54)} ║`);
    console.log(`║  💾 Base de datos: ${dbName.padEnd(46)} ║`);
    console.log(`║  📧 Email: ${user.email.padEnd(51)} ║`);
    console.log(`║  🆔 User ID: ${user._id.toString().padEnd(49)} ║`);
    console.log(
      `║  🔑 Provider User ID: ${(user.provider_user_id || 'N/A').padEnd(40)} ║`,
    );
    console.log(`║  🏷️  Provider: ${user.provider_name.padEnd(48)} ║`);
    console.log(
      `║  📅 Migration Date: ${(user.migration_date?.toISOString() || 'N/A').padEnd(40)} ║`,
    );
    console.log(
      `║  📊 Migration Status: ${user.migration_status.padEnd(42)} ║`,
    );
    console.log(
      '║                                                            ║',
    );
    console.log(
      '╚════════════════════════════════════════════════════════════╝',
    );
    console.log('\n');

    return {
      ok: true,
    };
  }

  @Post('lookup-email')
  @HttpCode(HttpStatus.OK)
  async lookupEmail(@Body() lookupEmailDto: LookupEmailDto) {
    const user = await this.usersService.checkEmailExists(lookupEmailDto.email);

    if (!user) {
      return {
        exists: false,
      };
    }

    return {
      exists: true,
      legacy_user_id: user._id.toString(),
    };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    await this.usersService.handleForgotPassword(forgotPasswordDto.email);
    // Always return 204 to prevent enumeration
  }
}
