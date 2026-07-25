import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SiscoutCredentialsController } from './siscout-credentials.controller';
import { SiscoutCredentialsService } from './siscout-credentials.service';
import {
  SiscoutCredential,
  SiscoutCredentialSchema,
} from './schemas/siscout-credential.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SiscoutCredential.name, schema: SiscoutCredentialSchema },
    ]),
  ],
  controllers: [SiscoutCredentialsController],
  providers: [SiscoutCredentialsService],
  exports: [SiscoutCredentialsService],
})
export class SiscoutCredentialsModule {}
