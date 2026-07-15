import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import { noStoreJson } from "@/lib/http-security";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    (await cookies()).delete("flowboard_session");
    return noStoreJson({ error: "Сессия недействительна" }, { status: 401 });
  }
  return noStoreJson({ user });
}
