/**
 * DaemonChatClient — thin HTTP client that forwards LLM inference requests
 * to the LegionIO daemon running on localhost.
 *
 * All skill injection, enrichment, and inference runs daemon-side.
 * This client is a transport layer only.
 */

export interface DaemonChatOptions {
  baseUrl: string;
  conversationId?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface InferenceRequest {
  messages: Message[];
  metadata?: Record<string, unknown>;
  stream?: boolean;
}

export interface InferenceChunk {
  delta?: string;
  done?: boolean;
  error?: string;
}

export class DaemonChatClient {
  private readonly _baseUrl: string;
  private readonly _conversationId: string;

  constructor(options: DaemonChatOptions) {
    this._baseUrl = options.baseUrl.replace(/\/$/, '');
    this._conversationId = options.conversationId ?? `conv_${Math.random().toString(36).slice(2, 10)}`;
  }

  get conversationId(): string {
    return this._conversationId;
  }

  private get inferenceUrl(): string {
    return `${this._baseUrl}/api/llm/inference`;
  }

  /**
   * Send a user message to the daemon. Streams response chunks to the callback.
   * Returns the full concatenated response text.
   */
  async sendMessage(
    content: string,
    onChunk: (chunk: string) => void,
    metadata: Record<string, unknown> = {}
  ): Promise<string> {
    const body: InferenceRequest = {
      messages: [{ role: 'user', content }],
      metadata: { ...metadata, conversation_id: this._conversationId },
      stream:   true
    };

    const response = await fetch(this.inferenceUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Daemon inference error ${response.status}: ${err}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      onChunk(chunk);
    }

    return fullText;
  }

  /**
   * Cancel any active skill running in this conversation.
   */
  async cancelSkill(): Promise<boolean> {
    const url = `${this._baseUrl}/api/skills/${this._conversationId}/cancel`;
    const response = await fetch(url, { method: 'DELETE' });
    if (!response.ok) return false;

    const data = await response.json() as { cancelled?: boolean };
    return data.cancelled === true;
  }
}
