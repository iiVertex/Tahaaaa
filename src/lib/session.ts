export function getOrCreateSessionId(): string {
  const key = 'qic-session-id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = cryptoRandomId();
    localStorage.setItem(key, id);
  }
  return id;
}

function cryptoRandomId(): string {
  // Create a URL-safe 32 char id
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}


