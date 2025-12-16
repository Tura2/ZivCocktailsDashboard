export class HttpError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class AlreadyRunningError extends HttpError {
  readonly runningJobId: string;

  constructor(runningJobId: string) {
    super(409, 'Refresh job already running', 'already_running');
    this.runningJobId = runningJobId;
  }
}
