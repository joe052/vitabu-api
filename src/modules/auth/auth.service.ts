import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { publicUserSelect } from '../users/users.select';
import { SignInDto, SignUpDto } from './dto';
import type { JwtPayload } from './strategies/jwt.strategy';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private supabaseService: SupabaseService,
  ) {}

  /**
   * Registers the user in Supabase Auth, then in the local DB linked by
   * `supabaseUserId`. Supabase can't join a DB transaction, so if the local
   * insert fails the Supabase user is deleted again to avoid an orphan.
   */
  async register({ password, ...profile }: SignUpDto) {
    /**Instantiate supabase */
    const supabaseAdmin = this.supabaseService.getAdminClient();

    /**Create user */
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: profile.email,
      email_confirm: true,
      password,
    });

    if (error || !data?.user) {
      /**Supabase returns a 422 for duplicate emails */
      if (error?.status === 422) {
        throw new ConflictException('A user with this email already exists.');
      }
      throw new InternalServerErrorException(
        `Could not create user: ${error?.message ?? 'unknown error'}`,
      );
    }

    const supabaseUserId = data.user.id;

    try {
      return await this.prisma.user.create({
        data: { ...profile, supabaseUserId },
        select: publicUserSelect,
      });
    } catch (error) {
      /**Roll back the Supabase user so both stores stay in sync */
      const { error: deleteError } =
        await supabaseAdmin.auth.admin.deleteUser(supabaseUserId);
      if (deleteError) {
        this.logger.error(
          `Orphaned Supabase user ${supabaseUserId}: ${deleteError.message}`,
        );
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A user with this email already exists.');
      }
      throw error;
    }
  }

  /** Verifies the password with Supabase Auth, then issues the API's own JWT. */
  async signIn({ email, password }: SignInDto) {
    const { data, error } = await this.supabaseService
      .createAuthClient()
      .auth.signInWithPassword({ email, password });

    if (error || !data?.user) {
      /**Anything other than a 4xx is Supabase being unavailable, not bad credentials */
      if (!error?.status || error.status >= 500) {
        throw new InternalServerErrorException(
          `Could not sign in: ${error?.message ?? 'unknown error'}`,
        );
      }
      // Same error for unknown email and wrong password, to avoid account enumeration.
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.prisma.user.findUnique({
      where: { supabaseUserId: data.user.id },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.signToken({ sub: user.id, email: user.email });
  }

  private async signToken(payload: JwtPayload) {
    return { access_token: await this.jwt.signAsync(payload) };
  }
}
