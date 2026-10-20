import {
  Profile,
  District,
  Unit,
  DutyLocation,
  DutyAssignment,
  AttendanceEvent,
  TaskItem,
  EventItem,
  NotificationItem,
  AuditLog,
  UserRole,
  TaskStatus,
} from '@/types';
import { calculateHaversineDistance } from '@/lib/utils';

// ==============================================================================
// INITIAL SEED DATA FOR TAMIL NADU HOME GUARDS
// ==============================================================================

export const initialDistricts: District[] = [
  { id: 'dst-chn', name: 'Chennai Greater City', code: 'CHN', headquarters: 'Commissioner of Police HQ, Vepery, Chennai', created_at: '2024-01-01T00:00:00Z' },
  { id: 'dst-cbe', name: 'Coimbatore City', code: 'CBE', headquarters: 'Coimbatore City Police Office, Coimbatore', created_at: '2024-01-01T00:00:00Z' },
  { id: 'dst-mdu', name: 'Madurai City', code: 'MDU', headquarters: 'Madurai City Police Office, Alagar Kovil Rd, Madurai', created_at: '2024-01-01T00:00:00Z' },
  { id: 'dst-try', name: 'Tiruchirappalli City', code: 'TRY', headquarters: 'Trichy City Police Office, Cantonment, Trichy', created_at: '2024-01-01T00:00:00Z' },
  { id: 'dst-slm', name: 'Salem City', code: 'SLM', headquarters: 'Salem City Police Office, Linemedu, Salem', created_at: '2024-01-01T00:00:00Z' },
  { id: 'dst-tnv', name: 'Tirunelveli City', code: 'TNV', headquarters: 'Tirunelveli City Police Office, Palayamkottai', created_at: '2024-01-01T00:00:00Z' },
];

export const initialUnits: Unit[] = [
  { id: 'unt-chn-1', district_id: 'dst-chn', name: 'Zone IV - Mylapore Division', code: 'CHN-Z4-MYL', description: 'Covers Marina Beach, Santhome, and Luz Corner bandobast', commander_id: null, created_at: '2024-01-01T00:00:00Z' },
  { id: 'unt-chn-2', district_id: 'dst-chn', name: 'Zone I - Harbour & Central Division', code: 'CHN-Z1-HBR', description: 'Covers Chennai Central, High Court, and George Town traffic control', commander_id: null, created_at: '2024-01-01T00:00:00Z' },
  { id: 'unt-chn-3', district_id: 'dst-chn', name: 'Traffic Wing South - T.Nagar', code: 'CHN-TRF-STH', description: 'Festival bandobast and crowd management at Usman Road & Panagal Park', commander_id: null, created_at: '2024-01-01T00:00:00Z' },
  { id: 'unt-cbe-1', district_id: 'dst-cbe', name: 'Central Range - Gandhipuram Unit', code: 'CBE-CR-GND', description: 'Gandhipuram Bus Stand and Cross Cut Road surveillance', commander_id: null, created_at: '2024-01-01T00:00:00Z' },
  { id: 'unt-mdu-1', district_id: 'dst-mdu', name: 'Temple Security Wing - Zone A', code: 'MDU-TSW-ZA', description: 'Meenakshi Amman Temple outer perimeter and Chithirai festival routes', commander_id: null, created_at: '2024-01-01T00:00:00Z' },
];

export const initialDutyLocations: DutyLocation[] = [
  {
    id: 'loc-1',
    name: 'Marina Beach Light House & Promenade Post',
    address: 'Kamarajar Salai, Marina Beach, Mylapore, Chennai, Tamil Nadu 600004',
    latitude: 13.0398,
    longitude: 80.2785,
    radius_meters: 250,
    district_id: 'dst-chn',
    unit_id: 'unt-chn-1',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'loc-2',
    name: 'Chennai Central Station Security Zone',
    address: 'Kannappar Thidal, Periyamet, Chennai, Tamil Nadu 600003',
    latitude: 13.0827,
    longitude: 80.2757,
    radius_meters: 200,
    district_id: 'dst-chn',
    unit_id: 'unt-chn-2',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'loc-3',
    name: 'Ripon Building Headquarters Perimeter',
    address: 'Raja Muthiah Rd, Kannappar Thidal, Periyamet, Chennai 600003',
    latitude: 13.0823,
    longitude: 80.2728,
    radius_meters: 180,
    district_id: 'dst-chn',
    unit_id: 'unt-chn-2',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'loc-4',
    name: 'Meenakshi Amman Temple Chithirai Gopuram Post',
    address: 'Madurai Main, Madurai, Tamil Nadu 625001',
    latitude: 9.9195,
    longitude: 78.1193,
    radius_meters: 200,
    district_id: 'dst-mdu',
    unit_id: 'unt-mdu-1',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'loc-5',
    name: 'Gandhipuram Central Terminal Traffic Sector',
    address: 'Gandhipuram, Coimbatore, Tamil Nadu 641012',
    latitude: 11.0168,
    longitude: 76.9675,
    radius_meters: 180,
    district_id: 'dst-cbe',
    unit_id: 'unt-cbe-1',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
  },
];

