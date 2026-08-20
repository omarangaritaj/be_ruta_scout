import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiscoutCredentialsController } from './siscout-credentials.controller';
import { SiscoutCredentialsService } from './siscout-credentials.service';
import { SiscoutCredential } from './siscout-credential.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SiscoutCredential])],
  controllers: [SiscoutCredentialsController],
  providers: [SiscoutCredentialsService],
  exports: [SiscoutCredentialsService],
})
export class SiscoutCredentialsModule {}
