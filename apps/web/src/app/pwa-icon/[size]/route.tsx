import { ImageResponse } from 'next/og';

// M6-04: the install icons, drawn in code so no image files are needed. Ink square, volt "F".
const SIZES = new Set(['192', '512']);

export function generateStaticParams() {
  return [...SIZES].map((size) => ({ size }));
}

export async function GET(_req: Request, { params }: RouteContext<'/pwa-icon/[size]'>) {
  const { size } = await params;
  if (!SIZES.has(size)) return new Response('Not found', { status: 404 });
  const px = Number(size);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111111', color: '#d4f000', fontSize: px * 0.62, fontWeight: 800 }}>
        F
      </div>
    ),
    { width: px, height: px },
  );
}
