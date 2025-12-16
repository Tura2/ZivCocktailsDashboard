# Dashboard Components

## Sidebar

**Path:** `src/components/dashboard/Sidebar.tsx`

**Description:**
Left navigation rail for the dashboard, showing the product identity, primary nav links, and the user profile shortcut.

**Props:**

- `activeItem?: SidebarNavKey` – Highlights the matching navigation key (defaults to `"dashboard"`).
- `className?: string` – Optional Tailwind utility overrides.

**Example:**

```tsx
<Sidebar activeItem="dashboard" />
```

---

## TopBar

**Path:** `src/components/dashboard/TopBar.tsx`

**Description:**
Header row for dashboard pages with title, subtitle, quick filter button, search, and utility icons.

**Props:**

- `title: string` – Page heading.
- `subtitle?: string` – Optional supporting copy.
- `className?: string` – Optional Tailwind utility overrides.

**Example:**

```tsx
<TopBar title="Dashboard" subtitle="Overview of your workshops & events" />
```

---

## Card

**Path:** `src/components/dashboard/Card.tsx`

**Description:**
Base white card wrapper that standardises padding, border, radius, and shadow for dashboard panels.

**Props:**

- `children: ReactNode` – Card body content.
- `className?: string` – Optional Tailwind utility overrides.

**Example:**

```tsx
<Card className="lg:col-span-2">Content</Card>
```

---

## KpiCard

**Path:** `src/components/dashboard/KpiCard.tsx`

**Description:**
Displays a single KPI value with an optional directional trend indicator.

**Props:**

- `label: string` – KPI title.
- `value: string | number` – Primary metric value.
- `trendLabel?: string` – Supplementary trend text (e.g. `"+18%"`).
- `trendDirection?: "up" | "down" | "neutral"` – Visual direction indicator (defaults to `"neutral"`).
- `className?: string` – Optional Tailwind utility overrides.

**Example:**

```tsx
<KpiCard label="Revenue" value="₪18,450" trendLabel="+12%" trendDirection="up" />
```

---

## KpiGrid

**Path:** `src/components/dashboard/KpiGrid.tsx`

**Description:**
Responsive grid layout for rendering one or more KPI cards.

**Props:**

- `items?: Array<{ key?: string; label: string; value: string | number; trendLabel?: string; trendDirection?: "up" | "down" | "neutral" }>` – Data-driven configuration for KPIs.
- `children?: ReactNode` – Alternative manual rendering of grid content.
- `className?: string` – Optional Tailwind utility overrides.

**Example:**

```tsx
<KpiGrid
  items={[
    { key: 'events', label: 'Events', value: '24', trendLabel: '+18%', trendDirection: 'up' },
    { key: 'guests', label: 'Guests', value: '312', trendLabel: '+9%', trendDirection: 'up' },
  ]}
/>
```

---

## EventsOverviewCard

**Path:** `src/components/dashboard/EventsOverviewCard.tsx`

**Description:**
Analytics card with a faux line chart, filter pills, and optional summary text for revenue/events trends.

**Props:**

- `title: string` – Card heading.
- `subtitle?: string` – Supporting text (e.g. timeframe).
- `summary?: string` – Optional footer summary string.
- `chartValues: number[]` – Data points used to render the placeholder polyline chart.
- `className?: string` – Optional Tailwind utility overrides.

**Example:**

```tsx
<EventsOverviewCard
  title="Events & Revenue Overview"
  subtitle="Last 30 days"
  summary="24 events · ₪54,320 revenue · 312 guests"
  chartValues={[96, 128, 118, 146]}
/>
```

---

## UpcomingEventsCard

**Path:** `src/components/dashboard/UpcomingEventsCard.tsx`

**Description:**
Table card that lists upcoming events with status pills and basic metadata.

**Props:**

- `events: Array<{ name: string; date: string; type: string; status: "confirmed" | "pending" | "cancelled" }>` – Rows to display.
- `className?: string` – Optional Tailwind utility overrides.

**Example:**

```tsx
<UpcomingEventsCard
  events={[
    { name: 'Tech Corp Mixer', date: 'Nov 18', type: 'Corporate Workshop', status: 'confirmed' },
    { name: 'Noa 30th', date: 'Nov 19', type: 'Private Event', status: 'pending' },
  ]}
/>
```

---

## TopHostsCard

**Path:** `src/components/dashboard/TopHostsCard.tsx`

**Description:**
Ranks hosts/bartenders with avatars, roles, and quick stat pills.

**Props:**

- `hosts: Array<{ name: string; role: string; events: number; rating: number; tips: string }>` – Host entries to render.
- `className?: string` – Optional Tailwind utility overrides.

**Example:**

```tsx
<TopHostsCard
  hosts={[
    { name: 'Dana Levi', role: 'Lead Bartender', events: 18, rating: 4.9, tips: '₪3,200' },
  ]}
/>
```

---

## PopularPackagesCard

**Path:** `src/components/dashboard/PopularPackagesCard.tsx`

**Description:**
Shows package popularity with booking counts and progress bars.

**Props:**

- `packages: Array<{ name: string; bookings: number; progress: number }>` – Package statistics; `progress` is a percentage 0–100.
- `className?: string` – Optional Tailwind utility overrides.

**Example:**

```tsx
<PopularPackagesCard
  packages={[
    { name: 'Classic Workshop', bookings: 12, progress: 82 },
    { name: 'Mixology Night', bookings: 9, progress: 64 },
  ]}
/>
```

---

## StatusPill

**Path:** `src/components/dashboard/StatusPill.tsx`

**Description:**
Color-coded label used for event statuses such as confirmed or pending.

**Props:**

- `variant: "confirmed" | "pending" | "cancelled"` – Determines colour styling.
- `label: string` – Text content displayed inside the pill.

**Example:**

```tsx
<StatusPill variant="confirmed" label="Confirmed" />
```