export const initialProfiles: Profile[] = [
  {
    id: 'usr-admin-1',
    full_name: 'Dr. K. Vijayakumar, IPS',
    email: 'admin@tnhomeguards.gov.in',
    phone: '9840011223',
    personnel_id: 'TNHG-HQ-001',
    role: 'admin',
    district_id: 'dst-chn',
    unit_id: 'unt-chn-1',
    account_status: 'active',
    rank_designation: 'Director General of Police / State Commandant',
    emergency_contact: '9840011224',
    blood_group: 'O+',
    address: 'Police Headquarters, Mylapore, Chennai',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'usr-guard-1',
    full_name: 'HG A. Venkatesh',
    email: 'homeguard@tnhomeguards.gov.in',
    phone: '9840345678',
    personnel_id: 'TN-HG-52914',
    role: 'home_guard',
    district_id: 'dst-chn',
    unit_id: 'unt-chn-1',
    account_status: 'active',
    rank_designation: 'Home Guard Volunteer • Platoon A-2',
    emergency_contact: '9840345679',
    blood_group: 'O+',
    address: 'Mylapore, Chennai',
    created_at: '2024-02-01T00:00:00Z',
    updated_at: '2024-02-01T00:00:00Z',
  },
  {
    id: 'usr-guard-2',
    full_name: 'HG P. Selvam',
    email: 'p.selvam@tnhomeguards.gov.in',
    phone: '9840456789',
    personnel_id: 'TN-HG-61033',
    role: 'home_guard',
    district_id: 'dst-chn',
    unit_id: 'unt-chn-1',
    account_status: 'active',
    rank_designation: 'Field Volunteer • Platoon C-1',
    emergency_contact: '9840456790',
    blood_group: 'B+',
    address: 'Triplicane, Chennai',
    created_at: '2024-02-05T00:00:00Z',
    updated_at: '2024-02-05T00:00:00Z',
  },
  {
    id: 'usr-guard-3',
    full_name: 'HG Priya Soundararajan',
    email: 'priya.s@tnhomeguards.gov.in',
    phone: '9840567890',
    personnel_id: 'TN-HG-70144',
    role: 'home_guard',
    district_id: 'dst-chn',
    unit_id: 'unt-chn-1',
    account_status: 'active',
    rank_designation: 'Women Contingent Volunteer',
    emergency_contact: '9840567891',
    blood_group: 'AB+',
    address: 'Santhome, Chennai',
    created_at: '2024-02-10T00:00:00Z',
    updated_at: '2024-02-10T00:00:00Z',
  },
  {
    id: 'usr-guard-pending',
    full_name: 'R. Karthi (Applicant)',
    email: 'karthi.applicant@gmail.com',
    phone: '9840678901',
    personnel_id: 'TN-HG-APP-99',
    role: 'home_guard',
    district_id: 'dst-chn',
    unit_id: 'unt-chn-1',
    account_status: 'pending',
    rank_designation: 'Recruit Applicant',
    emergency_contact: '9840678902',
    blood_group: 'O+',
    address: 'Saidapet, Chennai',
    created_at: '2024-10-18T10:00:00Z',
    updated_at: '2024-10-18T10:00:00Z',
  },
];

export const initialDutyAssignments: DutyAssignment[] = [
  {
    id: 'asg-1',
    title: 'Marina Beach Promenade Crowd Vigilance & VIP Security',
    description: 'Ensure orderly crowd movement along the promenade, assist local law enforcement with lost children and vigilance',
    duty_location_id: 'loc-1',
    district_id: 'dst-chn',
    unit_id: 'unt-chn-1',
    assigned_personnel_id: 'usr-guard-1',
    supervisor_id: 'usr-admin-1',
    duty_date: new Date().toISOString().split('T')[0],
    start_time: '06:00',
    end_time: '18:00',
    status: 'in_progress',
    reporting_instructions: 'Report at Light House Control Booth at 05:45 AM in complete uniform with badge',
    created_at: '2024-10-19T00:00:00Z',
    updated_at: '2024-10-19T00:00:00Z',
  },
  {
    id: 'asg-2',
    title: 'Mylapore Evening Sector Traffic & Patrol Support',
    description: 'Assist Mylapore Traffic Police with junction de-congestion during rush hours',
    duty_location_id: 'loc-1',
    district_id: 'dst-chn',
    unit_id: 'unt-chn-1',
    assigned_personnel_id: 'usr-guard-2',
    supervisor_id: 'usr-admin-1',
    duty_date: new Date().toISOString().split('T')[0],
    start_time: '14:00',
    end_time: '22:00',
    status: 'scheduled',
    reporting_instructions: 'Assemble at Luz Corner Police Outpost',
    created_at: '2024-10-19T00:00:00Z',
    updated_at: '2024-10-19T00:00:00Z',
  },
  {
    id: 'asg-3',
    title: 'Chennai Central Station Weekend Passenger Security',
    description: 'Monitor high footfall terminal exits and baggage screening queue management',
    duty_location_id: 'loc-2',
    district_id: 'dst-chn',
    unit_id: 'unt-chn-2',
    assigned_personnel_id: 'usr-guard-3',
    supervisor_id: 'usr-admin-1',
    duty_date: new Date().toISOString().split('T')[0],
    start_time: '08:00',
    end_time: '16:00',
    status: 'completed',
    reporting_instructions: 'Report to RPF/Police Outpost at Main Entrance',
    created_at: '2024-10-18T00:00:00Z',
    updated_at: '2024-10-19T08:00:00Z',
  },
];

