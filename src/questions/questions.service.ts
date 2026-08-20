import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type FindOptionsWhere } from 'typeorm';
import { AppNotFoundException } from '../common';
import { type Branch } from '../domain';
import { K } from '../i18n';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { Question } from './question.entity';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectRepository(Question)
    private readonly questions: Repository<Question>,
  ) {}

  async findAll(branch?: Branch, includeInactive = false): Promise<Question[]> {
    const where: FindOptionsWhere<Question> = includeInactive
      ? {}
      : { isActive: true };
    if (branch) where.branch = branch;
    return this.questions.find({ where, order: { order: 'ASC', id: 'ASC' } });
  }

  async findActiveByBranch(branch: Branch): Promise<Question[]> {
    return this.findAll(branch);
  }

  async create(dto: CreateQuestionDto): Promise<Question> {
    return this.questions.save(this.questions.create(dto));
  }

  async update(id: string, dto: UpdateQuestionDto): Promise<Question> {
    const question = await this.questions.findOne({ where: { id } });
    if (!question) {
      throw new AppNotFoundException(K.QUESTIONS.NOT_FOUND, { id });
    }
    Object.assign(question, dto);
    return this.questions.save(question);
  }

  async remove(id: string): Promise<void> {
    const { affected } = await this.questions.update(
      { id },
      { isActive: false },
    );
    if (!affected) {
      throw new AppNotFoundException(K.QUESTIONS.NOT_FOUND, { id });
    }
  }
}
