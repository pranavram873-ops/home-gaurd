// Translates Supabase Auth errors into departmental messages that are useful
// without leaking account existence or internal state to strangers.

interface AuthLikeError {
  message?: string;
  code?: string;
  status?: number;
}

const CREDENTIALS_INVALID =
  'Email or password is incorrect. Verify your official email and try again.';

export function describeSignInError(error: AuthLikeError | undefined | null): string {
  const text = (error?.message || '').toLowerCase();
  const code = (error?.code || '').toLowerCase();

  if (code === 'email_not_confirmed' || text.includes('not confirmed') || text.includes('confirm your email')) {
    return 'Your email address is not confirmed yet. Open the verification link sent to your inbox, then sign in.';
  }
  if (code === 'invalid_credentials' || text.includes('invalid login credentials') || text.includes('invalid email or password')) {
    return CREDENTIALS_INVALID;
  }
  if (code === 'user_not_found' || text.includes('user not found') || text.includes('a user with this email does not exist')) {
    return CREDENTIALS_INVALID; // same wording: avoid confirming which emails are enrolled
  }
  if (text.includes('rate limit') || text.includes('too many requests') || error?.status === 429) {
    return 'Too many sign-in attempts. Please wait a minute before trying again.';
  }
  if (text.includes('banned') || text.includes('suspended')) {
    return 'This personnel account is suspended. Contact Command HQ.';
  }
  if (text.includes('failed to fetch') || text.includes('networkerror')) {
    return 'Cannot reach the authentication service. Check your connection and try again.';
  }
  return error?.message || CREDENTIALS_INVALID;
}

export function describeSignUpError(error: AuthLikeError | undefined | null): string {
  const text = (error?.message || '').toLowerCase();

  if (text.includes('already registered') || text.includes('already exists') || text.includes('an account with this email')) {
    return 'An enlistment with this email already exists. Use Sign In, or recover your password.';
  }
  if (text.includes('password should be') || text.includes('length')) {
    return 'Password does not meet the minimum strength requirement (at least 8 characters).';
  }
  if (text.includes('rate limit') || text.includes('too many requests') || error?.status === 429) {
    return 'Too many enrolment attempts from this device. Please wait before submitting again.';
  }
  if (text.includes('disabled') || text.includes('signups not allowed')) {
    return 'Public enrolment is currently disabled. Contact your District Command office.';
  }
  if (text.includes('failed to fetch')) {
    return 'Cannot reach the enrolment service. Check your connection and try again.';
  }
  return error?.message || 'Enlistment could not be recorded. Please review the form and try again.';
}

export function describePasswordRecoveryError(error: AuthLikeError | undefined | null): string {
  const text = (error?.message || '').toLowerCase();

  if (text.includes('rate limit') || text.includes('after 2 minutes') || text.includes('too many requests')) {
    return 'A recovery link was just dispatched. Please wait a couple of minutes before requesting again.';
  }
  if (text.includes('invalid') || text.includes('expired') || text.includes('not found')) {
    return 'This recovery link is invalid or has expired. Request a new one from the login page.';
  }
  if (text.includes('failed to fetch')) {
    return 'Cannot reach the recovery service. Check your connection and try again.';
  }
  return error?.message || 'Password could not be updated. Please try again.';
}

// Query-parameter error codes used by middleware redirects (see /login).
export const LOGIN_ROUTE_ERRORS: Record<string, string> = {
  pending_approval: 'Your enrolment is pending approval by Command Headquarters.',
  inactive_account: 'This personnel account is currently suspended or inactive.',
  missing_profile: 'Your account has no personnel profile yet. Contact Command HQ to complete enrolment.',
  auth_unavailable:
    'Sign-in is temporarily unavailable because the authentication service is not configured. Contact Command HQ.',
  signed_out: 'You have been signed out securely.',
};
