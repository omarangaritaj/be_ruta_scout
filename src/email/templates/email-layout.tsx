import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';

export const MORADO = '#4d006e';
export const CONTACTO_EMAIL = 'desarrollo.tecnologico@scout.org.co';

export const clasesEmail = {
  heading: 'email-heading',
  text: 'email-text',
  textSm: 'email-text-sm',
  strong: 'email-strong',
  detail: 'email-detail',
  detailWarn: 'email-detail-warn',
  link: 'email-link',
} as const;

export const estilosEmail = {
  contenido: { padding: '32px 28px' },
  titulo: {
    margin: '0 0 8px 0',
    fontSize: 22,
    fontWeight: 700,
    color: MORADO,
  },
  parrafo: {
    margin: '0 0 20px 0',
    fontSize: 15,
    lineHeight: '1.6',
    color: '#475569',
  },
  textoPequeno: {
    margin: 0,
    fontSize: 13,
    lineHeight: '1.6',
    color: '#64748b',
  },
  detalle: {
    backgroundColor: '#f8f4fc',
    borderRadius: 8,
    padding: '16px 20px',
    marginBottom: 20,
  },
} as const;

export function EmailButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Button
      href={href}
      style={{
        backgroundColor: MORADO,
        color: '#ffffff',
        fontSize: 15,
        fontWeight: 600,
        borderRadius: 8,
        padding: '13px 26px',
        textDecoration: 'none',
      }}
    >
      {children}
    </Button>
  );
}

export function EmailLayout({
  children,
  preview,
  siteUrl,
}: {
  children: ReactNode;
  preview: string;
  siteUrl: string;
}) {
  return (
    <Html lang="es">
      <Head>
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>
          {`
            @media (prefers-color-scheme: dark) {
              .email-body { background-color: #0f172a !important; }
              .email-container { background-color: #1e1b2e !important; }
              .email-heading { color: #e9d5ff !important; }
              .email-text { color: #cbd5e1 !important; }
              .email-text-sm { color: #94a3b8 !important; }
              .email-strong { color: #f1f5f9 !important; }
              .email-detail { background-color: #2d1b4e !important; }
              .email-detail-warn { background-color: #2c1a10 !important; }
              .email-link { color: #c084fc !important; }
              .email-footer { background-color: #2d1b4e !important; border-top-color: #4b2b5a !important; }
              .email-footer-text { color: #f1e9f5 !important; }
              .email-footer-title { color: #ffffff !important; }
              .email-divider { background-color: #ffffff !important; opacity: 1 !important; }
            }
          `}
        </style>
      </Head>
      <Preview>{preview}</Preview>
      <Body
        className="email-body"
        style={{
          margin: 0,
          padding: 0,
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          backgroundColor: '#f1f5f9',
          color: '#1e293b',
        }}
      >
        <Container
          className="email-container"
          style={{
            maxWidth: 480,
            margin: '32px auto',
            backgroundColor: '#ffffff',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <Section
            className="email-header"
            style={{ backgroundColor: MORADO, padding: '22px 28px' }}
          >
            <table role="presentation" cellPadding="0" cellSpacing="0">
              <tbody>
                <tr>
                  <td style={{ verticalAlign: 'middle' }}>
                    <Img
                      src={`${siteUrl}/brand/logo-dnpj.png`}
                      alt="Dirección Nacional de Programa de Jóvenes"
                      width="58"
                      height="52"
                      style={{ display: 'block', border: 0 }}
                    />
                  </td>
                  <td style={{ verticalAlign: 'middle', padding: '0 18px' }}>
                    <div
                      className="email-divider"
                      style={{
                        width: 1,
                        height: 58,
                        backgroundColor: '#ffffff',
                        opacity: 1,
                      }}
                    />
                  </td>
                  <td style={{ verticalAlign: 'middle' }}>
                    <Img
                      src={`${siteUrl}/brand/logo-scouts-colombia-positive.png`}
                      alt="Scouts de Colombia"
                      width="149"
                      height="64"
                      style={{ display: 'block', border: 0 }}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {children}

          <Section
            className="email-footer"
            style={{
              padding: '16px 28px',
              backgroundColor: '#f8f4fc',
              borderTop: '1px solid #ece6f1',
            }}
          >
            <table
              role="presentation"
              cellPadding="0"
              cellSpacing="0"
              width="100%"
            >
              <tbody>
                <tr>
                  <td
                    style={{
                      verticalAlign: 'middle',
                      paddingRight: 14,
                      width: '1%',
                    }}
                  >
                    <Img
                      src={`${siteUrl}/brand/logo-dnpj.png`}
                      alt="DNPJ"
                      width="40"
                      height="36"
                      style={{ display: 'block', border: 0, opacity: 0.6 }}
                    />
                  </td>
                  <td style={{ verticalAlign: 'middle' }}>
                    <Text
                      className="email-footer-text"
                      style={{
                        margin: 0,
                        fontSize: 12,
                        lineHeight: '1.6',
                        color: '#64748b',
                      }}
                    >
                      <strong
                        className="email-footer-title"
                        style={{ color: MORADO }}
                      >
                        Herramienta Ruta
                      </strong>
                      <br />
                      Dirección Nacional de Programa de Jóvenes
                      <br />
                      Asociación Scouts de Colombia
                    </Text>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
