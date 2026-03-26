import type {
  ComputerActionProposal,
  ComputerEnvironmentMetadata,
  ComputerFrame,
  ComputerSession,
  ComputerUseCursorState,
  ComputerUseTarget,
} from '../../../shared/computer-use.js';

export type ComputerHarnessActionResult = {
  summary: string;
  frame?: ComputerFrame;
  environment?: ComputerEnvironmentMetadata;
  cursor?: Partial<ComputerUseCursorState>;
};

export type ComputerHarnessActionContext = {
  signal?: AbortSignal;
};

export interface ComputerHarness {
  readonly target: ComputerUseTarget;
  initialize(session: ComputerSession): Promise<void>;
  dispose(sessionId: string): Promise<void>;
  captureFrame(session: ComputerSession): Promise<ComputerFrame>;
  movePointer(session: ComputerSession, action: ComputerActionProposal, context?: ComputerHarnessActionContext): Promise<ComputerHarnessActionResult>;
  click(session: ComputerSession, action: ComputerActionProposal, context?: ComputerHarnessActionContext): Promise<ComputerHarnessActionResult>;
  doubleClick(session: ComputerSession, action: ComputerActionProposal, context?: ComputerHarnessActionContext): Promise<ComputerHarnessActionResult>;
  drag(session: ComputerSession, action: ComputerActionProposal, context?: ComputerHarnessActionContext): Promise<ComputerHarnessActionResult>;
  scroll(session: ComputerSession, action: ComputerActionProposal, context?: ComputerHarnessActionContext): Promise<ComputerHarnessActionResult>;
  typeText(session: ComputerSession, action: ComputerActionProposal, context?: ComputerHarnessActionContext): Promise<ComputerHarnessActionResult>;
  pressKeys(session: ComputerSession, action: ComputerActionProposal, context?: ComputerHarnessActionContext): Promise<ComputerHarnessActionResult>;
  openApp(session: ComputerSession, action: ComputerActionProposal, context?: ComputerHarnessActionContext): Promise<ComputerHarnessActionResult>;
  focusWindow(session: ComputerSession, action: ComputerActionProposal, context?: ComputerHarnessActionContext): Promise<ComputerHarnessActionResult>;
  navigate(session: ComputerSession, action: ComputerActionProposal, context?: ComputerHarnessActionContext): Promise<ComputerHarnessActionResult>;
  waitForIdle(session: ComputerSession, action: ComputerActionProposal, context?: ComputerHarnessActionContext): Promise<ComputerHarnessActionResult>;
  getEnvironmentMetadata(session: ComputerSession): Promise<ComputerEnvironmentMetadata>;
}
