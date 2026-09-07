import { getVaultHttpApi } from "@/lib/server/vault/api";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return getVaultHttpApi().list(request);
}

export function POST(request: Request) {
  return getVaultHttpApi().create(request);
}
