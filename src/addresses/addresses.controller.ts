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
  UseGuards,
} from '@nestjs/common';
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
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentFirebaseUser } from '../auth/decorators/current-firebase-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import type { FirebaseUser } from '../auth/interfaces/firebase-user.interface';
import { UsersService } from '../users/users.service';
import { AddressesService } from './addresses.service';
import { AddressResponseDto } from './dto/address-response.dto';
import { AddressListResponseDto } from './dto/address-list-response.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@ApiTags('Addresses')
@ApiBearerAuth('firebase-auth')
@UseGuards(FirebaseAuthGuard)
@Controller('addresses')
export class AddressesController {
  constructor(
    private readonly addressesService: AddressesService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List active delivery addresses for the authenticated customer',
  })
  @ApiOkResponse({ type: AddressListResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only active customers can manage addresses.',
  })
  async findAll(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
  ): Promise<AddressListResponseDto> {
    return {
      data: await this.addressesService.findAll(
        await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      ),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one authenticated customer delivery address' })
  @ApiOkResponse({ type: AddressResponseDto })
  @ApiNotFoundResponse({ description: 'Address not found.' })
  async findOne(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AddressResponseDto> {
    return this.addressesService.findOne(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      id,
    );
  }

  @Post()
  @ApiOperation({
    summary: 'Create an authenticated customer delivery address',
  })
  @ApiCreatedResponse({ type: AddressResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid address or coordinate pair.' })
  @ApiConflictResponse({ description: 'Unable to set the default address.' })
  async create(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Body() dto: CreateAddressDto,
  ): Promise<AddressResponseDto> {
    return this.addressesService.create(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      dto,
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an authenticated customer delivery address',
  })
  @ApiOkResponse({ type: AddressResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid address or coordinate pair.' })
  @ApiNotFoundResponse({ description: 'Address not found.' })
  async update(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAddressDto,
  ): Promise<AddressResponseDto> {
    return this.addressesService.update(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      id,
      dto,
    );
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Set an active address as the customer default' })
  @ApiOkResponse({ type: AddressResponseDto })
  @ApiNotFoundResponse({ description: 'Address not found.' })
  async setDefault(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AddressResponseDto> {
    return this.addressesService.setDefault(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      id,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft-delete an authenticated customer delivery address',
  })
  @ApiNoContentResponse({ description: 'Address deactivated.' })
  @ApiNotFoundResponse({ description: 'Address not found.' })
  async remove(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.addressesService.remove(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      id,
    );
  }
}
