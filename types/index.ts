export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  apiKey?: string;
  isAdmin?: boolean;
  companyName?: string | null;
}

export interface AuthenticatedSeller {
  id: string;
  name: string;
  email: string;
}

export interface Client {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  source?: string | null;
  tags: string[];
  score: number;
  status: string;
  createdAt: string;
  notes?: string | null;
  age?: number | null;
  country?: string | null;
  birthDate?: string | null;
  language?: string | null;
  anamnesisResponses?: Record<string, unknown> | null;
}

export interface Aluno {
  id: string;
  nomeCompleto: string;
  telefone?: string | null;
  pais?: string | null;
  email?: string | null;
  profissao?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CourseLead {
  id: string;
  nomeCompleto: string;
  telefone?: string | null;
  pais?: string | null;
  email?: string | null;
  origem: string;
  nota?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  name?: string | null;
  email?: string | null;
  contact?: string | null;
  source?: string | null;
  notes?: string | null;
  score: number;
  stage: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LeadStatus {
  id: string;
  slug: string;
  name: string;
  isSystem: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MetaAdsIntegration {
  id: string;
  name: string;
  enabled: boolean;
  n8nWebhookUrl?: string | null;
  accessToken?: string | null;
  pixelId?: string | null;
  testEventCode?: string | null;
  defaultContentName?: string | null;
  defaultContentCategory?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MetaAdsEvent {
  id: string;
  name: string;
  metaEventName: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetaAdsStatusMapping {
  id: string;
  statusSlug: string;
  eventId: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  event?: MetaAdsEvent;
}

export interface MetaAdsConfigResponse {
  integration: MetaAdsIntegration;
  events: MetaAdsEvent[];
  mappings: MetaAdsStatusMapping[];
  statuses: LeadStatus[];
}

export interface Seller {
  id: string;
  name: string;
  email?: string | null;
  contactNumber?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SellerAvailabilitySlot {
  id: string;
  day: WeekDay;
  dayOfMonth?: number | null;
  specificDate?: string | null;
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
}

export type WeekDay =
  | 'SUNDAY'
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY';

export interface Appointment {
  id: string;
  leadId: string;
  start: string;
  end: string;
  createdAt: string;
  status: string;
  meetLink?: string | null;
  googleEventId?: string | null;
  lead: {
    id: string;
    name?: string | null;
    email?: string | null;
    contact?: string | null;
    stage?: string | null;
  };
  sellerVideoCallAccesses?: Array<{
    id: string;
    sellerId: string;
    leadId: string;
    appointmentId?: string | null;
    status: string;
    expiresAt?: string | null;
    seller: { id: string; name: string; email?: string | null };
  }>;
}

export interface SellerCallNote {
  id: string;
  sellerId?: string | null;
  leadId?: string;
  appointmentId?: string | null;
  title?: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  seller?: { id: string; name: string; email?: string | null };
  lead?: { id: string; name?: string | null; email?: string | null; contact?: string | null; stage?: string | null };
  appointment?: Appointment;
}

export interface SellerReminder {
  id: string;
  sellerId?: string | null;
  leadId?: string | null;
  appointmentId?: string | null;
  title: string;
  content?: string | null;
  remindAt: string;
  status: 'PENDING' | 'DONE' | 'CANCELED';
  createdAt: string;
  updatedAt: string;
}

export interface SellerReminderOverviewItem extends SellerReminder {
  seller?: { id: string; name: string; email?: string | null };
  lead?: { id: string; name?: string | null; email?: string | null; contact?: string | null; stage?: string | null };
  appointment?: Appointment;
}

export interface AppointmentBySellerReportRow {
  sellerId: string;
  sellerName: string;
  sellerEmail: string | null;
  appointment: Appointment;
  notesCount: number;
  lastNoteUpdatedAt: string | null;
}

export interface CampaignLog {
  id: string;
  message: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  channel: string;
  message: string;
  imageUrl?: string | null;
  status: string;
  scheduledAt?: string | null;
  logs?: CampaignLog[];
}

export interface FunnelReport {
  counts: Record<string, number>;
  conversionRate: number;
}

export interface TimeSeriesItem {
  label: string;
  total: number;
}

export interface AppointmentsReport {
  byStatus: Record<string, number>;
  byWeek: TimeSeriesItem[];
}

export interface DashboardStatusItem {
  status: string;
  count: number;
  percent?: number;
}

export interface DashboardOriginItem {
  origin: string;
  count: number;
  percent?: number;
}

export interface DashboardSourceStageItem {
  stage: string;
  count: number;
  percent: number;
}

export interface DashboardSourceFunnel {
  source: string;
  totalLeads: number;
  stages: DashboardSourceStageItem[];
  conversion: {
    agendouFromTotal: number;
    entrouFromAgendou: number;
    comprouFromEntrou: number;
    comprouFromTotal: number;
  };
}

export interface DashboardSeriesDay {
  date: string;
  totalLeads: number;
  statuses: Array<{ status: string; count: number }>;
}

export interface DashboardSeriesResponse {
  startDate: string;
  endDate: string;
  days: number;
  series: DashboardSeriesDay[];
}

export interface DashboardChannelTotal {
  source: string;
  count: number;
  percent: number;
}

export interface DashboardHourlyLead {
  hour: number;
  count: number;
}

export interface DashboardResponse {
  date: string;
  totalLeads: number;
  top5Statuses: DashboardStatusItem[];
  origins: DashboardOriginItem[];
  sourceFunnels: DashboardSourceFunnel[];
  channelTotals: DashboardChannelTotal[];
  hourlyLeads: DashboardHourlyLead[];
}
