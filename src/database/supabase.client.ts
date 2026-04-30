import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;
  private readonly serviceRoleClient: SupabaseClient;

  constructor(private configService: ConfigService) {
    this.client = createClient(
      this.configService.get<string>('SUPABASE_URL'),
      this.configService.get<string>('SUPABASE_ANON_KEY'),
    );

    this.serviceRoleClient = createClient(
      this.configService.get<string>('SUPABASE_URL'),
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY'),
    );
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  getServiceRoleClient(): SupabaseClient {
    return this.serviceRoleClient;
  }
}
