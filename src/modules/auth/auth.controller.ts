import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators';
import { AuthService } from './auth.service';
import { SignInDto, SignUpDto } from './dto';

@ApiTags('auth')
@Public()
// Stricter limit than the global default to slow down credential stuffing.
@Throttle({ default: { limit: 5, ttl: 60_000 } })
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Register a new user account */
  @ApiCreatedResponse({
    description: 'User created in Supabase Auth.',
    schema: {
      type: 'object',
      example: {
        id: '3f1c2b9e-8a4d-4e2f-9c1a-7b6d5e4f3a21',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'jane.doe@example.com',
        email_confirmed_at: null,
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {},
        identities: [],
        created_at: '2026-10-29T12:00:00.000Z',
        updated_at: '2026-10-29T12:00:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Request body failed validation.' })
  @ApiConflictResponse({
    description: 'A user with this email already exists.',
  })
  @ApiTooManyRequestsResponse({
    description: 'More than 5 auth requests per minute from this client.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Supabase could not create the user.',
  })
  @Post('signup')
  signUp(@Body() dto: SignUpDto) {
    return this.authService.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('signin')
  signIn(@Body() dto: SignInDto) {
    return this.authService.signIn(dto);
  }
}
