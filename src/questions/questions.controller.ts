import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../authz/permissions.guard';
import { RequirePermissions } from '../authz/require-permissions.decorator';
import { ParseObjectIdPipe, ZodValidationPipe } from '../common';
import {
  createQuestionSchema,
  type CreateQuestionDto,
} from './dto/create-question.dto';
import {
  listQuestionsSchema,
  type ListQuestionsDto,
} from './dto/list-questions.dto';
import {
  updateQuestionSchema,
  type UpdateQuestionDto,
} from './dto/update-question.dto';
import { QuestionDocument } from './schemas/question.schema';
import { QuestionsService } from './questions.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  @Get()
  @RequirePermissions('question:read')
  async findAll(
    @Query(new ZodValidationPipe(listQuestionsSchema)) query: ListQuestionsDto,
  ): Promise<QuestionDocument[]> {
    return this.questionsService.findAll(query.branch, query.includeInactive);
  }

  @Post()
  @RequirePermissions('question:create')
  async create(
    @Body(new ZodValidationPipe(createQuestionSchema)) dto: CreateQuestionDto,
  ): Promise<QuestionDocument> {
    return this.questionsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('question:update')
  async update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(updateQuestionSchema)) dto: UpdateQuestionDto,
  ): Promise<QuestionDocument> {
    return this.questionsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('question:delete')
  async remove(@Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    return this.questionsService.remove(id);
  }
}
