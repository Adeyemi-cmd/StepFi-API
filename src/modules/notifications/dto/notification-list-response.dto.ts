import { ApiProperty } from '@nestjs/swagger';

export type NotificationType =
  | 'loan_reminder'
  | 'loan_overdue'
  | 'loan_completed'
  | 'reputation_changed'
  | 'liquidity_deposited'
  | 'liquidity_withdrawn';

export class NotificationItemDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({
    description: 'Notification type',
    enum: [
      'loan_reminder',
      'loan_overdue',
      'loan_completed',
      'reputation_changed',
      'liquidity_deposited',
      'liquidity_withdrawn',
    ],
    example: 'loan_reminder',
  })
  type: NotificationType;

  @ApiProperty({ example: 'Payment Due Soon' })
  title: string;

  @ApiProperty({ example: 'Your loan payment of $150.00 is due in 3 days.' })
  message: string;

  @ApiProperty({
    description: 'Additional contextual data associated with the notification',
    example: { loan_id: 'abc123', amount: 150 },
  })
  data: Record<string, unknown>;

  @ApiProperty({ example: false })
  isRead: boolean;

  @ApiProperty({ example: '2026-03-20T10:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: null, nullable: true })
  readAt: string | null;
}

export class NotificationPaginationDto {
  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 0 })
  offset: number;

  @ApiProperty({ example: 42 })
  total: number;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationItemDto] })
  data: NotificationItemDto[];

  @ApiProperty({ type: NotificationPaginationDto })
  pagination: NotificationPaginationDto;

  @ApiProperty({
    description: 'Total number of unread notifications for the user (ignores unread filter)',
    example: 5,
  })
  unreadCount: number;
}
