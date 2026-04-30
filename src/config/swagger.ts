import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('StepFi API')
    .setDescription('Off-chain orchestration layer for learner BNPL on Stellar')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Wallet-based authentication')
    .addTag('users', 'User profile management')
    .addTag('loans', 'Loan lifecycle management')
    .addTag('reputation', 'On-chain reputation scoring')
    .addTag('liquidity', 'Liquidity pool operations')
    .addTag('merchants', 'Vendor registry')
    .addTag('transactions', 'Transaction submission and tracking')
    .addTag('notifications', 'User notifications')
    .addTag('health', 'Health check')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/v1/docs', app, document);
}
