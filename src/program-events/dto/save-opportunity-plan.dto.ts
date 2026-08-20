import { z } from 'zod';
import { opportunityPlanSchema } from './create-program-event.dto';

export const saveOpportunityPlanSchema = opportunityPlanSchema;

export type SaveOpportunityPlanDto = z.infer<typeof saveOpportunityPlanSchema>;
