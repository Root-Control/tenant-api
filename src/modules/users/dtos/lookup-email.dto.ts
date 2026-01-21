import { IsEmail } from 'class-validator';

export class LookupEmailDto {
  @IsEmail()
  email: string;
}







