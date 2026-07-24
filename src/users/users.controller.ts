import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentFirebaseUser } from '../auth/decorators/current-firebase-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import type { FirebaseUser } from '../auth/interfaces/firebase-user.interface';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { UpdateCurrentUserProfileDto } from './dto/update-profile.dto';
import {
  PROFILE_PHOTO_MAX_BYTES,
  UploadedProfilePhoto,
} from './profile-photo-storage.service';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth('firebase-auth')
@UseGuards(FirebaseAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiOkResponse({ type: ProfileResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  async getCurrentProfile(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
  ): Promise<ProfileResponseDto> {
    return ProfileResponseDto.fromEntity(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      'Profile fetched successfully',
    );
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  @ApiOkResponse({ type: ProfileResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid profile details.' })
  @ApiConflictResponse({ description: 'The email address is already in use.' })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  async updateCurrentProfile(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Body() dto: UpdateCurrentUserProfileDto,
  ): Promise<ProfileResponseDto> {
    const user = await this.usersService.findActiveByFirebaseUid(
      firebaseUser.uid,
    );
    return ProfileResponseDto.fromEntity(
      await this.usersService.updateCurrentProfile(
        user,
        dto,
        firebaseUser.phoneNumber,
      ),
      'Profile updated successfully',
    );
  }

  @Post('me/profile-photo')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('profilePhoto', {
      limits: { fileSize: PROFILE_PHOTO_MAX_BYTES },
    }),
  )
  @ApiOperation({
    summary: 'Upload or replace the authenticated user profile photo',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['profilePhoto'],
      properties: {
        profilePhoto: {
          type: 'string',
          format: 'binary',
          description: 'JPG, JPEG, PNG, or WEBP image up to 2 MB.',
        },
      },
    },
  })
  @ApiOkResponse({ type: ProfileResponseDto })
  @ApiBadRequestResponse({
    description: 'Missing, unsupported, or oversized profile photo.',
  })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  async uploadProfilePhoto(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @UploadedFile() file: UploadedProfilePhoto | undefined,
  ): Promise<ProfileResponseDto> {
    if (!file) {
      throw new BadRequestException('A profile photo file is required.');
    }

    const user = await this.usersService.findActiveByFirebaseUid(
      firebaseUser.uid,
    );
    return ProfileResponseDto.fromEntity(
      await this.usersService.updateCurrentProfilePhoto(user, file),
      'Profile photo updated successfully',
    );
  }

  @Delete('me/profile-photo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove the authenticated user profile photo' })
  @ApiOkResponse({ type: ProfileResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  async removeProfilePhoto(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
  ): Promise<ProfileResponseDto> {
    const user = await this.usersService.findActiveByFirebaseUid(
      firebaseUser.uid,
    );
    return ProfileResponseDto.fromEntity(
      await this.usersService.removeCurrentProfilePhoto(user),
      'Profile photo removed successfully',
    );
  }
}
