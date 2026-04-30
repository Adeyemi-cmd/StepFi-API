import { Test, TestingModule } from '@nestjs/testing';
import { MerchantsService } from '../../../../src/modules/merchants/merchants.service';
import { MerchantsRepository } from '../../../../src/database/repositories/merchants.repository';
import { NotFoundException } from '@nestjs/common';

describe('MerchantsService', () => {
    let service: MerchantsService;
    let repository: jest.Mocked<MerchantsRepository>;

    const activeMerchants = [
        {
            id: 'merchant-1',
            wallet: 'GMER1ABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJKLMNXX',
            name: 'TechStore',
            logo: 'https://example.com/tech-logo.png',
            category: 'Electronics',
            is_active: true,
        },
        {
            id: 'merchant-2',
            wallet: 'GMER2ABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJKL',
            name: 'FashionHub',
            logo: 'https://example.com/fashion-logo.png',
            category: 'Clothing',
            is_active: true,
        },
    ];

    const mockMerchantDetail = {
        id: 'merchant-1',
        wallet: 'GMER1ABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJKLMNXX',
        name: 'TechStore',
        logo: 'https://example.com/tech-logo.png',
        description: 'Electronics retailer',
        category: 'Electronics',
        website: 'https://techstore.com',
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
    };

    const mockMerchantsRepository = {
        findAll: jest.fn(),
        findById: jest.fn(),
        findByWallet: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MerchantsService,
                { provide: MerchantsRepository, useValue: mockMerchantsRepository },
            ],
        }).compile();

        service = module.get<MerchantsService>(MerchantsService);
        repository = module.get(MerchantsRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('listMerchants', () => {
        it('should return active merchants with correct pagination metadata', async () => {
            mockMerchantsRepository.findAll.mockResolvedValue({
                merchants: activeMerchants,
                total: 42,
            });

            const result = await service.listMerchants(20, 0);

            expect(result).toEqual({
                merchants: [
                    {
                        id: 'merchant-1',
                        wallet: 'GMER1ABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJKLMNXX',
                        name: 'TechStore',
                        logo: 'https://example.com/tech-logo.png',
                        category: 'Electronics',
                        isActive: true,
                    },
                    {
                        id: 'merchant-2',
                        wallet: 'GMER2ABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJKL',
                        name: 'FashionHub',
                        logo: 'https://example.com/fashion-logo.png',
                        category: 'Clothing',
                        isActive: true,
                    },
                ],
                total: 42,
                limit: 20,
                offset: 0,
            });
        });

        it('should always call repository with isActive: true — filters inactive merchants', async () => {
            mockMerchantsRepository.findAll.mockResolvedValue({
                merchants: activeMerchants,
                total: 2,
            });

            await service.listMerchants(20, 0);

            expect(repository.findAll).toHaveBeenCalledWith({
                limit: 20,
                offset: 0,
                isActive: true,
            });
        });

        it('should pass through limit and offset correctly to the repository', async () => {
            mockMerchantsRepository.findAll.mockResolvedValue({
                merchants: [activeMerchants[0]],
                total: 42,
            });

            const result = await service.listMerchants(1, 10);

            expect(repository.findAll).toHaveBeenCalledWith({
                limit: 1,
                offset: 10,
                isActive: true,
            });
            expect(result.limit).toBe(1);
            expect(result.offset).toBe(10);
        });

        it('should return an empty list when no active merchants exist', async () => {
            mockMerchantsRepository.findAll.mockResolvedValue({
                merchants: [],
                total: 0,
            });

            const result = await service.listMerchants(20, 0);

            expect(result.merchants).toHaveLength(0);
            expect(result.total).toBe(0);
        });

        it('should map is_active (snake_case) from DB to isActive (camelCase) in the DTO', async () => {
            mockMerchantsRepository.findAll.mockResolvedValue({
                merchants: [activeMerchants[0]],
                total: 1,
            });

            const result = await service.listMerchants(20, 0);

            expect(result.merchants[0]).toHaveProperty('isActive', true);
            expect(result.merchants[0]).not.toHaveProperty('is_active');
        });
    });

    describe('getMerchantById', () => {
        it('should return merchant details when a valid UUID is provided', async () => {
            mockMerchantsRepository.findById.mockResolvedValue(mockMerchantDetail);

            const result = await service.getMerchantById('merchant-1');

            expect(repository.findById).toHaveBeenCalledWith('merchant-1');
            expect(repository.findByWallet).not.toHaveBeenCalled();
            expect(result).toEqual({
                id: mockMerchantDetail.id,
                wallet: mockMerchantDetail.wallet,
                name: mockMerchantDetail.name,
                logo: mockMerchantDetail.logo,
                description: mockMerchantDetail.description,
                category: mockMerchantDetail.category,
                website: mockMerchantDetail.website,
                isActive: mockMerchantDetail.is_active,
                createdAt: mockMerchantDetail.created_at,
                updatedAt: mockMerchantDetail.updated_at,
            });
        });

        it('should return merchant details when a valid Stellar wallet is provided', async () => {
            mockMerchantsRepository.findByWallet.mockResolvedValue(mockMerchantDetail);

            const wallet = 'GMER1ABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJKLMNXX';
            const result = await service.getMerchantById(wallet);

            expect(repository.findByWallet).toHaveBeenCalledWith(wallet);
            expect(repository.findById).not.toHaveBeenCalled();
            expect(result.id).toEqual(mockMerchantDetail.id);
        });

        it('should throw NotFoundException if merchant is not found by ID', async () => {
            mockMerchantsRepository.findById.mockResolvedValue(null);

            await expect(service.getMerchantById('invalid-id')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw NotFoundException if merchant is not found by wallet', async () => {
            mockMerchantsRepository.findByWallet.mockResolvedValue(null);

            const wallet = 'GMER1ABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJKLMNXX';
            await expect(service.getMerchantById(wallet)).rejects.toThrow(
                NotFoundException,
            );
        });
    });
});
