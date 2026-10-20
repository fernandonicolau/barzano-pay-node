export class BarzanoError extends Error {
  readonly name = 'BarzanoError';

  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly requestId: string | null,
    readonly details?: unknown,
  ) {
    super(message);
  }
}
