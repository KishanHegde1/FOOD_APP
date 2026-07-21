import {
  Body,
  Controller,
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
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { CurrentFirebaseUser } from '../auth/decorators/current-firebase-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import type { FirebaseUser } from '../auth/interfaces/firebase-user.interface';
import { UsersService } from '../users/users.service';
import { DineInInvoiceListQueryDto } from './dto/dine-in-invoice-list-query.dto';
import {
  DineInInvoiceResponseDto,
  PaginatedDineInInvoicesResponseDto,
} from './dto/dine-in-invoice-response.dto';
import { DineInInvoicesService } from './dine-in-invoices.service';

@ApiTags('Dine-In Billing')
@ApiBearerAuth('firebase-auth')
@UseGuards(FirebaseAuthGuard)
@Controller('dine-in')
export class DineInInvoicesController {
  constructor(
    private readonly invoicesService: DineInInvoicesService,
    private readonly usersService: UsersService,
  ) {}

  @Post('sessions/:sessionId/request-bill')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Request a bill after every payable dine-in round is served',
  })
  @ApiOkResponse({ type: DineInInvoiceResponseDto })
  @ApiConflictResponse({
    description:
      'UNFINISHED_ORDERS_EXIST, NO_PAYABLE_ORDERS, or SESSION_NOT_ACTIVE.',
  })
  @ApiForbiddenResponse({ description: 'SESSION_ACCESS_DENIED.' })
  @ApiNotFoundResponse({ description: 'SESSION_NOT_FOUND.' })
  @ApiTooManyRequestsResponse({ description: 'Too many bill requests.' })
  async requestBill(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ): Promise<DineInInvoiceResponseDto> {
    return this.invoicesService.requestBill(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      sessionId,
    );
  }

  @Get('sessions/:sessionId/bill')
  @ApiOperation({
    summary: 'Get the current bill for a dine-in session member',
  })
  @ApiOkResponse({ type: DineInInvoiceResponseDto })
  async getSessionBill(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ): Promise<DineInInvoiceResponseDto> {
    return this.invoicesService.getBillForSession(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      sessionId,
    );
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List the authenticated customer’s dine-in bills' })
  @ApiOkResponse({ type: PaginatedDineInInvoicesResponseDto })
  async list(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Query() query: DineInInvoiceListQueryDto,
  ): Promise<PaginatedDineInInvoicesResponseDto> {
    return this.invoicesService.listForCustomer(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      query,
    );
  }

  @Get('invoices/:invoiceId')
  @ApiOperation({
    summary: 'Get an invoice for one of the customer’s sessions',
  })
  @ApiOkResponse({ type: DineInInvoiceResponseDto })
  async getInvoice(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('invoiceId', new ParseUUIDPipe()) invoiceId: string,
  ): Promise<DineInInvoiceResponseDto> {
    return this.invoicesService.getForCustomer(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      invoiceId,
    );
  }
}
