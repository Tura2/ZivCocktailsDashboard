export interface RefreshRequestBody {
  targetMonth?: string;
}

export interface RefreshResponseBody {
  jobId: string;
  status: 'success' | 'already_running';
  writtenSnapshots: string[];
  skippedSnapshots: string[];
  targetMonth: string;
}
