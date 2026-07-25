// One analytics session per browser tab (sessionStorage), shared by the
// page-view tracker (body field) and the api client (X-Session-Id header) so
// page views and API actions land under the same session id.

const SESSION_ID_KEY = 'analyticsSessionId';

export function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}
