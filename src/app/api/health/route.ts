export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ ok: true, service: 'sd-games', timestamp: new Date().toISOString() });
}
