import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentFirebaseUser } from '../auth/decorators/current-firebase-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import type { FirebaseUser } from '../auth/interfaces/firebase-user.interface';
import { UsersService } from '../users/users.service';
import { DineInMenuQueryDto } from './dto/dine-in-menu-query.dto';
import { DineInMenuResponseDto } from './dto/dine-in-menu-response.dto';
import { DineInQrScanResponseDto } from './dto/dine-in-qr-scan-response.dto';
import { DineInSessionResponseDto } from './dto/dine-in-session-response.dto';
import { JoinDineInSessionDto } from './dto/join-dine-in-session.dto';
import { ResolveDineInQrPayloadDto } from './dto/resolve-dine-in-qr-payload.dto';
import { StartDineInSessionDto } from './dto/start-dine-in-session.dto';
import { StartDineInSessionFromQrDto } from './dto/start-dine-in-session-from-qr.dto';
import { ValidateDineInQrDto } from './dto/validate-dine-in-qr.dto';
import { DineInService } from './dine-in.service';

@ApiTags('Dine-In')
@ApiBearerAuth('firebase-auth')
@UseGuards(FirebaseAuthGuard)
@Controller('dine-in')
export class DineInController {
  constructor(
    private readonly dineInService: DineInService,
    private readonly usersService: UsersService,
  ) {}

