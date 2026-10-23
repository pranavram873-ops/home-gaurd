// The verified PostgREST column lists, in one place so a dashboard count and the
// list screen beneath it cannot drift into describing different shapes.
//
// Two rules every list here follows:
//
// 1. A join is named by its foreign-key constraint (`!constraint_name`). Where
//    two constraints connect the same pair of tables — `profiles.unit_id` and
//    `units.commander_id`, or a task's assignee and its creator — PostgREST
//    refuses an unhinted join with PGRST201.
// 2. A table embedded more than once in one select is aliased, or the response
//    fails with 42712 "table name specified more than once". Every alias below
//    matches the property name declared in `src/types`.

export const DISTRICT_SELECT = 'id, name, code, headquarters, created_at';

export const PROFILE_SELECT = [
  'id, full_name, email, phone, personnel_id, role, account_status, rank_designation',
  'avatar_url, emergency_contact, blood_group, address, district_id, unit_id, created_at, updated_at',
  'district:districts!profiles_district_id_fkey ( id, name, code )',
  'unit:units!profiles_unit_id_fkey ( id, name, code )',
].join(', ');

export const UNIT_SELECT = [
  'id, name, code, description, district_id, commander_id, created_at',
  'district:districts!units_district_id_fkey ( id, name, code )',
  'commander:profiles!fk_units_commander ( id, full_name, personnel_id )',
].join(', ');

export const LOCATION_SELECT = [
  'id, name, address, latitude, longitude, radius_meters, is_active, district_id, unit_id, created_at',
  'district:districts!duty_locations_district_id_fkey ( id, name, code )',
  'unit:units!duty_locations_unit_id_fkey ( id, name, code )',
].join(', ');

export const ASSIGNMENT_SELECT = [
  'id, title, description, status, duty_date, start_time, end_time, reporting_instructions',
  'duty_location_id, district_id, unit_id, assigned_personnel_id, supervisor_id, created_at, updated_at',
  'location:duty_locations!duty_assignments_duty_location_id_fkey ( id, name, address, latitude, longitude, radius_meters )',
  'district:districts!duty_assignments_district_id_fkey ( id, name, code )',
  'unit:units!duty_assignments_unit_id_fkey ( id, name, code )',
  'personnel:profiles!duty_assignments_assigned_personnel_id_fkey ( id, full_name, personnel_id, rank_designation )',
  'supervisor:profiles!duty_assignments_supervisor_id_fkey ( id, full_name )',
].join(', ');

export const ATTENDANCE_SELECT = [
  'id, user_id, duty_assignment_id, location_id, event_type, latitude, longitude',
  'distance_meters, is_within_geofence, validation_status, recorded_at, device_info, remarks',
  'user:profiles!attendance_events_user_id_fkey ( id, full_name, personnel_id, rank_designation )',
  'location:duty_locations!attendance_events_location_id_fkey ( id, name, address, radius_meters )',
  'duty_assignment:duty_assignments!attendance_events_duty_assignment_id_fkey ( id, title, duty_date, status )',
].join(', ');

export const TASK_SELECT = [
  'id, title, description, status, priority, due_date, completed_at, created_at, updated_at',
  'assigned_to, assigned_by, unit_id, duty_assignment_id',
  'assignee:profiles!tasks_assigned_to_fkey ( id, full_name, personnel_id, rank_designation )',
  'creator:profiles!tasks_assigned_by_fkey ( id, full_name )',
  'unit:units!tasks_unit_id_fkey ( id, name, code )',
].join(', ');

export const TASK_HISTORY_SELECT = [
  'id, task_id, old_status, new_status, notes, created_at, changed_by',
  'changer:profiles!task_status_history_changed_by_fkey ( id, full_name )',
].join(', ');

export const EVENT_SELECT = [
  'id, title, description, event_type, venue, duty_location_id, district_id, commander_id',
  'required_personnel, start_time, end_time, status, duty_instructions, created_at, updated_at',
  'location:duty_locations!events_duty_location_id_fkey ( id, name, address )',
  'district:districts!events_district_id_fkey ( id, name, code )',
  'commander:profiles!events_commander_id_fkey ( id, full_name, personnel_id )',
].join(', ');

export const EVENT_ASSIGNMENT_SELECT = [
  'id, event_id, personnel_id, role_in_event, assigned_at',
  'personnel:profiles!event_assignments_personnel_id_fkey ( id, full_name, personnel_id, rank_designation )',
  'event:events!event_assignments_event_id_fkey ( id, title, status, start_time )',
].join(', ');

export const NOTIFICATION_SELECT =
  'id, user_id, title, message, type, is_read, link, created_at';

export const AUDIT_SELECT = [
  'id, actor_id, actor_email, actor_role, action, target_type, target_id, details, ip_address, created_at',
  'actor:profiles!audit_logs_actor_id_fkey ( id, full_name, personnel_id )',
].join(', ');
