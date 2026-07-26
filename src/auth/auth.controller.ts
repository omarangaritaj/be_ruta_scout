import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common';
import { UserDocument } from '../users/schemas/user.schema';
import {
  AuthService,
  type AuthenticatedUser,
  type AuthResult,
  type CheckResult,
  type PowerSyncTokenResult,
} from './auth.service';
import { checkSchema, type CheckDto } from './dto/check.dto';
import { refreshSchema, type RefreshDto } from './dto/refresh.dto';
import { registerSchema, type RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import type { AuthUser } from './strategies/jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('check')
  @HttpCode(HttpStatus.OK)
  async check(
    @Body(new ZodValidationPipe(checkSchema)) dto: CheckDto,
  ): Promise<CheckResult> {
    return this.authService.check(dto.cedula);
  }

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto,
  ): Promise<AuthResult> {
    return this.authService.register(dto.cedula, dto.password);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Req() req: { user: UserDocument }): Promise<AuthResult> {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: { user: AuthUser }): Promise<AuthenticatedUser> {
    return this.authService.me(req.user.userId);
  }

  /** Token de corta vida para conectar el cliente offline a PowerSync. */
  @UseGuards(JwtAuthGuard)
  @Get('powersync-token')
  async powersyncToken(
    @Req() req: { user: AuthUser },
  ): Promise<PowerSyncTokenResult> {
    return this.authService.powersyncToken(req.user.userId);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto,
  ): Promise<AuthResult> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto,
  ): Promise<void> {
    return this.authService.logout(dto.refreshToken);
  }
}
