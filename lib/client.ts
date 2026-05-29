/**
 * Tiny client-side fetch helper: JSON content-type + body serialization in one
 * place, so the form components don't each re-type the headers/stringify dance.
 * Callers still own how they handle the Response (toast, redirect, refresh).
 */
export function sendJson(
  path: string,
  body?: unknown,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'POST',
): Promise<Response> {
  return fetch(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
