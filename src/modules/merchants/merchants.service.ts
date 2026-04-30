import { Injectable, NotFoundException } from '@nestjs/common';
import { MerchantDetailRecord, MerchantsRepository } from '../../database/repositories/merchants.repository';
import { MerchantDetailDto } from './dto/merchant-detail.dto';
import { MerchantSummaryDto } from './dto/merchant-summary.dto';

export interface ListMerchantsResult {
    merchants: MerchantSummaryDto[];
    total: number;
    limit: number;
    offset: number;
}

@Injectable()
export class MerchantsService {
    constructor(private readonly merchantsRepository: MerchantsRepository) { }

    /**
     * Returns a paginated list of active merchants.
     */
    async listMerchants(limit: number, offset: number): Promise<ListMerchantsResult> {
        const { merchants, total } = await this.merchantsRepository.findAll({
            limit,
            offset,
            isActive: true,
        });

        const merchantSummaries: MerchantSummaryDto[] = merchants.map((m) => ({
            id: m.id,
            wallet: m.wallet,
            name: m.name,
            logo: m.logo,
            category: m.category,
            isActive: m.is_active,
        }));

        return {
            merchants: merchantSummaries,
            total,
            limit,
            offset,
        };
    }

    /**
     * Finds a merchant by ID or wallet address.
     * Throws NotFoundException if the merchant is not found.
     */
    async getMerchantById(idOrWallet: string): Promise<MerchantDetailDto> {
        let merchant: MerchantDetailRecord | null = null;

        // Simple heuristic: Stellar wallets start with 'G' and are 56 characters long.
        // Otherwise, assume it's a UUID.
        if (idOrWallet.startsWith('G') && idOrWallet.length === 56) {
            merchant = await this.merchantsRepository.findByWallet(idOrWallet);
        } else {
            merchant = await this.merchantsRepository.findById(idOrWallet);
        }

        if (!merchant) {
            throw new NotFoundException('Merchant not found');
        }

        return {
            id: merchant.id,
            wallet: merchant.wallet,
            name: merchant.name,
            logo: merchant.logo,
            description: merchant.description,
            category: merchant.category,
            website: merchant.website,
            isActive: merchant.is_active,
            createdAt: merchant.created_at,
            updatedAt: merchant.updated_at,
        };
    }
}
