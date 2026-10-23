export type UserRole = 'admin' | 'home_guard';

export type AccountStatus = 'pending' | 'active' | 'suspended' | 'rejected';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  personnel_id?: string | null;
  role: UserRole;
  district_id?: string | null;
  unit_id?: string | null;
  account_status: AccountStatus;
  rank_designation?: string | null;
  avatar_url?: string | null;
  emergency_contact?: string | null;
  blood_group?: string | null;
  address?: string | null;
  created_at: string;
  updated_at: string;
  district?: District | null;
  unit?: Unit | null;
}

export interface District {
  id: string;
  name: string;
  code: string;
  headquarters?: string | null;
  created_at: string;
}

export interface Unit {
  id: string;
  district_id: string;
  name: string;
  code: string;
  description?: string | null;
  // `commander_id` is the `units.commander_id` foreign key onto profiles: the
  // officer in charge of the unit. It is not a login role — the former
  // 'commander' role was removed, so this always references an admin.
  commander_id?: string | null;
  created_at: string;
  district?: District | null;
  commander?: Profile | null;
}

export interface DutyLocation {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  district_id?: string | null;
  unit_id?: string | null;
  is_active: boolean;
  created_at: string;
  district?: District | null;
  unit?: Unit | null;
}

export type DutyAssignmentStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'absent';

export interface DutyAssignment {
  id: string;
  title: string;
  description?: string | null;
  duty_location_id?: string | null;
  district_id?: string | null;
  unit_id?: string | null;
  assigned_personnel_id: string;
  supervisor_id?: string | null;
  duty_date: string;
  start_time: string;
  end_time: string;
  status: DutyAssignmentStatus;
  reporting_instructions?: string | null;
  created_at: string;
  updated_at: string;
  location?: DutyLocation | null;
  personnel?: Profile | null;
  supervisor?: Profile | null;
  district?: District | null;
  unit?: Unit | null;
}

export type AttendanceEventType = 'check_in' | 'check_out';
export type AttendanceValidationStatus = 'verified' | 'flagged_distance' | 'flagged_timing' | 'manual_override';

export interface AttendanceEvent {
  id: string;
  user_id: string;
  duty_assignment_id?: string | null;
  location_id?: string | null;
  event_type: AttendanceEventType;
  latitude: number;
  longitude: number;
  distance_meters: number;
  is_within_geofence: boolean;
  validation_status: AttendanceValidationStatus;
  recorded_at: string;
  device_info?: string | null;
  remarks?: string | null;
  user?: Profile | null;
  location?: DutyLocation | null;
  duty_assignment?: DutyAssignment | null;
}

export type TaskStatus = 'new' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to?: string | null;
  assigned_by?: string | null;
  unit_id?: string | null;
  duty_assignment_id?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  assignee?: Profile | null;
  creator?: Profile | null;
  unit?: Unit | null;
}

export interface TaskStatusHistory {
  id: string;
  task_id: string;
  old_status?: string | null;
  new_status: string;
  changed_by?: string | null;
  notes?: string | null;
  created_at: string;
  changer?: Profile | null;
}

export type EventType = 'bandobast' | 'crowd_control' | 'traffic_management' | 'emergency' | 'ceremonial' | 'training';
export type EventStatus = 'planned' | 'active' | 'concluded' | 'cancelled';

export interface EventItem {
  id: string;
  title: string;
  description?: string | null;
  event_type: EventType;
  venue: string;
  duty_location_id?: string | null;
  district_id?: string | null;
  commander_id?: string | null;
  required_personnel: number;
  start_time: string;
  end_time: string;
  status: EventStatus;
  duty_instructions?: string | null;
  created_at: string;
  updated_at: string;
  commander?: Profile | null;
  location?: DutyLocation | null;
  district?: District | null;
  assigned_count?: number;
}

export interface EventAssignment {
  id: string;
  event_id: string;
  personnel_id: string;
  role_in_event?: string | null;
  assigned_at: string;
  personnel?: Profile | null;
  event?: EventItem | null;
}

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'general' | 'assignment' | 'alert' | 'approval' | 'task' | 'reminder';
  is_read: boolean;
  link?: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  details?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at: string;
  actor?: Profile | null;
}

export interface AppSetting {
  key: string;
  value: Record<string, unknown>;
  description?: string | null;
  updated_at: string;
}
