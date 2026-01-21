import { IsString } from 'class-validator';

export class AuthorizeDto {
  @IsString()
  code: string;

  @IsString()
  code_verifier: string;
}


