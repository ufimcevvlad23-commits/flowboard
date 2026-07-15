export function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";
  try {
    const requestHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

export function noStoreJson(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  return Response.json(data, { ...init, headers });
}

export function validPassword(password: string) {
  return password.length >= 10 && password.length <= 128 && /[A-Za-zА-Яа-я]/.test(password) && /\d/.test(password);
}

export function validLogin(login: string) {
  return /^[\p{L}\p{N}][\p{L}\p{N}._@+-]{2,79}$/u.test(login);
}
