import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { MerchantsService } from './merchants.service';
import { ListMerchantsQueryDto } from './dto/list-merchants-query.dto';
import { MerchantDetailDto } from './dto/merchant-detail.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Merchants')
@ApiBearerAuth()
@Controller('merchants')
export class MerchantsController {
    constructor(private readonly merchantsService: MerchantsService) { }

    @Get()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'List all active merchants with pagination' })
    @ApiResponse({
        status: 200,
        description: 'Active merchants retrieved successfully.',
    })
    @ApiResponse({ status: 401, description: 'Unauthorized — valid JWT required.' })
    async listMerchants(@Query() query: ListMerchantsQueryDto) {
        const limit = query.limit ?? 20;
        const offset = query.offset ?? 0;

        const data = await this.merchantsService.listMerchants(limit, offset);

        return {
            merchants: data.merchants,
            total: data.total,
            limit: data.limit,
            offset: data.offset,
        };
    }

    @Get(':id')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get merchant details by ID or wallet address' })
    @ApiParam({
        name: 'id',
        description: 'Merchant unique ID (UUID) or Stellar wallet address starting with G.',
        example: 'GMER...',
    })
    @ApiResponse({
        status: 200,
        description: 'Merchant details retrieved successfully.',
        type: MerchantDetailDto,
    })
    @ApiResponse({ status: 401, description: 'Unauthorized — valid JWT required.' })
    @ApiResponse({ status: 404, description: 'Merchant not found.' })
    async getMerchantById(@Param('id') id: string): Promise<MerchantDetailDto> {
        return this.merchantsService.getMerchantById(id);
    }
}
