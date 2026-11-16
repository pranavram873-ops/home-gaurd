/**
 * @param {string} search
 * @returns {string | null}
 */
export function getRecoveryTokenHash(search) {
  const params = new URLSearchParams(search);
  let confirmationParams;

  const confirmationUrl = params.get('confirmation_url');
  if (confirmationUrl) {
    try {
      confirmationParams = new URL(confirmationUrl, 'https://recovery.invalid').searchParams;
    } catch {
      // Fall back to token parameters that were lifted into the outer URL.
    }
  }

  const type = confirmationParams?.get('type') || params.get('type');
  const tokenHash =
    confirmationParams?.get('token_hash') ||
    confirmationParams?.get('token') ||
    params.get('token_hash') ||
    params.get('token');

  return tokenHash && (!type || type === 'recovery') ? tokenHash : null;
}
