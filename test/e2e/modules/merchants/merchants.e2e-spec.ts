import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ConfigModule } from '@nestjs/config';
import { MerchantsModule } from '../../../../src/modules/merchants/merchants.module';
import { MerchantsService } from '../../../../src/modules/merchants/merchants.service';
import { JwtAuthGuard } from '../../../../src/common/guards/jwt-auth.guard';

/**
 * E2E tests for GET /merchants (API-06) and GET /merchants/:id (API-07).
 *
 * JwtAuthGuard is mocked since auth is owned by API-03.
 * We test that:
 *  - With a valid (mocked) token → 200 + expected shape
 *  - Without a token → 401
 *  - With an unknown ID → 404
 */
describe('MerchantsController (e2e)', () => {
    let app: NestFastifyApplication;

    const merchantDetail = {
        id: 'merchant-1',
        wallet: 'GMER1ABCDEFGHIJKLMNOPQRSTUVWXYZ234567890ABCDEFGHIJKLMNXX',
        name: 'TechStore',
        logo: 'https://example.com/tech-logo.png',
        description: 'Electronics retailer',
        category: 'Electronics',
        website: 'https://techstore.com',
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
    };

    const mockMerchantsService = {
        listMerchants: jest.fn().mockResolvedValue({
            merchants: [merchantDetail],
            total: 1,
            limit: 20,
            offset: 0,
        }),
        getMerchantById: jest.fn().mockResolvedValue(merchantDetail),
    };

    const mockJwtAuthGuard = {
        canActivate: jest.fn((context) => {
            const req = context.switchToHttp().getRequest();
            const authHeader = req.headers['authorization'];
            if (!authHeader?.startsWith('Bearer ')) {
                throw new UnauthorizedException('No token provided');
            }
            return true;
        }),
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({ isGlobal: true }),
                MerchantsModule,
            ],
        })
            .overrideProvider(MerchantsService)
            .useValue(mockMerchantsService)
            .overrideGuard(JwtAuthGuard)
            .useValue(mockJwtAuthGuard)
            .compile();

        app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });

    afterAll(async () => {
        if (app) await app.close();
    });

    afterEach(() => {
        jest.clearAllMocks();
        mockMerchantsService.getMerchantById.mockResolvedValue(merchantDetail);
        mockJwtAuthGuard.canActivate.mockImplementation((context) => {
            const req = context.switchToHttp().getRequest();
            const authHeader = req.headers['authorization'];
            if (!authHeader?.startsWith('Bearer ')) {
                throw new UnauthorizedException('No token provided');
            }
            return true;
        });
    });

    // ---------------------------------------------------------------------------
    // GET /merchants/:id (API-07)
    // ---------------------------------------------------------------------------
    describe('GET /merchants/:id', () => {
        it('should return 200 with merchant details when a valid token and ID are provided', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/merchants/merchant-1',
                headers: { authorization: 'Bearer valid.jwt.token' },
            });

            expect(res.statusCode).toBe(200);

            const body = JSON.parse(res.payload);
            expect(body).toMatchObject({
                id: merchantDetail.id,
                name: merchantDetail.name,
                wallet: merchantDetail.wallet,
                isActive: merchantDetail.isActive,
            });
            expect(mockMerchantsService.getMerchantById).toHaveBeenCalledWith('merchant-1');
        });

        it('should return 404 when merchant is not found', async () => {
            mockMerchantsService.getMerchantById.mockRejectedValue(
                new NotFoundException('Merchant not found'),
            );

            const res = await app.inject({
                method: 'GET',
                url: '/merchants/invalid-id',
                headers: { authorization: 'Bearer valid.jwt.token' },
            });

            expect(res.statusCode).toBe(404);
        });

        it('should return 401 when no token is provided', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/merchants/merchant-1',
            });

            expect(res.statusCode).toBe(401);
            expect(mockMerchantsService.getMerchantById).not.toHaveBeenCalled();
        });
    });
});
