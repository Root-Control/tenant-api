import { IsEmail, IsString } from 'class-validator';

export class PasswordCheckDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

