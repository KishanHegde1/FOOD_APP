import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentFirebaseUser } from '../auth/decorators/current-firebase-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import type { FirebaseUser } from '../auth/interfaces/firebase-user.interface';
import { UsersService } from '../users/users.service';
import { DineInManagerDashboardResponseDto } from './dto/dine-in-manager-dashboard-response.dto';
import { DineInManagerDashboardService } from './dine-in-manager-dashboard.service';

@ApiTags('Dine-In Manager Dashboard')
@ApiBearerAuth('firebase-auth')
@UseGuards(FirebaseAuthGuard)
@Controller('manager/restaurants/:restaurantId/dine-in/dashboard')
export class DineInManagerDashboardController {
  constructor(
    private readonly dashboardService: DineInManagerDashboardService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Get live kitchen, billing, and cash-counter metrics for a restaurant',
  })
  @ApiOkResponse({ type: DineInManagerDashboardResponseDto })
  @ApiForbiddenResponse({ description: 'RESTAURANT_ACCESS_DENIED.' })
  async getDashboard(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
  ): Promise<DineInManagerDashboardResponseDto> {
    return this.dashboardService.getDashboard(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      restaurantId,
    );
  }
}
