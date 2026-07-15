import { destroyCurrentSession } from "@/lib/auth";
import { hasSameOrigin, noStoreJson } from "@/lib/http-security";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return noStoreJson({ error: "Недопустимый источник запроса" }, { status: 403 });
  await destroyCurrentSession();
  return noStoreJson({ ok: true });
}
