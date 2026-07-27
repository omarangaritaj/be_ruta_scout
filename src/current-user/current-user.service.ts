import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppNotFoundException } from '../common';
import type { AppConfigService } from '../config';
import { K } from '../i18n';
import { RedisService } from '../redis/redis.service';
import {
  currenUserAggregation,
  type CurrentUser,
} from '../users/queries/currentUser.query';
import { User, UserDocument } from '../users/schemas/user.schema';

const cacheKey = (idSiscout: string): string => `current_user:${idSiscout}`;

@Injectable()
export class CurrentUserService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly redis: RedisService,
    @Inject(ConfigService)
    private readonly config: AppConfigService,
  ) {}

  async get(idSiscout: string): Promise<CurrentUser> {
    const currentUser = await this.redis.get<CurrentUser>(cacheKey(idSiscout));
    if (!currentUser) {
      throw new AppNotFoundException(K.REQUESTS.AUTHENTICATED_PERSON_NOT_FOUND);
    }
    return currentUser;
  }

  async seed(idSiscout: string): Promise<void> {
    const currentUser = await this.build(idSiscout);
    if (!currentUser) return;
    await this.redis.set(
      cacheKey(idSiscout),
      currentUser,
      this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true }),
    );
  }

  async refresh(idSiscout: string): Promise<void> {
    if (!(await this.redis.has(cacheKey(idSiscout)))) return;
    const currentUser = await this.build(idSiscout);
    if (!currentUser) return;
    await this.redis.updateExisting(cacheKey(idSiscout), currentUser);
  }

  async refreshByRole(roleId: string): Promise<void> {
    const users = await this.userModel
      .find({ roles: roleId })
      .select('idSiscout')
      .lean<{ idSiscout: string }[]>()
      .exec();
    await Promise.all(users.map((u) => this.refresh(u.idSiscout)));
  }

  async invalidate(idSiscout: string): Promise<void> {
    await this.redis.del(cacheKey(idSiscout));
  }

  private async build(idSiscout: string): Promise<CurrentUser | undefined> {
    const [currentUser] = await this.userModel.aggregate<CurrentUser>(
      currenUserAggregation(idSiscout),
    );
    return currentUser;
  }
}
