import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'VeDirecto · Directorio de ayuda · Venezuela'

// Tarjeta de preview al compartir el link (monocromo, marca propia).
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0a0a0a',
          color: '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontSize: 130, fontWeight: 800, letterSpacing: '-4px' }}>VeDirecto</div>
        <div style={{ fontSize: 38, color: '#9aa4b2', marginTop: 12 }}>
          Sitios de ayuda · Venezuela
        </div>
      </div>
    ),
    { ...size }
  )
}
