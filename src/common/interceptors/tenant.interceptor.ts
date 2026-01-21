import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private configService: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    console.log('\n🔷 TenantInterceptor - INICIO');
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;
    const timestamp = new Date().toISOString();
    const host = request.headers.host || request.hostname || '';

    console.log(`🔷 TenantInterceptor - Request recibido:`);
    console.log(`   Method: ${method}`);
    console.log(`   URL: ${url}`);
    console.log(`   Host: ${host}`);
    console.log(`   Headers:`, JSON.stringify(request.headers, null, 2));

    // Get default database name from config
    const defaultDb = this.configService.get<string>('MONGODB_DB', 'tenant_api');
    console.log(`🔷 TenantInterceptor - Default DB: ${defaultDb}`);

    // Extract tenant from domain (e.g., rcsa.local, oak.local)
    let tenantSlug: string | null = null;

    if (host) {
      const hostParts = host.split(':');
      const hostname = hostParts[0]; // Remove port if present
      console.log(`🔷 TenantInterceptor - Hostname extraído: ${hostname}`);

      // Extract tenant from domain like "rcsa.local" or "oak.local"
      const domainMatch = hostname.match(/^([^.]+)\./);
      console.log(`🔷 TenantInterceptor - Domain match:`, domainMatch);

      if (domainMatch) {
        const subdomain = domainMatch[1].toLowerCase();
        console.log(`🔷 TenantInterceptor - Subdomain extraído: ${subdomain}`);

        // Check if it's a known tenant
        const knownTenants = this.configService
          .get<string>('TENANTS', 'rcsa,oak')
          .split(',')
          .map((t) => t.trim().toLowerCase());
        console.log(`🔷 TenantInterceptor - Known tenants:`, knownTenants);

        if (knownTenants.includes(subdomain)) {
          tenantSlug = subdomain;
          console.log(`🔷 TenantInterceptor - ✅ Tenant encontrado: ${tenantSlug}`);
        } else {
          console.log(`🔷 TenantInterceptor - ❌ Subdomain no está en known tenants`);
        }
      } else {
        console.log(`🔷 TenantInterceptor - ❌ No se encontró match de dominio`);
      }
    } else {
      console.log(`🔷 TenantInterceptor - ⚠️ Host vacío`);
    }

    // If tenant slug is detected, use it as database name, otherwise use default
    if (tenantSlug) {
      request.tenant = tenantSlug.toLowerCase().trim();
      request.dbName = tenantSlug.toLowerCase().trim();
      console.log(
        `\n🔵 [${timestamp}] [${method}] ${url}`,
        `\n   📊 Usando DB: "${request.dbName}" (tenant: ${request.tenant} desde dominio ${host})`,
      );
    } else {
      request.tenant = null;
      request.dbName = defaultDb;
      console.log(
        `\n🟢 [${timestamp}] [${method}] ${url}`,
        `\n   📊 Usando DB: "${request.dbName}" (default - host: ${host})`,
      );
    }

    console.log(`🔷 TenantInterceptor - Request.tenant: ${request.tenant}`);
    console.log(`🔷 TenantInterceptor - Request.dbName: ${request.dbName}`);
    console.log(`🔷 TenantInterceptor - FIN\n`);

    return next.handle();
  }
}

