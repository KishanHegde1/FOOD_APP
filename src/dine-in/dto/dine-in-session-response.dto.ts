import { ApiProperty } from '@nestjs/swagger';
import { DineInMemberRole } from '../enums/dine-in-member-role.enum';
import { DineInSessionStatus } from '../enums/dine-in-session-status.enum';
import { DineInSessionMember } from '../entities/dine-in-session-member.entity';
import { DineInSession } from '../entities/dine-in-session.entity';

export class DineInSessionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  sessionNumber!: string;

  @ApiProperty({ format: 'uuid' })
  restaurantId!: string;

  @ApiProperty({ format: 'uuid' })
  restaurantTableId!: string;

  @ApiProperty({ enum: DineInSessionStatus })
  status!: DineInSessionStatus;

  @ApiProperty()
  guestCount!: number;

  @ApiProperty()
  currentRoundNumber!: number;

  @ApiProperty({ enum: DineInMemberRole })
  memberRole!: DineInMemberRole;

  @ApiProperty({ format: 'date-time' })
  startedAt!: string;

  static fromEntity(
    session: DineInSession,
    membership: DineInSessionMember,
  ): DineInSessionResponseDto {
    return {
      id: session.id,
      sessionNumber: session.sessionNumber,
      restaurantId: session.restaurantId,
      restaurantTableId: session.restaurantTableId,
      status: session.status,
      guestCount: session.guestCount,
      currentRoundNumber: session.currentRoundNumber,
      memberRole: membership.memberRole,
      startedAt: session.startedAt.toISOString(),
    };
  }
}
