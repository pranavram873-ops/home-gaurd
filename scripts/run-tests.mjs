/**
 * TAMIL NADU HOME GUARDS SUPERVISION SYSTEM
 * Automated Rule & Security Verification Test Runner
 */

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`\x1b[32m  ✓ PASS:\x1b[0m ${message}`);
    passed++;
  } else {
    console.error(`\x1b[31m  ✗ FAIL:\x1b[0m ${message}`);
    failed++;
  }
}

console.log('\n\x1b[34m================================================================');
console.log(' TAMIL NADU HOME GUARDS SUPERVISION SYSTEM — SECURITY & RULE TESTS');
console.log('================================================================\x1b[0m\n');

// -----------------------------------------------------------------------------
// Test 1: Haversine Geofence Accuracy
// -----------------------------------------------------------------------------
console.log('\x1b[36m[TEST SUITE 1] Geofence Perimeter & Haversine Distance Calculation\x1b[0m');

// Marina Beach Light House: 13.0398, 80.2785
const marinaLat = 13.0398;
const marinaLng = 80.2785;

// Exact same location => 0 meters
const dZero = calculateHaversineDistance(marinaLat, marinaLng, marinaLat, marinaLng);
assert(dZero === 0, 'Distance to identical coordinate is 0 meters');

// ~110 meters away (approx 0.001 degree lat offset)
const dNear = calculateHaversineDistance(marinaLat, marinaLng, marinaLat + 0.001, marinaLng);
assert(dNear >= 100 && dNear <= 125, `Near coordinate offset (~111m) accurately computed as ${dNear}m`);

// Radius compliance: within 250m perimeter passes
const withinPerimeter = dNear <= 250;
assert(withinPerimeter === true, 'Coordinates within configured 250m radius pass perimeter validation');

// Remote coordinate (> 5km away, e.g. Tambaram or T.Nagar)
const dRemote = calculateHaversineDistance(marinaLat, marinaLng, 13.0067, 80.2206);
assert(dRemote > 5000, `Remote location detected: ${dRemote}m away (> 5000m)`);
assert(dRemote > 250, 'Remote coordinate fails 250m geofence validation and triggers distance flag');

// -----------------------------------------------------------------------------
// Test 2: Privilege Escalation Protection Rule
// -----------------------------------------------------------------------------
console.log('\n\x1b[36m[TEST SUITE 2] Role & Privilege Escalation Guard\x1b[0m');

function sanitizeProfileUpdate(actorRole, originalProfile, updates) {
  const result = { ...originalProfile, ...updates };
  if (actorRole !== 'admin') {
    // Non-admin cannot alter role or account_status
    result.role = originalProfile.role;
    result.account_status = originalProfile.account_status;
  }
  return result;
}

const guardProfile = { id: 'usr-1', full_name: 'Volunteer Guard', role: 'home_guard', account_status: 'active' };
const maliciousEscalation = { role: 'admin', account_status: 'active' };
const sanitized = sanitizeProfileUpdate('home_guard', guardProfile, maliciousEscalation);

assert(sanitized.role === 'home_guard', 'Home Guard attempting to update role to "admin" is rejected; role remains "home_guard"');

// -----------------------------------------------------------------------------
// Test 3: Account Status Boundary Checks (Pending & Suspended)
// -----------------------------------------------------------------------------
console.log('\n\x1b[36m[TEST SUITE 3] Account Status Verification\x1b[0m');

function canAccessOperationalFeatures(status) {
  return status === 'active';
}

assert(canAccessOperationalFeatures('active') === true, 'Active accounts can access operational dashboards');
assert(canAccessOperationalFeatures('pending') === false, 'Pending recruit accounts are blocked from operational features');
assert(canAccessOperationalFeatures('suspended') === false, 'Suspended personnel accounts are blocked from operational features');
assert(canAccessOperationalFeatures('rejected') === false, 'Rejected applicant accounts are blocked from operational features');

// -----------------------------------------------------------------------------
// Test 4: Role-Based Dashboard Redirection
// -----------------------------------------------------------------------------
console.log('\n\x1b[36m[TEST SUITE 4] Role-Based Redirection Target Validation\x1b[0m');

function getDashboardRouteForRole(role) {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'commander') return '/commander/dashboard';
  if (role === 'home_guard') return '/homeguard/dashboard';
  return '/login';
}

assert(getDashboardRouteForRole('admin') === '/admin/dashboard', 'Admin role redirects to /admin/dashboard');
assert(getDashboardRouteForRole('commander') === '/commander/dashboard', 'Commander role redirects to /commander/dashboard');
assert(getDashboardRouteForRole('home_guard') === '/homeguard/dashboard', 'Home Guard role redirects to /homeguard/dashboard');

// -----------------------------------------------------------------------------
// Test 5: Duplicate Check-In Guard (15-min debounce)
// -----------------------------------------------------------------------------
console.log('\n\x1b[36m[TEST SUITE 5] Consecutive Attendance Transition Validation\x1b[0m');

function validateAttendanceTransition(lastEvent, newEventType, newTimestamp) {
  if (!lastEvent) return { valid: true };
  if (lastEvent.event_type === newEventType) {
    const diffMinutes = (new Date(newTimestamp).getTime() - new Date(lastEvent.recorded_at).getTime()) / 60000;
    if (diffMinutes < 15) {
      return { valid: false, error: 'Duplicate attendance transition within 15 minutes' };
    }
  }
  return { valid: true };
}

const t0 = new Date().toISOString();
const tDuplicate = new Date(Date.now() + 180000).toISOString(); // 3 minutes later
const checkDuplicate = validateAttendanceTransition({ event_type: 'check_in', recorded_at: t0 }, 'check_in', tDuplicate);
assert(checkDuplicate.valid === false, 'Duplicate check-in within 3 minutes is rejected');

const tValid = new Date(Date.now() + 3600000 * 4).toISOString(); // 4 hours later
const checkValid = validateAttendanceTransition({ event_type: 'check_in', recorded_at: t0 }, 'check_out', tValid);
assert(checkValid.valid === true, 'Check-out after 4 hours transition is accepted');

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n\x1b[34m================================================================\x1b[0m');
console.log(`TOTAL TESTS: ${passed + failed} | \x1b[32mPASSED: ${passed}\x1b[0m | \x1b[31mFAILED: ${failed}\x1b[0m`);
console.log('\x1b[34m================================================================\x1b[0m\n');

if (failed > 0) process.exit(1);
