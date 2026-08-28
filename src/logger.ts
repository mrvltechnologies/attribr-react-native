/** Debug logging — only emits when `initialize({ debug: true })` was set. */
export class AttribrLogger {
  constructor(private enabled: boolean) {}

  debug(message: string): void {
    if (this.enabled) console.log(`[Attribr] ${message}`);
  }

  warn(message: string): void {
    if (this.enabled) console.warn(`[Attribr] ${message}`);
  }

  /** Errors always log, regardless of the debug flag — matches the Swift SDK's AttribrLogger.error. */
  error(message: string): void {
    console.error(`[Attribr] ${message}`);
  }
}
