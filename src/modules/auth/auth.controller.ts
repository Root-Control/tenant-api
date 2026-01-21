import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from '../users/dtos/register.dto';
import { LoginDto } from '../users/dtos/login.dto';
import { ChangePasswordDto } from '../users/dtos/change-password.dto';
import { AuthorizeDto } from './dtos/authorize.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto.email, registerDto.password);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    console.log(loginDto);
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: UserDocument,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(
      user,
      changePasswordDto.current_password,
      changePasswordDto.new_password,
    );
  }

  @Post('authorize')
  async authorize(
    @Body() authorizeDto: AuthorizeDto,
  ): Promise<{ token: string }> {
    const token = await this.authService.authorize(authorizeDto);
    return { token };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: UserDocument) {
    const userObj = user.toObject();
    delete userObj.password_hash;
    return userObj;
  }
}
