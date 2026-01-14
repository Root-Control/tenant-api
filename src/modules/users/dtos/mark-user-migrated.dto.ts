import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ProviderName } from '../schemas/user.schema';

export class MarkUserMigratedDto {
  @IsEmail()
  email: string;

  @IsString()
  provider_user_id: string;

  @IsOptional()
  @IsString()
  provider_name?: ProviderName;
}

