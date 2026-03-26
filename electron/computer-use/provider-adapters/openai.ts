import type { ComputerSession } from '../../../shared/computer-use.js';
import type { LLMModelConfig } from '../../agent/model-catalog.js';
import { createPlannerState, generateNextActions, type PlannedActions } from './shared.js';

export async function openaiPlanSession(
  session: ComputerSession,
  modelConfig: LLMModelConfig,
  role: 'driver' | 'recovery' = 'driver',
): Promise<PlannedActions> {
  const plannerState = session.plannerState ?? await createPlannerState(session.goal, modelConfig, session.conversationContext);
  return generateNextActions({
    session: { ...session, plannerState },
    modelConfig,
    role,
  });
}
