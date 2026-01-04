# Employer Events Per Month (ClickUp)

This document describes how the script calculates how many events each staff member (employee) did per month.

Script: `HR/staff/calc_employer_events_per_month.py`

## Concrete IDs (Current)

- **List IDs**
  - Event Calendar: `901214362128`
  - Staff Directory: `901214362129`
- **Event Calendar custom field IDs**
  - Assigned Staff: `61f29c83-d538-4d62-97bb-c221572d2c47`
  - Requested Date: `1660701a-1263-41cf-bb7a-79e3c3638aa3`

## Data Source

The script reads tasks from the **ClickUp “Event Calendar” list** and uses the relationship field on each event task to determine which staff member(s) are assigned to that event.

### Fields Used

- **Relationship field on Event Calendar**: `Assigned Staff`
  - This is a ClickUp *relationship custom field*.
  - Value is typically a list of linked Staff task IDs (sometimes strings, sometimes objects with an `id`).
- **Event date field**: `Requested Date`
  - This is the **only** date used to determine “when the event happens”.
  - If `Requested Date` is missing, the event is not counted.
- **Event status**: must be `done` (case-insensitive)
  - Only events whose status name equals `done` are counted.

## ClickUp API Endpoints Used

The script uses ClickUp API v2 via `requests`.

1. Find the Space ID (by name)
   - `GET /api/v2/team/{team_id}/space`
   - Finds the space named `Management - Ziv Cocktails` (default) and returns its `id`.

2. Find list IDs inside the Space
   - Folderless lists:
     - `GET /api/v2/space/{space_id}/list`
   - Folder lists:
     - `GET /api/v2/space/{space_id}/folder`
     - `GET /api/v2/folder/{folder_id}/list`
   - Matches list names:
     - `Event Calendar`
     - `Staff Directory`

3. Resolve custom field IDs on Event Calendar
   - `GET /api/v2/list/{event_list_id}/field`
   - Finds the IDs for:
     - `Assigned Staff`
     - `Requested Date`

4. Fetch tasks
   - Event Calendar tasks:
     - `GET /api/v2/list/{event_list_id}/task?page=N&include_closed=true&subtasks=true`
   - Staff Directory tasks (used to map staff task ID → staff name):
     - `GET /api/v2/list/{staff_list_id}/task?page=N&include_closed=true&subtasks=true`

## Calculation Logic

For each Event Calendar task:

1. **Status filter**
   - Read the task status name (`task.status.status`).
   - Skip the task unless it equals `done`.

2. **Relationship filter**
   - Read the `Assigned Staff` custom field value.
   - Extract the linked staff task IDs.
   - Skip the task if it has no linked staff.

3. **Date filter**
   - Read the `Requested Date` custom field value (milliseconds timestamp).
   - Skip the task if it is missing/empty.

4. **Month grouping**
   - Convert the `Requested Date` timestamp into a month key `YYYY-MM`.
   - Uses timezone `Asia/Jerusalem` by default.

5. **Counting**
   - For every staff ID linked to the event, increment:
     - `(staff_task_id, YYYY-MM) += 1`

6. **Output**
   - Produces rows with:
     - `staff_name`, `staff_task_id`, `month`, `event_count`
   - Output format can be CSV (default) or JSON.

## CLI Options (Common)

- `--start YYYY-MM` / `--end YYYY-MM`: month range filter (inclusive)
- `--done-status done`: change the status name if ClickUp uses a different label
- `--format csv|json`: output format
- `--out <path>`: output file path

Example:

- `python "HR\staff\calc_employer_events_per_month.py" --start 2025-01 --end 2026-12 --format json --out "HR\staff\employer_events_per_month.json"`
