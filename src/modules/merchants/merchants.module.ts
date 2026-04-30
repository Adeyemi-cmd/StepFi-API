import { Module } from '@nestjs/common';
import { MerchantsService } from './merchants.service';
import { MerchantsController } from './merchants.controller';
import { MerchantsRepository } from '../../database/repositories/merchants.repository';
import { SupabaseService } from '../../database/supabase.client';

@Module({
    controllers: [MerchantsController],
    providers: [MerchantsService, MerchantsRepository, SupabaseService],
    exports: [MerchantsService],
})
export class MerchantsModule { }
