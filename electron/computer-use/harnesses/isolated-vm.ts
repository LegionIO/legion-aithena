import type {
  ComputerActionProposal,
  ComputerEnvironmentMetadata,
  ComputerFrame,
  ComputerSession,
} from '../../../shared/computer-use.js';
import { makeComputerUseId, nowIso } from '../../../shared/computer-use.js';
import type { ComputerHarness, ComputerHarnessActionContext, ComputerHarnessActionResult } from './shared.js';
import { VmHttpClient, type VmRemoteFrame } from './vm-http-client.js';

type VmBinding = {
  client: VmHttpClient;
  remoteSessionId: string;
};

function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function frameToDataUrl(frame: VmRemoteFrame): string {
  if (frame.dataUrl) return frame.dataUrl;
  if (frame.dataBase64) {
    const mime = frame.mimeType ?? 'image/png';
    return `data:${mime};base64,${frame.dataBase64}`;
  }
  if (frame.url) return frame.url;
  throw new Error('Remote VM frame is missing image data (expected dataUrl, dataBase64, or url).');
}

function frameToComputerFrame(sessionId: string, frame: VmRemoteFrame): ComputerFrame {
  return {
    id: makeComputerUseId('frame'),
    sessionId,
    createdAt: frame.createdAt ?? nowIso(),
    mimeType: frame.mimeType ?? 'image/png',
    dataUrl: frameToDataUrl(frame),
    width: Math.max(1, Math.round(frame.width ?? 1)),
    height: Math.max(1, Math.round(frame.height ?? 1)),
    source: 'isolated-vm',
    summary: frame.summary,
    diffScore: frame.diffScore,
  };
}

function cleanEnvironment(environment: ComputerEnvironmentMetadata | undefined): ComputerEnvironmentMetadata {
  if (!environment) return {};
  return {
    url: typeof environment.url === 'string' ? environment.url : undefined,
    title: typeof environment.title === 'string' ? environment.title : undefined,
    appName: typeof environment.appName === 'string' ? environment.appName : undefined,
    windowTitle: typeof environment.windowTitle === 'string' ? environment.windowTitle : undefined,
    scrollX: typeof environment.scrollX === 'number' ? environment.scrollX : undefined,
    scrollY: typeof environment.scrollY === 'number' ? environment.scrollY : undefined,
    visibleText: typeof environment.visibleText === 'string' ? environment.visibleText : undefined,
    interactiveElements: Array.isArray(environment.interactiveElements) ? environment.interactiveElements : undefined,
    permissionState: environment.permissionState,
  };
}

export class IsolatedVmHarness implements ComputerHarness {
  readonly target = 'isolated-vm' as const;

  private static readonly bindings = new Map<string, VmBinding>();

  constructor(private readonly remoteVmUrl: string) {}

  async initialize(session: ComputerSession): Promise<void> {
    await this.ensureBinding(session);
  }

  async dispose(sessionId: string): Promise<void> {
    const binding = IsolatedVmHarness.bindings.get(sessionId);
    IsolatedVmHarness.bindings.delete(sessionId);
    if (!binding) return;

    await binding.client.deleteSession(binding.remoteSessionId).catch(() => {});
  }

  async captureFrame(session: ComputerSession): Promise<ComputerFrame> {
    const binding = await this.ensureBinding(session);
    const directFrame = await binding.client.getFrame(binding.remoteSessionId);
    if (directFrame) {
      return frameToComputerFrame(session.id, directFrame);
    }

    const state = await binding.client.getState(binding.remoteSessionId);
    if (!state.frame) {
      throw new Error('Remote VM state did not include a frame payload.');
    }
    return frameToComputerFrame(session.id, state.frame);
  }

  async movePointer(session: ComputerSession, action: ComputerActionProposal, context?: ComputerHarnessActionContext): Promise<ComputerHarnessActionResult> {
    return this.executeAction(session, { ...action, kind: 'movePointer' }, context);
  }

  async click(session: ComputerSession, action: ComputerActionProposal, context?: ComputerHarnessActionContext): Promise<ComputerHarnessActionResult> {
    return this.executeAction(session, { ...action, kind: 'click' }, context);
  }

