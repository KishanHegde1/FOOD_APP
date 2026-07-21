import { Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentFirebaseUser } from './decorators/current-firebase-user.decorator';
import { FirebaseLoginResponseDto } from './dto/firebase-login-response.dto';
import { FirebaseAuthGuard } from './guards/firebase-auth.guard';
import type { FirebaseUser } from './interfaces/firebase-user.interface';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('firebase-login')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({
    summary: 'Create or sign in a user with a Firebase phone token',
  })
  @ApiBearerAuth('firebase-auth')
  @ApiOkResponse({
    description: 'Firebase identity verified and backend user synchronized.',
    type: FirebaseLoginResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Firebase bearer token is missing or invalid.',
  })
  @ApiForbiddenResponse({ description: 'The linked user account is inactive.' })
  async firebaseLogin(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
  ): Promise<FirebaseLoginResponseDto> {
    return this.authService.loginWithFirebase(firebaseUser);
  }
}
