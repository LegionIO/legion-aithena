import type { ComputerSession } from '../../../shared/computer-use.js';
import type { LLMModelConfig } from '../../agent/model-catalog.js';
import type { PlannedActions } from './shared.js';

export async function geminiPlanSession(_session: ComputerSession, _modelConfig: LLMModelConfig): Promise<PlannedActions> {
  throw new Error('Gemini computer use is not available in the current runtime yet. Add Google model runtime support first.');
}
