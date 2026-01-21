import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantService } from './services/tenant.service';

@Global()
@Module({
  imports: [MongooseModule],
  providers: [TenantService],
  exports: [TenantService],
})
export class CommonModule {}





