import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon from 'argon2';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { publicUserSelect } from '../users/users.select';
import { SignInDto, SignUpDto } from './dto';
import type { JwtPayload } from './strategies/jwt.strategy';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private supabaseService: SupabaseService,
  ) {}

  /**Function to register user */
  async register(dto: SignUpDto) {
    /**Instantiate supabase */
    const supabaseAdmin = this.supabaseService.getAdminClient();

    /**Create user */
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: dto.email,
      password: dto.password,
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

    return data.user;
  }

  async signUp({ password, ...profile }: SignUpDto) {
    const hash = await argon.hash(password);

    try {
      return await this.prisma.user.create({
        data: { ...profile, hash },
        select: publicUserSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async signIn({ email, password }: SignInDto) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Same error for unknown email and wrong password, to avoid account enumeration.
    if (!user || !(await argon.verify(user.hash, password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.signToken({ sub: user.id, email: user.email });
  }

  private async signToken(payload: JwtPayload) {
    return { access_token: await this.jwt.signAsync(payload) };
  }
}