export const initialAttendanceEvents: AttendanceEvent[] = [
  {
    id: 'att-1',
    user_id: 'usr-guard-1',
    duty_assignment_id: 'asg-1',
    location_id: 'loc-1',
    event_type: 'check_in',
    latitude: 13.0399,
    longitude: 80.2786,
    distance_meters: 15,
    is_within_geofence: true,
    validation_status: 'verified',
    recorded_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    device_info: 'Chrome on Android Mobile (GPS Accuracy: 6m)',
    remarks: 'Punctual check-in at Marina Light House Post',
  },
  {
    id: 'att-2',
    user_id: 'usr-guard-3',
    duty_assignment_id: 'asg-3',
    location_id: 'loc-2',
    event_type: 'check_in',
    latitude: 13.0826,
    longitude: 80.2756,
    distance_meters: 12,
    is_within_geofence: true,
    validation_status: 'verified',
    recorded_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    device_info: 'Safari on iOS (GPS Accuracy: 4m)',
    remarks: 'Verified biometric presence',
  },
  {
    id: 'att-3',
    user_id: 'usr-guard-3',
    duty_assignment_id: 'asg-3',
    location_id: 'loc-2',
    event_type: 'check_out',
    latitude: 13.0828,
    longitude: 80.2758,
    distance_meters: 18,
    is_within_geofence: true,
    validation_status: 'verified',
    recorded_at: new Date(Date.now() - 3600000 * 1).toISOString(),
    device_info: 'Safari on iOS',
    remarks: 'Completed 8-hour shift successfully',
  },
];

export const initialTasks: TaskItem[] = [
  {
    id: 'tsk-1',
    title: 'Inspect Bandobast Wireless Transceivers & Batteries',
    description: 'Check VHF sets and ensure full charge before evening beach patrol deployment',
    status: 'in_progress',
    priority: 'high',
    assigned_to: 'usr-guard-1',
    assigned_by: 'usr-admin-1',
    unit_id: 'unt-chn-1',
    duty_assignment_id: 'asg-1',
    due_date: new Date(Date.now() + 86400000).toISOString(),
    completed_at: null,
    created_at: '2024-10-18T00:00:00Z',
    updated_at: '2024-10-19T00:00:00Z',
  },
  {
    id: 'tsk-2',
    title: 'Deploy Crowd Barricades at Kamarajar Salai Crossing',
    description: 'Coordinate with Chennai City Traffic division to erect pedestrian dividers',
    status: 'assigned',
    priority: 'urgent',
    assigned_to: 'usr-guard-1',
    assigned_by: 'usr-admin-1',
    unit_id: 'unt-chn-1',
    duty_assignment_id: 'asg-1',
    due_date: new Date(Date.now() + 172800000).toISOString(),
    completed_at: null,
    created_at: '2024-10-19T00:00:00Z',
    updated_at: '2024-10-19T00:00:00Z',
  },
  {
    id: 'tsk-3',
    title: 'Complete First Aid Equipment Audit for Patrol Kits',
    description: 'Ensure bandages, antiseptics, and emergency contact placards are updated',
    status: 'completed',
    priority: 'low',
    assigned_to: 'usr-guard-2',
    assigned_by: 'usr-admin-1',
    unit_id: 'unt-chn-1',
    duty_assignment_id: 'asg-2',
    due_date: new Date(Date.now() - 3600000 * 4).toISOString(),
    completed_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    created_at: '2024-10-18T00:00:00Z',
    updated_at: '2024-10-19T00:00:00Z',
  },
];

export const initialEvents: EventItem[] = [
  {
    id: 'evt-1',
    title: 'Kaanum Pongal Beach Vigilance & Crowd Management',
    description: 'Massive public presence expected along Marina & Besant Nagar beach fronts. Full platoon mobilization for crowd regulation.',
    event_type: 'crowd_control',
    venue: 'Marina Beach Promenade (Kamarajar Salai to Santhome)',
    duty_location_id: 'loc-1',
    district_id: 'dst-chn',
    commander_id: 'usr-commander-1',
    required_personnel: 80,
    start_time: '2024-10-25T05:00:00Z',
    end_time: '2024-10-25T23:00:00Z',
    status: 'planned',
    duty_instructions: 'Special vigilance on shoreline safety, lost child assistance booth, and traffic clearance on Kamarajar Salai.',
    created_at: '2024-10-15T00:00:00Z',
    updated_at: '2024-10-15T00:00:00Z',
  },
  {
    id: 'evt-2',
    title: 'Chief Minister Convoy Route Bandobast & Traffic Clearance',
    description: 'High-security convoy movement from Secretariat through Anna Salai towards Guindy Raj Bhavan.',
    event_type: 'bandobast',
    venue: 'Secretariat to Anna Flyover corridor',
    duty_location_id: 'loc-3',
    district_id: 'dst-chn',
    commander_id: 'usr-admin-1',
    required_personnel: 45,
    start_time: '2024-10-28T08:00:00Z',
    end_time: '2024-10-28T14:00:00Z',
    status: 'planned',
    duty_instructions: 'Strict barricade standing orders, no civilian stopping on transit lane.',
    created_at: '2024-10-17T00:00:00Z',
    updated_at: '2024-10-17T00:00:00Z',
  },
  {
    id: 'evt-3',
    title: 'Meenakshi Amman Temple Chithirai Festival Pre-Drill',
    description: 'Simulation drill for celestial procession route and safety cordons.',
    event_type: 'training',
    venue: 'North Masi Street, Madurai',
    duty_location_id: 'loc-4',
    district_id: 'dst-mdu',
    commander_id: null,
    required_personnel: 60,
    start_time: '2024-11-02T06:00:00Z',
    end_time: '2024-11-02T13:00:00Z',
    status: 'planned',
    duty_instructions: 'Carry reflective vest, whistle, and emergency communicator.',
    created_at: '2024-10-18T00:00:00Z',
    updated_at: '2024-10-18T00:00:00Z',
  },
];