  @Post('scan')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Validate a scanned dine-in table QR code' })
  @ApiOkResponse({ type: DineInQrScanResponseDto })
  @ApiBadRequestResponse({
    description:
      'INVALID_QR, QR_VERSION_MISMATCH, or TABLE_RESTAURANT_MISMATCH.',
  })
  @ApiConflictResponse({
    description: 'TABLE_INACTIVE or RESTAURANT_INACTIVE.',
  })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only active customers can scan dine-in QR codes.',
  })
  @ApiNotFoundResponse({ description: 'TABLE_NOT_FOUND.' })
  @ApiTooManyRequestsResponse({ description: 'Too many QR scans.' })
  async scan(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Body() dto: ValidateDineInQrDto,
  ): Promise<DineInQrScanResponseDto> {
    return this.dineInService.scan(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      dto,
    );
  }

  @Post('scan/resolve')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Resolve the raw foodapp:// Dine-In QR value from a mobile scanner',
  })
  @ApiOkResponse({ type: DineInQrScanResponseDto })
  @ApiBadRequestResponse({ description: 'INVALID_QR.' })
  @ApiConflictResponse({
    description: 'TABLE_INACTIVE or RESTAURANT_INACTIVE.',
  })
  async resolveScanPayload(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Body() dto: ResolveDineInQrPayloadDto,
  ): Promise<DineInQrScanResponseDto> {
    return this.dineInService.scanQrPayload(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      dto.qrPayload,
    );
  }

  @Get('scan/:qrToken')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Resolve a Dine-In table menu from an opaque QR token',
  })
  @ApiOkResponse({ type: DineInQrScanResponseDto })
  @ApiBadRequestResponse({ description: 'INVALID_QR.' })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only active customers can scan dine-in QR codes.',
  })
  @ApiNotFoundResponse({ description: 'TABLE_NOT_FOUND.' })
  @ApiTooManyRequestsResponse({ description: 'Too many QR scans.' })
  async scanByToken(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('qrToken') qrToken: string,
  ): Promise<DineInQrScanResponseDto> {
    return this.dineInService.scanByToken(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      qrToken,
    );
  }

  @Post('sessions')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Start, join, or resume a dine-in table session' })
  @ApiCreatedResponse({ type: DineInSessionResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid QR details or guest count.' })
  @ApiConflictResponse({
    description:
      'USER_ALREADY_IN_ANOTHER_ACTIVE_SESSION, SESSION_NOT_ACTIVE, or a table capacity conflict.',
  })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only active customers can start sessions.',
  })
  @ApiNotFoundResponse({ description: 'TABLE_NOT_FOUND.' })
  @ApiTooManyRequestsResponse({
    description: 'Too many session-start requests.',
  })
  async startSession(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Body() dto: StartDineInSessionDto,
  ): Promise<DineInSessionResponseDto> {
    return this.dineInService.startSession(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      dto,
    );
  }

  @Post('sessions/from-qr')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Start, join, or resume a table session using raw scanner QR text',
  })
  @ApiCreatedResponse({ type: DineInSessionResponseDto })
  @ApiBadRequestResponse({ description: 'INVALID_QR or invalid guest count.' })
  @ApiConflictResponse({
    description:
      'USER_ALREADY_IN_ANOTHER_ACTIVE_SESSION, SESSION_NOT_ACTIVE, or table capacity conflict.',
  })
  async startSessionFromQr(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Body() dto: StartDineInSessionFromQrDto,
  ): Promise<DineInSessionResponseDto> {
    return this.dineInService.startSessionFromQrPayload(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      dto,
    );
  }

  @Get('sessions/current')
  @ApiOperation({
    summary: 'Get the customer’s active dine-in session, if any',
  })
  @ApiOkResponse({ type: DineInSessionResponseDto, nullable: true })
  async getCurrentSession(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
  ): Promise<DineInSessionResponseDto | null> {
    return this.dineInService.getCurrentSession(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
    );
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: 'Get a session for one of its active members' })
  @ApiOkResponse({ type: DineInSessionResponseDto })
  @ApiConflictResponse({ description: 'SESSION_NOT_ACTIVE.' })
  @ApiForbiddenResponse({ description: 'SESSION_ACCESS_DENIED.' })
  @ApiNotFoundResponse({ description: 'SESSION_NOT_FOUND.' })
  async getSession(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ): Promise<DineInSessionResponseDto> {
    return this.dineInService.getSession(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      sessionId,
    );
  }

  @Post('sessions/:sessionId/join')
  @ApiOperation({
    summary: 'Join an active session after revalidating its QR code',
  })
  @ApiOkResponse({ type: DineInSessionResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid QR or table mismatch.' })
  @ApiConflictResponse({
    description:
      'SESSION_NOT_ACTIVE or USER_ALREADY_IN_ANOTHER_ACTIVE_SESSION.',
  })
  @ApiForbiddenResponse({
    description: 'Only active customers can join sessions.',
  })
  @ApiNotFoundResponse({ description: 'SESSION_NOT_FOUND or TABLE_NOT_FOUND.' })
  async joinSession(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() dto: JoinDineInSessionDto,
  ): Promise<DineInSessionResponseDto> {
    return this.dineInService.joinSession(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      sessionId,
      dto,
    );
  }

  @Delete('sessions/:sessionId/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Leave a dine-in session without closing the table',
  })
  @ApiNoContentResponse({ description: 'Membership marked inactive.' })
  @ApiConflictResponse({ description: 'SESSION_NOT_ACTIVE.' })
  @ApiForbiddenResponse({ description: 'SESSION_ACCESS_DENIED.' })
  @ApiNotFoundResponse({ description: 'SESSION_NOT_FOUND.' })
  async leaveSession(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ): Promise<void> {
    return this.dineInService.leaveSession(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      sessionId,
    );
  }

  @Get('sessions/:sessionId/menu')
  @ApiOperation({
    summary: 'Get the available menu for an active dine-in session',
  })
  @ApiOkResponse({ type: DineInMenuResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid menu filters.' })
  @ApiConflictResponse({ description: 'SESSION_NOT_ACTIVE.' })
  @ApiForbiddenResponse({ description: 'SESSION_ACCESS_DENIED.' })
  @ApiNotFoundResponse({ description: 'SESSION_NOT_FOUND.' })
  async getSessionMenu(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Query() query: DineInMenuQueryDto,
  ): Promise<DineInMenuResponseDto> {
    return this.dineInService.getSessionMenu(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      sessionId,
      query,
    );
  }
}
