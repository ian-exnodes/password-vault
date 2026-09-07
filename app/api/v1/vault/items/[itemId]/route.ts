import { getVaultHttpApi } from "@/lib/server/vault/api";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ itemId: string }> };

export async function GET(request: Request, { params }: Context) {
  return getVaultHttpApi().get(request, (await params).itemId);
}

export async function PUT(request: Request, { params }: Context) {
  return getVaultHttpApi().update(request, (await params).itemId);
}

export async function DELETE(request: Request, { params }: Context) {
  return getVaultHttpApi().delete(request, (await params).itemId);
}
