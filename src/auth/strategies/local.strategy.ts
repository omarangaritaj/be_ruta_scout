import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { UserDocument } from '../../users/schemas/user.schema';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'cedula', passwordField: 'password' });
  }

  async validate(cedula: string, password: string): Promise<UserDocument> {
    return this.authService.validateCredentials(cedula, password);
  }
}
