import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentFirebaseUser } from '../../auth/decorators/current-firebase-user.decorator';
import { FirebaseAuthGuard } from '../../auth/guards/firebase-auth.guard';
import type { FirebaseUser } from '../../auth/interfaces/firebase-user.interface';
import { UsersService } from '../../users/users.service';
import { FavouritesService, FavouriteResponse } from './favourites.service';

@ApiTags('Room Booking - Favourites')
@Controller('room-booking/favourites')
@UseGuards(FirebaseAuthGuard)
@ApiBearerAuth('firebase-auth')
@ApiUnauthorizedResponse({
  description: 'Firebase authentication is required.',
})
export class FavouritesController {
  constructor(
    private readonly favouritesService: FavouritesService,
    private readonly usersService: UsersService,
  ) {}

  @Post(':hotelId')
  @ApiOperation({
    summary: 'Add an active hotel to the authenticated user favourites',
  })
  @ApiOkResponse({ description: 'The operation is idempotent.' })
  @ApiNotFoundResponse({ description: 'Hotel not found.' })
  async add(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
  ): Promise<FavouriteResponse> {
    return this.favouritesService.add(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      hotelId,
    );
  }

  @Delete(':hotelId')
  @ApiOperation({
    summary: 'Remove a hotel from authenticated user favourites',
  })
  @ApiOkResponse({ description: 'The operation is idempotent.' })
  async remove(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
  ): Promise<FavouriteResponse> {
    return this.favouritesService.remove(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      hotelId,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'List active hotels favourited by the authenticated user',
  })
  @ApiOkResponse({ type: [Object] })
  async list(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
  ): Promise<Array<Record<string, unknown>>> {
    return this.favouritesService.list(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
    );
  }
}
