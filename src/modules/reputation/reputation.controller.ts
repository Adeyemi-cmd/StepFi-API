import {
    Controller,
    Get,
    Param,
    Request,
    UnauthorizedException,
    BadRequestException,
} from '@nestjs/common';
import { ReputationService } from './reputation.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Reputation')
@Controller('reputation')
export class ReputationController {
    constructor(private readonly reputationService: ReputationService) { }

    @Get(':wallet')
    @ApiOperation({ summary: 'Get reputation score for a specific wallet' })
    @ApiResponse({
        status: 200,
        description: 'Reputation data retrieved successfully',
    })
    async getScore(@Param('wallet') wallet: string) {
        // Validation: Stellar Ed25519 public key format (G + 55 base32 characters)
        const stellarWalletRegex = /^G[A-Z2-7]{55}$/;
        if (!stellarWalletRegex.test(wallet)) {
            throw new BadRequestException({
                success: false,
                message: 'Invalid Stellar wallet address format',
            });
        }

        const data = await this.reputationService.getReputationScore(wallet);

        return {
            success: true,
            data,
            message: 'Reputation data retrieved successfully',
        };
    }

    @Get('me')
    @ApiOperation({ summary: 'Get reputation score for the authenticated user' })
    async getMyScore(@Request() req: any) {
        const wallet = req.user?.wallet;

        if (!wallet) {
            throw new UnauthorizedException({
                success: false,
                message: 'No authenticated wallet found in request session',
            });
        }

        const data = await this.reputationService.getReputationScore(wallet);

        return {
            success: true,
            data,
            message: 'Your reputation data retrieved successfully',
        };
    }
}
