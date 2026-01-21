import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  async getAllUsers(@Req() request: Request) {
    const host = request.headers.host || request.hostname || 'unknown';
    const tenant = (request as any).tenant || 'default';
    const dbName = (request as any).dbName || 'unknown';

    console.log('\n👥 GET ALL USERS - Request recibido');
    console.log(`   🌐 Dominio: ${host}`);
    console.log(`   🏢 Tenant: ${tenant}`);
    console.log(`   💾 Base de datos: ${dbName}`);

    const users = await this.usersService.findAll();

    console.log(`   ✅ Encontrados ${users.length} usuario(s)`);

    return users;
  }
}

