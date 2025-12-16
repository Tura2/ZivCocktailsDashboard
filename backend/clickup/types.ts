export interface ClickUpCustomField {
  id: string;
  name?: string;
  type?: string;
  value?: unknown;
}

export interface ClickUpStatus {
  status?: string;
}

export interface ClickUpTask {
  id: string;
  name?: string;
  status?: ClickUpStatus;
  date_created?: string; // ms as string
  date_updated?: string; // ms as string
  date_closed?: string | null; // ms as string
  custom_fields?: ClickUpCustomField[];
}

export interface ClickUpListTasksResponse {
  tasks: ClickUpTask[];
  last_page?: boolean;
}
