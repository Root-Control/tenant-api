import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TenantService {
  private tenantConnections: Map<string, Connection> = new Map();
  private registeredSchemas: Set<string> = new Set();

  constructor(
    @InjectConnection() private defaultConnection: Connection,
    private configService: ConfigService,
  ) {}

  /**
   * Register a schema for a tenant connection
   */
  registerSchemaForConnection(
    connection: Connection,
    modelName: string,
    schema: any,
  ) {
    const key = `${connection.name}-${modelName}`;
    if (!this.registeredSchemas.has(key)) {
      if (!connection.models[modelName]) {
        connection.model(modelName, schema);
      }
      this.registeredSchemas.add(key);
    }
  }

  /**
   * Get database connection for a specific tenant
   * If tenant is null, returns default connection
   */
  getConnectionForTenant(tenant: string | null): Connection {
    console.log(`\n🔌 TenantService.getConnectionForTenant() - Tenant recibido: ${tenant}`);
    console.log(`🔌 TenantService - Default connection name: ${this.defaultConnection.name}`);
    console.log(`🔌 TenantService - Default connection db: ${this.defaultConnection.db.databaseName}`);

    if (!tenant) {
      console.log(`🔌 TenantService - Retornando conexión por defecto`);
      return this.defaultConnection;
    }

    // Check if we already have a connection for this tenant
    if (this.tenantConnections.has(tenant)) {
      const cached = this.tenantConnections.get(tenant)!;
      console.log(`🔌 TenantService - Usando conexión cacheada para tenant: ${tenant}`);
      console.log(`🔌 TenantService - Conexión cacheada db: ${cached.db.databaseName}`);
      return cached;
    }

    // Use the same connection but switch database
    // Mongoose allows using different databases on the same connection
    console.log(`🔌 TenantService - Creando nueva conexión para tenant: ${tenant}`);
    const tenantConnection = this.defaultConnection.useDb(tenant);
    console.log(`🔌 TenantService - Nueva conexión db: ${tenantConnection.db.databaseName}`);
    this.tenantConnections.set(tenant, tenantConnection);
    console.log(`🔌 TenantService - Conexión guardada en cache\n`);
    return tenantConnection;
  }

  /**
   * Get list of known tenants
   */
  getKnownTenants(): string[] {
    const tenantsEnv = this.configService.get<string>('TENANTS', '');
    if (tenantsEnv) {
      return tenantsEnv.split(',').map((t) => t.trim()).filter(Boolean);
    }
    return ['rcsa', 'oak']; // Default tenants
  }
}

