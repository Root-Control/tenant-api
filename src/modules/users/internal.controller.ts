import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
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
  async passwordCheck(@Body() passwordCheckDto: PasswordCheckDto) {
    const user = await this.usersService.findByEmail(passwordCheckDto.email);

    console.log(passwordCheckDto);
    if (!user) {
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
      return {
        ok: false,
        error_code: 'INVALID_CREDENTIALS',
      };
    }

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
  async markUserMigrated(@Body() markUserMigratedDto: MarkUserMigratedDto) {
    const provider_name =
      markUserMigratedDto.provider_name || ProviderName.WORKOS;

    await this.usersService.markUserMigrated(
      markUserMigratedDto.email,
      markUserMigratedDto.provider_user_id,
      provider_name,
    );

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
