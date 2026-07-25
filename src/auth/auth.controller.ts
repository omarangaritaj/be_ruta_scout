import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common';
import { UserDocument } from '../users/schemas/user.schema';
import { AuthService, type AuthResult, type CheckResult } from './auth.service';
import { checkSchema, type CheckDto } from './dto/check.dto';
import { refreshSchema, type RefreshDto } from './dto/refresh.dto';
import { registerSchema, type RegisterDto } from './dto/register.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';

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
