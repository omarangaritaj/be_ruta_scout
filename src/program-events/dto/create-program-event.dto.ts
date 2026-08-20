import { z } from 'zod';
import { uuidSchema } from '../../common';
import { D, GROWTH_AREAS, RISK_TYPES, ROLE_LEVELS } from '../../domain';
import { K, t } from '../../i18n';
import { allAnswered } from '../answers';
import { isDayWithin, isSingleDay, toMidnightUTC } from '../event-dates';
import { isScopeCoherent } from '../event-scope';

const answerSchema = z.union([z.boolean(), z.null()]);

const safeguardingSchema = z.object({
  buttonReady: answerSchema,
  buttonReachable: answerSchema,
  usageKnown: answerSchema,
  inclusionAdjustment: answerSchema,
  adjustmentDetail: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

const onlineSchema = z.object({
  isOnline: answerSchema,
  parentalSupport: answerSchema.optional(),
  adultsTrained: answerSchema.optional(),
  protagonistsTrained: answerSchema.optional(),
  safeguardStrategies: answerSchema.optional(),
  strategiesDetail: z.string().trim().optional(),
});

const agendaMomentSchema = z.object({
  day: z.string(),
  startTime: z.string(),
  endTime: z.string().optional(),
  title: z.string().trim(),
  description: z.string().trim(),
  responsibleUserId: uuidSchema.optional(),
  responsibleOther: z.string().trim().optional(),
  place: z.string().trim().optional(),
  materials: z.string().trim().optional(),
});

const riskScoreSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

const riskEntrySchema = z.object({
  hazard: z.string().trim(),
  risk: z.string().trim(),
  type: z.enum(RISK_TYPES),
  probability: riskScoreSchema,
  consequence: riskScoreSchema,
  controls: z.string().trim(),
});

const riskManagementSchema = z.object({
  checks: z.array(answerSchema).length(4),
  risks: z.array(riskEntrySchema).default([]),
});

const adultTeamMemberSchema = z.object({
  internal: z.boolean(),
  name: z.string().trim(),
  role: z.string().trim(),
  phone: z.string().trim(),
});

const materialItemSchema = z.object({
  name: z.string().trim(),
  description: z.string().trim().optional(),
  quantity: z.string().trim().optional(),
});

export const opportunityPlanSchema = z.object({
  place: z.string().trim().optional(),
  protagonistCount: z.number().int().nonnegative().optional(),
  leadName: z.string().trim().optional(),
  duration: z.string().trim().optional(),
  growthAreas: z.array(z.enum(GROWTH_AREAS)).default([]),
  competencies: z.record(z.string(), z.array(z.string())).default({}),
  observableBehaviours: z.array(z.string()).default([]),
  followUpTechniques: z
    .array(z.object({ technique: z.string(), detail: z.string() }))
    .default([]),
  environmentContext: z.string().trim().optional(),
  priorRecommendations: z.string().trim().optional(),
  stepByStep: z.string().trim().optional(),
});

// Las fechas se normalizan aquí y no en el servicio: así ninguna vía de
// entrada puede saltarse la invariante de medianoche UTC de la que depende el
// índice único que impide dos reuniones de la misma unidad el mismo día.
const fechaSchema = z.coerce.date().transform(toMidnightUTC);

const baseFields = {
  unitId: uuidSchema,
  // EventScope es 'rama' | 'grupo' | 'region' | 'nacion': el mismo conjunto
  // que ROLE_LEVELS (ACCESS_LEVELS menos 'super_admin', que no describe un
  // ámbito de actividad). Se reusa esa constante en vez de repetir los
  // literales: la regla de lint del dominio los prohíbe fuera de `D`/las
  // constantes generadas.
  scope: z.enum(ROLE_LEVELS),
  name: z.string().trim().min(1),
  startDate: fechaSchema,
  endDate: fechaSchema,
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  place: z.string().trim().min(1),
  responsibleUserId: uuidSchema.optional(),
  safeguarding: safeguardingSchema,
  online: onlineSchema.optional(),
  agenda: z.array(agendaMomentSchema).default([]),
  riskManagement: riskManagementSchema,
  adultTeam: z.array(adultTeamMemberSchema).default([]),
  materials: z.array(materialItemSchema).default([]),
  participatingUnitIds: z.array(uuidSchema).default([]),
};

// La reunión exige ciclo; la actividad lo acepta pero no lo pide. Esa es la
// única diferencia estructural entre ambas formas.
const reunionSchema = z.object({
  ...baseFields,
  kind: z.literal('reunion'),
  cycleId: uuidSchema,
});

const actividadSchema = z.object({
  ...baseFields,
  kind: z.literal('actividad'),
  cycleId: uuidSchema.optional(),
});

export const createProgramEventSchema = z
  .discriminatedUnion('kind', [reunionSchema, actividadSchema])
  .refine((data) => data.endDate.getTime() >= data.startDate.getTime(), {
    error: t(K.EVENTS.INVALID_DATE_RANGE),
    path: ['endDate'],
  })
  .refine(
    (data) =>
      data.kind !== 'reunion' || isSingleDay(data.startDate, data.endDate),
    { error: t(K.EVENTS.SINGLE_DAY_REQUIRED), path: ['endDate'] },
  )
  .refine((data) => isScopeCoherent(data.kind, data.scope), {
    error: t(K.EVENTS.SCOPE_NOT_ALLOWED),
    path: ['scope'],
  })
  .refine(
    (data) =>
      allAnswered([
        data.safeguarding.buttonReady,
        data.safeguarding.buttonReachable,
        data.safeguarding.usageKnown,
        data.safeguarding.inclusionAdjustment,
      ]),
    { error: t(K.EVENTS.ANSWER_REQUIRED), path: ['safeguarding'] },
  )
  .refine((data) => allAnswered(data.riskManagement.checks), {
    error: t(K.EVENTS.ANSWER_REQUIRED),
    path: ['riskManagement', 'checks'],
  })
  .refine(
    (data) =>
      data.agenda.every((momento) =>
        isDayWithin(momento.day, data.startDate, data.endDate),
      ),
    { error: t(K.EVENTS.AGENDA_DAY_OUTSIDE_RANGE), path: ['agenda'] },
  )
  .refine(
    (data) =>
      data.scope !== D.ACCESS_LEVEL.RAMA ||
      data.participatingUnitIds.length === 0,
    {
      error: t(K.EVENTS.PARTICIPATING_UNITS_NOT_ALLOWED),
      path: ['participatingUnitIds'],
    },
  );

export type CreateProgramEventDto = z.infer<typeof createProgramEventSchema>;
