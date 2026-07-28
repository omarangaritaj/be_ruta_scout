import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppNotFoundException } from '../common';
import { type Branch } from '../domain';
import { K } from '../i18n';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { Question, QuestionDocument } from './schemas/question.schema';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectModel(Question.name)
    private readonly questionModel: Model<QuestionDocument>,
  ) {}

  async findAll(
    branch?: Branch,
    includeInactive = false,
  ): Promise<QuestionDocument[]> {
    const filter: Record<string, unknown> = includeInactive
      ? {}
      : { isActive: true };
    if (branch) filter.branch = branch;
    return this.questionModel.find(filter).sort({ order: 1, _id: 1 }).exec();
  }

  async findActiveByBranch(branch: Branch): Promise<QuestionDocument[]> {
    return this.findAll(branch);
  }

  async create(dto: CreateQuestionDto): Promise<QuestionDocument> {
    return this.questionModel.create(dto);
  }

  async update(id: string, dto: UpdateQuestionDto): Promise<QuestionDocument> {
    const updated = await this.questionModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!updated) throw new AppNotFoundException(K.QUESTIONS.NOT_FOUND, { id });
    return updated;
  }

  async remove(id: string): Promise<void> {
    const updated = await this.questionModel
      .findByIdAndUpdate(id, { isActive: false })
      .exec();
    if (!updated) throw new AppNotFoundException(K.QUESTIONS.NOT_FOUND, { id });
  }
}
