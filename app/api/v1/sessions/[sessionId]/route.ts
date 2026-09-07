import { revokeSessionDevice } from "@/lib/server/auth/api";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  return revokeSessionDevice(request, (await params).sessionId);
}
