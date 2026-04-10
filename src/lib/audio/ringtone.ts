/**
 * Synthesized US phone ring tone using the Web Audio API.
 *
 * Pattern: 440 Hz + 480 Hz for 2 seconds, then 4 seconds silence, repeating.
 * Plays through the selected output audio device.
 */

const RING_FREQ_A = 440;
const RING_FREQ_B = 480;
const RING_DURATION_MS = 2000;
const SILENCE_DURATION_MS = 4000;
const CYCLE_MS = RING_DURATION_MS + SILENCE_DURATION_MS;
const RING_VOLUME = 0.15; // Moderate volume — not too loud

export class Ringtone {
  private audioCtx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private oscA: OscillatorNode | null = null;
  private oscB: OscillatorNode | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private ringTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private _playing = false;

  get playing(): boolean {
    return this._playing;
  }

  /**
   * Start the ring tone, optionally routing to a specific output device.
   */
  async start(outputDeviceId?: string): Promise<void> {
    if (this._playing) return;
    this._playing = true;

    try {
      this.audioCtx = new AudioContext();

      // Route to selected output device if supported
      if (outputDeviceId) {
        try {
          const ctx = this.audioCtx as AudioContext & { setSinkId?: (id: string) => Promise<void> };
          if (typeof ctx.setSinkId === 'function') {
            await ctx.setSinkId(outputDeviceId);
          }
        } catch (err) {
          console.warn('[Ringtone] Failed to set output device:', err);
        }
      }

      // Create a gain node for volume control (starts silent)
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = 0;
      this.gainNode.connect(this.audioCtx.destination);

      // Create two oscillators for the dual-tone ring
      this.oscA = this.audioCtx.createOscillator();
      this.oscA.type = 'sine';
      this.oscA.frequency.value = RING_FREQ_A;
      this.oscA.connect(this.gainNode);
      this.oscA.start();

      this.oscB = this.audioCtx.createOscillator();
      this.oscB.type = 'sine';
      this.oscB.frequency.value = RING_FREQ_B;
      this.oscB.connect(this.gainNode);
      this.oscB.start();

      // Start the first ring immediately
      this.ringOn();

      // Set up the repeating ring cycle
      this.intervalId = setInterval(() => {
        if (!this._playing) return;
        this.ringOn();
      }, CYCLE_MS);
    } catch (err) {
      console.error('[Ringtone] Failed to start:', err);
      this._playing = false;
    }
  }

  /**
   * Stop the ring tone.
   */
  stop(): void {
    if (!this._playing) return;
    this._playing = false;

    if (this.intervalId != null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.ringTimeoutId != null) {
      clearTimeout(this.ringTimeoutId);
      this.ringTimeoutId = null;
    }

    // Fade out quickly to avoid click
    if (this.gainNode && this.audioCtx) {
      try {
        this.gainNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.audioCtx.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.05);
      } catch {
        // Ignore — context may be closed
      }
    }

    // Disconnect oscillators after fade
    setTimeout(() => {
      this.oscA?.stop();
      this.oscA?.disconnect();
      this.oscA = null;

      this.oscB?.stop();
      this.oscB?.disconnect();
      this.oscB = null;

      this.gainNode?.disconnect();
      this.gainNode = null;

      if (this.audioCtx) {
        void this.audioCtx.close().catch(() => {});
        this.audioCtx = null;
      }
    }, 100);
  }

  /**
   * Alias for stop + full cleanup.
   */
  destroy(): void {
    this.stop();
  }

  /* ── Private ── */

  private ringOn(): void {
    if (!this.gainNode || !this.audioCtx || !this._playing) return;

    // Fade in over 30ms
    this.gainNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
    this.gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
    this.gainNode.gain.linearRampToValueAtTime(RING_VOLUME, this.audioCtx.currentTime + 0.03);

    // Schedule fade out after RING_DURATION_MS
    this.ringTimeoutId = setTimeout(() => {
      this.ringOff();
    }, RING_DURATION_MS);
  }

  private ringOff(): void {
    if (!this.gainNode || !this.audioCtx || !this._playing) return;

    // Fade out over 30ms
    this.gainNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.audioCtx.currentTime);
    this.gainNode.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.03);
  }
}
