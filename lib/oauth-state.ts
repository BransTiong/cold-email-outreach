/**
 * CSRF state nonces for the Google OAuth round-trip, held in-memory (shared
 * between the start + callback route handlers within the single dev process).
 * For multi-instance deployment, move to Redis/DB.
 */
export const pendingStates = new Set<string>();

export function issueState(state: string): void {
  pendingStates.add(state);
  setTimeout(() => pendingStates.delete(state), 10 * 60 * 1000).unref();
}
