import { listSessionDevices } from "@/lib/server/auth/api";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return listSessionDevices(request);
}
