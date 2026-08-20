import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { User } from '../../users/user.entity';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'cedula', passwordField: 'password' });
  }

  async validate(cedula: string, password: string): Promise<User> {
    return this.authService.validateCredentials(cedula, password);
  }
}