  async doubleClick(session: ComputerSession, action: ComputerActionProposal, context?: ComputerHarnessActionContext): Promise<ComputerHarnessActionResult> {
    return this.executeAction(session, { ...action, kind: 'doubleClick' }, context);
  }

  async drag(session: ComputerSession, action: ComputerActionProposal, context?: ComputerHarnessActionContext): Promise<ComputerHarnessActionResult> {
    return this.executeAction(session, { ...action, kind: 'drag' }, context);
  }

  async scroll(session: ComputerSession, action: ComputerActionProposal, context?: ComputerHarnessActionContext): Promise<ComputerHarnessActionResult> {
    return this.executeAction(session, { ...action, kind: 'scroll' }, context);
  }

  async typeText(session: ComputerSession, action: ComputerActionProposal, context?: ComputerHarnessActionContext): Promise<ComputerHarnessActionResult> {
    return this.executeAction(session, { ...action, kind: 'typeText' }, context);
  }

  async pressKeys(session: ComputerSession, action: ComputerActionProposal, context?: ComputerHarnessActionContext): Promise<ComputerHarnessActionResult> {
    return this.executeAction(session, { ...action, kind: 'pressKeys' }, context);
  }

  async openApp(session: ComputerSession, action: ComputerActionProposal, context?: ComputerHarnessActionContext): Promise<ComputerHarnessActionResult> {
    return this.executeAction(session, { ...action, kind: 'openApp' }, context);
  }

  async focusWindow(session: ComputerSession, action: ComputerActionProposal, context?: ComputerHarnessActionContext): Promise<ComputerHarnessActionResult> {
    return this.executeAction(session, { ...action, kind: 'focusWindow' }, context);
  }

  async navigate(session: ComputerSession, action: ComputerActionProposal, context?: ComputerHarnessActionContext): Promise<ComputerHarnessActionResult> {
    return this.executeAction(session, { ...action, kind: 'navigate' }, context);
  }

  async waitForIdle(session: ComputerSession, action: ComputerActionProposal, context?: ComputerHarnessActionContext): Promise<ComputerHarnessActionResult> {
    return this.executeAction(session, { ...action, kind: 'wait' }, context);
  }

  async getEnvironmentMetadata(session: ComputerSession): Promise<ComputerEnvironmentMetadata> {
    const binding = await this.ensureBinding(session);
    const state = await binding.client.getState(binding.remoteSessionId);
    return cleanEnvironment(state.environment);
  }

  private async ensureBinding(session: ComputerSession): Promise<VmBinding> {
    const existing = IsolatedVmHarness.bindings.get(session.id);
    if (existing) return existing;

    const client = new VmHttpClient(normalizeBaseUrl(this.remoteVmUrl));
    const remoteSessionId = await client.createSession({
      clientSessionId: session.id,
      conversationId: session.conversationId,
      goal: session.goal,
      metadata: {
        selectedModelKey: session.selectedModelKey,
        selectedProfileKey: session.selectedProfileKey,
        approvalMode: session.approvalMode,
      },
    });
    const binding: VmBinding = { client, remoteSessionId };
    IsolatedVmHarness.bindings.set(session.id, binding);
    return binding;
  }

  private async executeAction(
    session: ComputerSession,
    action: ComputerActionProposal,
    context?: ComputerHarnessActionContext,
  ): Promise<ComputerHarnessActionResult> {
    const binding = await this.ensureBinding(session);
    const outcome = await binding.client.performAction(binding.remoteSessionId, action, context?.signal);

    if (outcome.error) {
      throw new Error(outcome.error);
    }

    return {
      summary: outcome.summary ?? `${action.kind} executed on remote VM.`,
      ...(outcome.frame ? { frame: frameToComputerFrame(session.id, outcome.frame) } : {}),
      ...(outcome.environment ? { environment: cleanEnvironment(outcome.environment) } : {}),
      ...(outcome.cursor ? { cursor: outcome.cursor } : {}),
    };
  }
}
