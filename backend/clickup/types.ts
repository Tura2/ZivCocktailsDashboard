export interface ClickUpDropdownOption {
  id?: string;
  name?: string;
  orderindex?: number;
}

export interface ClickUpCustomFieldTypeConfig {
  options?: ClickUpDropdownOption[];
}

export interface ClickUpCustomField {
  id: string;
  name?: string;
  type?: string;
  value?: unknown;
  type_config?: ClickUpCustomFieldTypeConfig;
}

export interface ClickUpCommentUser {
  id?: number;
  username?: string;
}

export interface ClickUpTaskComment {
  id?: string;
  comment_text?: string;
  user?: ClickUpCommentUser;
  date?: string; // ms as string
}

export interface ClickUpTaskCommentsResponse {
  comments?: ClickUpTaskComment[];
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