export const initialNotifications: NotificationItem[] = [
  {
    id: 'notif-1',
    user_id: 'usr-guard-1',
    title: 'Duty Assignment Confirmed',
    message: 'You have been assigned to Marina Beach Promenade Post for today (06:00 - 18:00). Please ensure on-time biometric check-in.',
    type: 'assignment',
    is_read: false,
    link: '/homeguard/dashboard',
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: 'notif-2',
    user_id: 'usr-guard-1',
    title: 'New Operational Task',
    message: 'State Commandant has assigned you: Inspect Bandobast Wireless Transceivers.',
    type: 'task',
    is_read: false,
    link: '/homeguard/tasks',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'notif-3',
    user_id: 'usr-admin-1',
    title: 'Registration Pending Approval',
    message: 'New volunteer applicant R. Karthi registered under Zone IV Mylapore Division.',
    type: 'approval',
    is_read: false,
    link: '/admin/approvals',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'notif-4',
    user_id: 'usr-admin-1',
    title: 'Geofence Validation Active',
    message: 'All 5 metropolitan command sectors have verified geofencing enabled with high GPS resolution.',
    type: 'alert',
    is_read: true,
    link: '/admin/locations',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

export const initialAuditLogs: AuditLog[] = [
  {
    id: 'log-1',
    actor_id: 'usr-admin-1',
    actor_email: 'admin@tnhomeguards.gov.in',
    actor_role: 'admin',
    action: 'SYSTEM_BOOTSTRAP',
    target_type: 'app_settings',
    target_id: 'system_branding',
    details: { message: 'Initialized Tamil Nadu Home Guards Supervision System' },
    ip_address: '10.20.1.1',
    created_at: '2024-10-18T08:00:00Z',
  },
  {
    id: 'log-2',
    actor_id: 'usr-commander-1',
    actor_email: 'commander@tnhomeguards.gov.in',
    actor_role: 'commander',
    action: 'CREATE_DUTY_ASSIGNMENT',
    target_type: 'duty_assignment',
    target_id: 'asg-1',
    details: { title: 'Marina Beach Promenade Crowd Vigilance' },
    ip_address: '10.20.1.45',
    created_at: '2024-10-19T05:30:00Z',
  },
  {
    id: 'log-3',
    actor_id: 'usr-guard-1',
    actor_email: 'homeguard@tnhomeguards.gov.in',
    actor_role: 'home_guard',
    action: 'GEOFENCE_CHECKIN_VERIFIED',
    target_type: 'attendance_event',
    target_id: 'att-1',
    details: { location: 'Marina Beach Light House', distance_meters: 15, within_geofence: true },
    ip_address: '157.48.20.11',
    created_at: '2024-10-19T06:02:00Z',
  },
];

// In-Memory store to allow instantaneous mutations during local testing & demo
class DataStore {
  districts: District[] = [...initialDistricts];
  units: Unit[] = [...initialUnits];
  locations: DutyLocation[] = [...initialDutyLocations];
  profiles: Profile[] = [...initialProfiles];
  assignments: DutyAssignment[] = [...initialDutyAssignments];
  attendance: AttendanceEvent[] = [...initialAttendanceEvents];
  tasks: TaskItem[] = [...initialTasks];
  events: EventItem[] = [...initialEvents];
  notifications: NotificationItem[] = [...initialNotifications];
  auditLogs: AuditLog[] = [...initialAuditLogs];

  // Helper to populate relations
  private populateProfile(p: Profile): Profile {
    const district = this.districts.find((d) => d.id === p.district_id) || null;
    const unit = this.units.find((u) => u.id === p.unit_id) || null;
    return { ...p, district, unit };
  }

  private populateAssignment(a: DutyAssignment): DutyAssignment {
    const location = this.locations.find((l) => l.id === a.duty_location_id) || null;
    const rawPersonnel = this.profiles.find((p) => p.id === a.assigned_personnel_id) || null;
    const personnel = rawPersonnel ? this.populateProfile(rawPersonnel) : null;
    const rawSupervisor = this.profiles.find((p) => p.id === a.supervisor_id) || null;
    const supervisor = rawSupervisor ? this.populateProfile(rawSupervisor) : null;
    return { ...a, location, personnel, supervisor };
  }

  // Districts & Units
  getDistricts(): District[] {
    return this.districts;
  }

  getUnits(districtId?: string): Unit[] {
    let list = this.units;
    if (districtId) {
      list = list.filter((u) => u.district_id === districtId);
    }
    return list.map((u) => ({
      ...u,
      district: this.districts.find((d) => d.id === u.district_id) || null,
      commander: this.profiles.find((p) => p.id === u.commander_id) || null,
    }));
  }

  // Duty Locations
  getDutyLocations(districtId?: string): DutyLocation[] {
    let list = this.locations;
    if (districtId) {
      list = list.filter((l) => l.district_id === districtId);
    }
    return list.map((l) => ({
      ...l,
      district: this.districts.find((d) => d.id === l.district_id) || null,
      unit: this.units.find((u) => u.id === l.unit_id) || null,
    }));
  }

  createDutyLocation(data: Omit<DutyLocation, 'id' | 'created_at'>): DutyLocation {
    const newLoc: DutyLocation = {
      ...data,
      id: `loc-${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    this.locations.unshift(newLoc);
    this.recordAuditLog({
      action: 'CREATE_DUTY_LOCATION',
      target_type: 'duty_location',
      target_id: newLoc.id,
      details: { name: newLoc.name, radius: newLoc.radius_meters },
    });
    return newLoc;
  }

  // Personnel Profiles
  getPersonnel(filters?: {
    districtId?: string;
    unitId?: string;
    role?: string;
    status?: string;
    search?: string;
  }): Profile[] {
    let list = this.profiles;
    if (filters?.districtId) {
      list = list.filter((p) => p.district_id === filters.districtId);
    }
    if (filters?.unitId) {
      list = list.filter((p) => p.unit_id === filters.unitId);
    }
    if (filters?.role && filters.role !== 'all') {
      list = list.filter((p) => p.role === filters.role);
    }
    if (filters?.status && filters.status !== 'all') {
      list = list.filter((p) => p.account_status === filters.status);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (p) =>
          p.full_name.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          (p.personnel_id && p.personnel_id.toLowerCase().includes(q)) ||
          (p.phone && p.phone.includes(q))
      );
    }
    return list.map((p) => this.populateProfile(p));
  }

  getPersonnelById(id: string): Profile | null {
    const found = this.profiles.find((p) => p.id === id);
    return found ? this.populateProfile(found) : null;
  }

  createPersonnel(data: Partial<Profile>): Profile {
    const newProfile: Profile = {
      id: data.id || `usr-${Date.now()}`,
      full_name: data.full_name || 'Home Guard Volunteer',
      email: data.email || `hg.${Date.now()}@tnhomeguards.gov.in`,
      phone: data.phone || '9840000000',
      personnel_id: data.personnel_id || `TN-HG-${Math.floor(10000 + Math.random() * 90000)}`,
      role: data.role || 'home_guard',
      district_id: data.district_id || 'dst-chn',
      unit_id: data.unit_id || 'unt-chn-1',
      account_status: data.account_status || 'active',
      rank_designation: data.rank_designation || 'Home Guard Volunteer',
      avatar_url: data.avatar_url || null,
      emergency_contact: data.emergency_contact || null,
      blood_group: data.blood_group || 'O+',
      address: data.address || 'Chennai, Tamil Nadu',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.profiles.unshift(newProfile);
    this.recordAuditLog({
      action: 'CREATE_PERSONNEL',
      target_type: 'profile',
      target_id: newProfile.id,
      details: { name: newProfile.full_name, role: newProfile.role, badge: newProfile.personnel_id },
    });
    return this.populateProfile(newProfile);
  }

  updatePersonnel(id: string, updates: Partial<Profile>, actorRole?: string): Profile | null {
    const index = this.profiles.findIndex((p) => p.id === id);
    if (index === -1) return null;

    // Security check: non-admin cannot alter role or account_status
    if (actorRole && actorRole !== 'admin') {
      delete updates.role;
      delete updates.account_status;
    }

    this.profiles[index] = {
      ...this.profiles[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.recordAuditLog({
      action: 'UPDATE_PERSONNEL',
      target_type: 'profile',
      target_id: id,
      details: updates,
    });

    return this.populateProfile(this.profiles[index]);
  }

  approveRegistration(id: string, assignedRole: UserRole = 'home_guard', unitId?: string): Profile | null {
    const profile = this.getPersonnelById(id);
    if (!profile) return null;

    const updated = this.updatePersonnel(id, {
      account_status: 'active',
      role: assignedRole,
      unit_id: unitId || profile.unit_id || 'unt-chn-1',
      personnel_id: profile.personnel_id?.includes('APP')
        ? `TN-HG-${Math.floor(20000 + Math.random() * 80000)}`
        : profile.personnel_id,
    });

    // Generate in-app notification
    this.notifications.unshift({
      id: `notif-${Date.now()}`,
      user_id: id,
      title: 'Registration Approved',
      message: 'Your Tamil Nadu Home Guard enrolment has been verified and approved by the Area Command. You may now access your duty roster.',
      type: 'approval',
      is_read: false,
      link: '/homeguard/dashboard',
      created_at: new Date().toISOString(),
    });

    this.recordAuditLog({
      action: 'APPROVE_REGISTRATION',
      target_type: 'profile',
      target_id: id,
      details: { name: profile.full_name, role: assignedRole },
    });

    return updated;
  }

  rejectRegistration(id: string, reason?: string): boolean {
    const profile = this.getPersonnelById(id);
    if (!profile) return false;

    this.updatePersonnel(id, { account_status: 'rejected' });

    this.recordAuditLog({
      action: 'REJECT_REGISTRATION',
      target_type: 'profile',
      target_id: id,
      details: { name: profile.full_name, reason: reason || 'Documentation discrepancy' },
    });

    return true;
  }

  // Duty Assignments
  getDutyAssignments(filters?: {
    personnelId?: string;
    supervisorId?: string;
    date?: string;
    unitId?: string;
  }): DutyAssignment[] {
    let list = this.assignments;
    if (filters?.personnelId) {
      list = list.filter((a) => a.assigned_personnel_id === filters.personnelId);
    }
    if (filters?.supervisorId) {
      list = list.filter((a) => a.supervisor_id === filters.supervisorId);
    }
    if (filters?.date) {
      list = list.filter((a) => a.duty_date === filters.date);
    }
    if (filters?.unitId) {
      list = list.filter((a) => a.unit_id === filters.unitId);
    }
    return list.map((a) => this.populateAssignment(a));
  }

  createDutyAssignment(data: Partial<DutyAssignment>): DutyAssignment {
    const newAssignment: DutyAssignment = {
      id: `asg-${Date.now()}`,
      title: data.title || 'General Bandobast Duty',
      description: data.description || '',
      duty_location_id: data.duty_location_id || 'loc-1',
      district_id: data.district_id || 'dst-chn',
      unit_id: data.unit_id || 'unt-chn-1',
      assigned_personnel_id: data.assigned_personnel_id || 'usr-guard-1',
      supervisor_id: data.supervisor_id || 'usr-commander-1',
      duty_date: data.duty_date || new Date().toISOString().split('T')[0],
      start_time: data.start_time || '08:00',
      end_time: data.end_time || '16:00',
      status: 'scheduled',
      reporting_instructions: data.reporting_instructions || 'Assemble in prescribed muster uniform',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.assignments.unshift(newAssignment);

    // Notify personnel
    this.notifications.unshift({
      id: `notif-${Date.now()}`,
      user_id: newAssignment.assigned_personnel_id,
      title: 'New Duty Assignment',
      message: `You have been deployed for "${newAssignment.title}" on ${newAssignment.duty_date} (${newAssignment.start_time} - ${newAssignment.end_time}).`,
      type: 'assignment',
      is_read: false,
      link: '/homeguard/dashboard',
      created_at: new Date().toISOString(),
    });

    this.recordAuditLog({
      action: 'CREATE_DUTY_ASSIGNMENT',
      target_type: 'duty_assignment',
      target_id: newAssignment.id,
      details: { title: newAssignment.title, guard: newAssignment.assigned_personnel_id },
    });

    return this.populateAssignment(newAssignment);
  }

  updateDutyAssignment(id: string, updates: Partial<DutyAssignment>): DutyAssignment | null {
    const index = this.assignments.findIndex((a) => a.id === id);
    if (index === -1) return null;

    this.assignments[index] = {
      ...this.assignments[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    return this.populateAssignment(this.assignments[index]);
  }

  // Attendance & Geofencing
  getAttendanceEvents(filters?: { userId?: string; date?: string }): AttendanceEvent[] {
    let list = this.attendance;
    if (filters?.userId) {
      list = list.filter((a) => a.user_id === filters.userId);
    }
    return list.map((a) => ({
      ...a,
      user: this.getPersonnelById(a.user_id),
      location: this.locations.find((l) => l.id === a.location_id) || null,
      duty_assignment: this.assignments.find((asg) => asg.id === a.duty_assignment_id) || null,
    }));
  }

  recordAttendance(params: {
    userId: string;
    dutyAssignmentId?: string | null;
    locationId: string;
    latitude: number;
    longitude: number;
    eventType: 'check_in' | 'check_out';
    deviceInfo?: string;
    remarks?: string;
  }): { success: boolean; message: string; event?: AttendanceEvent; distanceMeters: number; isWithinGeofence: boolean } {
    const location = this.locations.find((l) => l.id === params.locationId);
    if (!location) {
      return { success: false, message: 'Invalid or inactive duty location.', distanceMeters: 0, isWithinGeofence: false };
    }

    // Precise server-side Haversine distance calculation
    const distanceMeters = calculateHaversineDistance(
      params.latitude,
      params.longitude,
      location.latitude,
      location.longitude
    );

    const isWithinGeofence = distanceMeters <= location.radius_meters;

    // Check for duplicate consecutive check-in
    const lastEvent = this.attendance
      .filter((a) => a.user_id === params.userId)
      .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];

    if (lastEvent && lastEvent.event_type === params.eventType) {
      const timeDiffMinutes = (Date.now() - new Date(lastEvent.recorded_at).getTime()) / 60000;
      if (timeDiffMinutes < 15) {
        return {
          success: false,
          message: `Duplicate ${params.eventType === 'check_in' ? 'Check-in' : 'Check-out'} detected within 15 minutes.`,
          distanceMeters,
          isWithinGeofence,
        };
      }
    }

    const validationStatus = isWithinGeofence ? 'verified' : 'flagged_distance';

    const newEvent: AttendanceEvent = {
      id: `att-${Date.now()}`,
      user_id: params.userId,
      duty_assignment_id: params.dutyAssignmentId || null,
      location_id: params.locationId,
      event_type: params.eventType,
      latitude: params.latitude,
      longitude: params.longitude,
      distance_meters: distanceMeters,
      is_within_geofence: isWithinGeofence,
      validation_status: validationStatus,
      recorded_at: new Date().toISOString(),
      device_info: params.deviceInfo || 'Authorized Mobile Browser GPS',
      remarks: params.remarks || (isWithinGeofence ? 'Verified on-site check' : `Outside geofence perimeter by ${distanceMeters - location.radius_meters}m`),
    };

    this.attendance.unshift(newEvent);

    // Update assignment status if check_in
    if (params.dutyAssignmentId) {
      if (params.eventType === 'check_in' && isWithinGeofence) {
        this.updateDutyAssignment(params.dutyAssignmentId, { status: 'in_progress' });
      } else if (params.eventType === 'check_out') {
        this.updateDutyAssignment(params.dutyAssignmentId, { status: 'completed' });
      }
    }

    this.recordAuditLog({
      actor_id: params.userId,
      action: isWithinGeofence ? `GEOFENCE_${params.eventType.toUpperCase()}_VERIFIED` : `GEOFENCE_${params.eventType.toUpperCase()}_OUTSIDE_PERIMETER`,
      target_type: 'attendance_event',
      target_id: newEvent.id,
      details: { location: location.name, distanceMeters, allowedRadius: location.radius_meters },
    });

    return {
      success: isWithinGeofence,
      message: isWithinGeofence
        ? `${params.eventType === 'check_in' ? 'Check-in' : 'Check-out'} verified! You are inside the perimeter (${distanceMeters}m from post center).`
        : `Check-in recorded with distance alert: You are ${distanceMeters}m away from the post perimeter (allowed radius: ${location.radius_meters}m).`,
      event: newEvent,
      distanceMeters,
      isWithinGeofence,
    };
  }

  // Tasks & Supervision
  getTasks(filters?: { assignedTo?: string; unitId?: string; status?: string }): TaskItem[] {
    let list = this.tasks;
    if (filters?.assignedTo) {
      list = list.filter((t) => t.assigned_to === filters.assignedTo);
    }
    if (filters?.unitId) {
      list = list.filter((t) => t.unit_id === filters.unitId);
    }
    if (filters?.status && filters.status !== 'all') {
      list = list.filter((t) => t.status === filters.status);
    }
    return list.map((t) => ({
      ...t,
      assignee: this.getPersonnelById(t.assigned_to || ''),
      creator: this.getPersonnelById(t.assigned_by || ''),
      unit: this.units.find((u) => u.id === t.unit_id) || null,
    }));
  }

  createTask(data: Partial<TaskItem>): TaskItem {
    const newTask: TaskItem = {
      id: `tsk-${Date.now()}`,
      title: data.title || 'Supervision Task',
      description: data.description || '',
      status: data.status || 'new',
      priority: data.priority || 'medium',
      assigned_to: data.assigned_to || null,
      assigned_by: data.assigned_by || 'usr-commander-1',
      unit_id: data.unit_id || 'unt-chn-1',
      duty_assignment_id: data.duty_assignment_id || null,
      due_date: data.due_date || new Date(Date.now() + 86400000).toISOString(),
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.tasks.unshift(newTask);

    if (newTask.assigned_to) {
      this.notifications.unshift({
        id: `notif-${Date.now()}`,
        user_id: newTask.assigned_to,
        title: 'New Task Assigned',
        message: `Task "${newTask.title}" has been assigned to you with ${newTask.priority} priority.`,
        type: 'task',
        is_read: false,
        link: '/homeguard/tasks',
        created_at: new Date().toISOString(),
      });
    }

    this.recordAuditLog({
      action: 'CREATE_TASK',
      target_type: 'task',
      target_id: newTask.id,
      details: { title: newTask.title, priority: newTask.priority },
    });

    return newTask;
  }

  updateTaskStatus(taskId: string, newStatus: TaskStatus, actorId?: string): TaskItem | null {
    const index = this.tasks.findIndex((t) => t.id === taskId);
    if (index === -1) return null;

    const completedAt = newStatus === 'completed' ? new Date().toISOString() : null;

    this.tasks[index] = {
      ...this.tasks[index],
      status: newStatus,
      completed_at: completedAt,
      updated_at: new Date().toISOString(),
    };

    this.recordAuditLog({
      actor_id: actorId,
      action: 'UPDATE_TASK_STATUS',
      target_type: 'task',
      target_id: taskId,
      details: { newStatus },
    });

    return this.tasks[index];
  }

  // Events (Event Planner)
  getEvents(filters?: { districtId?: string; status?: string }): EventItem[] {
    let list = this.events;
    if (filters?.districtId) {
      list = list.filter((e) => e.district_id === filters.districtId);
    }
    if (filters?.status && filters.status !== 'all') {
      list = list.filter((e) => e.status === filters.status);
    }
    return list.map((e) => ({
      ...e,
      commander: this.getPersonnelById(e.commander_id || ''),
      location: this.locations.find((l) => l.id === e.duty_location_id) || null,
      assigned_count: this.assignments.filter((a) => a.title.includes(e.title)).length,
    }));
  }

  createEvent(data: Partial<EventItem>): EventItem {
    const newEvent: EventItem = {
      id: `evt-${Date.now()}`,
      title: data.title || 'Security Bandobast Event',
      description: data.description || '',
      event_type: data.event_type || 'bandobast',
      venue: data.venue || 'Chennai City Area',
      duty_location_id: data.duty_location_id || 'loc-1',
      district_id: data.district_id || 'dst-chn',
      commander_id: data.commander_id || 'usr-commander-1',
      required_personnel: data.required_personnel || 20,
      start_time: data.start_time || new Date().toISOString(),
      end_time: data.end_time || new Date(Date.now() + 86400000).toISOString(),
      status: 'planned',
      duty_instructions: data.duty_instructions || 'Standard uniform, reporting 30 mins prior',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.events.unshift(newEvent);

    this.recordAuditLog({
      action: 'CREATE_EVENT',
      target_type: 'event',
      target_id: newEvent.id,
      details: { title: newEvent.title, venue: newEvent.venue, required: newEvent.required_personnel },
    });

    return newEvent;
  }

  // Notifications
  getNotifications(userId: string): NotificationItem[] {
    return this.notifications.filter((n) => n.user_id === userId);
  }

  markNotificationRead(id: string): void {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) notif.is_read = true;
  }

  // Audit Logs
  getAuditLogs(limit: number = 50): AuditLog[] {
    return this.auditLogs.slice(0, limit);
  }

  recordAuditLog(log: Partial<AuditLog>): void {
    this.auditLogs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      actor_id: log.actor_id || null,
      actor_email: log.actor_email || null,
      actor_role: log.actor_role || null,
      action: log.action || 'GENERAL_ACTION',
      target_type: log.target_type || null,
      target_id: log.target_id || null,
      details: log.details || {},
      ip_address: log.ip_address || '127.0.0.1',
      created_at: new Date().toISOString(),
    });
  }

  // Typed Admin Statistics
  getAdminStats() {
    const totalGuards = this.profiles.filter((p) => p.role === 'home_guard').length;
    const activeGuards = this.profiles.filter((p) => p.role === 'home_guard' && p.account_status === 'active').length;
    const pendingGuards = this.profiles.filter((p) => p.account_status === 'pending').length;

    const onDutyAssignments = this.assignments.filter((a) => a.status === 'in_progress');
    const scheduledAssignments = this.assignments.filter((a) => a.status === 'scheduled');
    const completedAssignments = this.assignments.filter((a) => a.status === 'completed');

    const totalTasks = this.tasks.length;
    const pendingTasks = this.tasks.filter((t) => t.status === 'new' || t.status === 'assigned' || t.status === 'in_progress').length;
    const completedTasks = this.tasks.filter((t) => t.status === 'completed').length;

    const upcomingEvents = this.events.filter((e) => e.status === 'planned' || e.status === 'active').length;

    return {
      totalRegisteredGuards: totalGuards,
      activeGuards,
      pendingApprovals: pendingGuards,
      onDutyCount: onDutyAssignments.length,
      scheduledCount: scheduledAssignments.length,
      completedAssignmentsCount: completedAssignments.length,
      pendingTasks,
      completedTasks,
      totalTasks,
      upcomingEvents,
      activeDutyLocations: this.locations.filter((l) => l.is_active).length,
      recentAttendance: this.attendance.slice(0, 6).map((a) => ({
        ...a,
        user: this.getPersonnelById(a.user_id),
        location: this.locations.find((l) => l.id === a.location_id) || null,
      })),
      recentAuditLogs: this.auditLogs.slice(0, 6),
    };
  }

  // Aggregated Operational Statistics
  getDashboardStats(role: UserRole, userId?: string, unitId?: string) {
    const totalGuards = this.profiles.filter((p) => p.role === 'home_guard').length;
    const activeGuards = this.profiles.filter((p) => p.role === 'home_guard' && p.account_status === 'active').length;
    const pendingGuards = this.profiles.filter((p) => p.account_status === 'pending').length;

    const onDutyAssignments = this.assignments.filter((a) => a.status === 'in_progress');
    const scheduledAssignments = this.assignments.filter((a) => a.status === 'scheduled');
    const completedAssignments = this.assignments.filter((a) => a.status === 'completed');

    const totalTasks = this.tasks.length;
    const pendingTasks = this.tasks.filter((t) => t.status === 'new' || t.status === 'assigned' || t.status === 'in_progress').length;
    const completedTasks = this.tasks.filter((t) => t.status === 'completed').length;

    const upcomingEvents = this.events.filter((e) => e.status === 'planned' || e.status === 'active').length;

    // Filtered scoped stats for Home Guard or Commander
    if (role === 'home_guard' && userId) {
      const myDuties = this.assignments.filter((a) => a.assigned_personnel_id === userId);
      const myActiveDuty = myDuties.find((a) => a.status === 'in_progress' || a.status === 'scheduled');
      const myAttendance = this.attendance.filter((a) => a.user_id === userId);
      const myTasks = this.tasks.filter((t) => t.assigned_to === userId);

      return {
        myDutiesCount: myDuties.length,
        myActiveDuty: myActiveDuty ? this.populateAssignment(myActiveDuty) : null,
        myAttendanceCount: myAttendance.length,
        myPendingTasksCount: myTasks.filter((t) => t.status !== 'completed').length,
        myCompletedTasksCount: myTasks.filter((t) => t.status === 'completed').length,
        recentAttendance: myAttendance.slice(0, 5),
        myTasks,
      };
    }

    if (role === 'commander' && unitId) {
      const unitPersonnel = this.profiles.filter((p) => p.unit_id === unitId);
      const unitAssignments = this.assignments.filter((a) => a.unit_id === unitId);
      const unitOnDuty = unitAssignments.filter((a) => a.status === 'in_progress').length;
      const unitTasks = this.tasks.filter((t) => t.unit_id === unitId);

      return {
        unitPersonnelCount: unitPersonnel.length,
        unitOnDuty,
        unitScheduled: unitAssignments.filter((a) => a.status === 'scheduled').length,
        unitPendingTasks: unitTasks.filter((t) => t.status !== 'completed').length,
        totalLocations: this.locations.filter((l) => l.unit_id === unitId || !l.unit_id).length,
        recentActivity: this.auditLogs.slice(0, 6),
      };
    }

    return {
      totalRegisteredGuards: totalGuards,
      activeGuards,
      pendingApprovals: pendingGuards,
      onDutyCount: onDutyAssignments.length,
      scheduledCount: scheduledAssignments.length,
      completedAssignmentsCount: completedAssignments.length,
      pendingTasks,
      completedTasks,
      totalTasks,
      upcomingEvents,
      activeDutyLocations: this.locations.filter((l) => l.is_active).length,
      recentAttendance: this.attendance.slice(0, 6).map((a) => ({
        ...a,
        user: this.getPersonnelById(a.user_id),
        location: this.locations.find((l) => l.id === a.location_id) || null,
      })),
      recentAuditLogs: this.auditLogs.slice(0, 6),
    };
  }
}

// Global Singleton data service instance
export const dataService = new DataStore();
