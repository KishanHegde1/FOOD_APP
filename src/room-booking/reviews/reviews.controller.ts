import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentFirebaseUser } from '../../auth/decorators/current-firebase-user.decorator';
import { FirebaseAuthGuard } from '../../auth/guards/firebase-auth.guard';
import type { FirebaseUser } from '../../auth/interfaces/firebase-user.interface';
import { UsersService } from '../../users/users.service';
import { CreateReviewDto } from './dto/create-review.dto';
import {
  HotelReviewResponseDto,
  PaginatedHotelReviewsResponseDto,
} from './dto/review-response.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Room Booking - Reviews')
@Controller('room-booking')
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly usersService: UsersService,
  ) {}

  @Get('hotels/:hotelId/reviews')
  @ApiOperation({ summary: 'List approved public hotel reviews' })
  @ApiOkResponse({ type: PaginatedHotelReviewsResponseDto })
  findPublic(
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
    @Query() query: ReviewQueryDto,
  ): Promise<PaginatedHotelReviewsResponseDto> {
    return this.reviewsService.findPublic(hotelId, query);
  }

  @Post('hotels/:hotelId/reviews')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-auth')
  @ApiOperation({ summary: 'Review a checked-out stay at this hotel' })
  @ApiCreatedResponse({ type: HotelReviewResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid review input.' })
  @ApiConflictResponse({ description: 'The booking already has a review.' })
  @ApiForbiddenResponse({
    description: 'A checked-out booking owned by the caller is required.',
  })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  create(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
    @Body() dto: CreateReviewDto,
  ): Promise<HotelReviewResponseDto> {
    return this.withUser(firebaseUser, (user) =>
      this.reviewsService.create(user, hotelId, dto),
    );
  }

  @Patch('reviews/:reviewId')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth('firebase-auth')
  @ApiOperation({ summary: 'Update an authenticated user review' })
  @ApiOkResponse({ type: HotelReviewResponseDto })
  @ApiForbiddenResponse({ description: 'Review ownership is required.' })
  update(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
    @Body() dto: UpdateReviewDto,
  ): Promise<HotelReviewResponseDto> {
    return this.withUser(firebaseUser, (user) =>
      this.reviewsService.update(user, reviewId, dto),
    );
  }

  @Delete('reviews/:reviewId')
  @UseGuards(FirebaseAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('firebase-auth')
  @ApiOperation({ summary: 'Delete an authenticated user review' })
  @ApiNoContentResponse({ description: 'Review deleted.' })
  @ApiForbiddenResponse({ description: 'Review ownership is required.' })
  async remove(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
  ): Promise<void> {
    await this.withUser(firebaseUser, (user) =>
      this.reviewsService.remove(user, reviewId),
    );
  }

  private async withUser<T>(
    firebaseUser: FirebaseUser,
    callback: (
      user: Awaited<ReturnType<UsersService['findActiveByFirebaseUid']>>,
    ) => Promise<T>,
  ): Promise<T> {
    return callback(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
    );
  }
}
