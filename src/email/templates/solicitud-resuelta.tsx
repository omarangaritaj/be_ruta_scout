import { Heading, Link, Section, Text } from '@react-email/components';
import {
  etiquetaCargo,
  ETIQUETA_NIVEL_SOLICITABLE,
  type NivelSolicitud,
} from '../../catalogo-cargos/catalogo-cargos';
import {
  clasesEmail,
  CONTACTO_EMAIL,
  EmailButton,
  EmailLayout,
  MORADO,
  estilosEmail,
} from './email-layout';

export interface SolicitudResueltaProps {
  nombre: string;
  resultado: 'aprobado' | 'rechazado';
  /** Nivel y cargo definitivos (solo cuando resultado = aprobado). */
  nivel?: NivelSolicitud;
  cargo?: string;
  nota?: string | null;
  siteUrl: string;
}

export default function SolicitudResuelta({
  nombre,
  resultado,
  nivel,
  cargo,
  nota = null,
  siteUrl,
}: SolicitudResueltaProps) {
  const aprobado = resultado === 'aprobado';
  const primerNombre = nombre.trim().split(/\s+/)[0] || nombre;

  return (
    <EmailLayout
      preview={
        aprobado
          ? 'Tu acceso a Ruta fue aprobado'
          : 'Sobre tu solicitud de acceso a Ruta'
      }
      siteUrl={siteUrl}
    >
      <Section style={estilosEmail.contenido}>
        <Heading
          as="h2"
          className={clasesEmail.heading}
          style={estilosEmail.titulo}
        >
          {aprobado
            ? `Hola ${primerNombre}, tu acceso fue aprobado`
            : `Hola ${primerNombre}, sobre tu solicitud`}
        </Heading>
        <Text
          className={clasesEmail.text}
          style={{
            margin: '0 0 16px 0',
            fontSize: 15,
            lineHeight: '1.6',
            color: '#475569',
          }}
        >
          {aprobado ? (
            <>
              Tu solicitud de acceso a{' '}
              <strong
                className={clasesEmail.strong}
                style={{ color: '#1e293b' }}
              >
                R.U.T.A.
              </strong>{' '}
              fue aprobada con estos datos:
            </>
          ) : (
            <>
              Tu solicitud de acceso a{' '}
              <strong
                className={clasesEmail.strong}
                style={{ color: '#1e293b' }}
              >
                R.U.T.A.
              </strong>{' '}
              no fue aprobada en esta ocasión.
            </>
          )}
        </Text>

        {aprobado ? (
          <Section className={clasesEmail.detail} style={estilosEmail.detalle}>
            <Text
              className={clasesEmail.textSm}
              style={{ margin: '0 0 6px 0', fontSize: 13, color: '#64748b' }}
            >
              <strong
                className={clasesEmail.strong}
                style={{ color: '#1e293b' }}
              >
                Nivel:
              </strong>{' '}
              {nivel ? ETIQUETA_NIVEL_SOLICITABLE[nivel] : ''}
            </Text>
            <Text
              className={clasesEmail.textSm}
              style={{
                margin: nota ? '0 0 6px 0' : 0,
                fontSize: 13,
                color: '#64748b',
              }}
            >
              <strong
                className={clasesEmail.strong}
                style={{ color: '#1e293b' }}
              >
                Cargo:
              </strong>{' '}
              {cargo ? etiquetaCargo(cargo) : ''}
            </Text>
            {nota ? (
              <Text
                className={clasesEmail.textSm}
                style={{ margin: 0, fontSize: 13, color: '#64748b' }}
              >
                <strong
                  className={clasesEmail.strong}
                  style={{ color: '#1e293b' }}
                >
                  Nota de quien aprobó:
                </strong>{' '}
                {nota}
              </Text>
            ) : null}
          </Section>
        ) : (
          <Section
            className={clasesEmail.detailWarn}
            style={{
              backgroundColor: '#fdf6f0',
              borderRadius: 8,
              padding: '16px 20px',
              marginBottom: 20,
            }}
          >
            <Text
              className={clasesEmail.textSm}
              style={{ margin: 0, fontSize: 13, color: '#64748b' }}
            >
              <strong
                className={clasesEmail.strong}
                style={{ color: '#1e293b' }}
              >
                Motivo indicado:
              </strong>{' '}
              {nota ?? ''}
            </Text>
          </Section>
        )}

        {aprobado ? (
          <>
            <EmailButton href={siteUrl}>Entrar a R.U.T.A.</EmailButton>
            <Text
              className={clasesEmail.textSm}
              style={{
                margin: '16px 0 0 0',
                fontSize: 13,
                lineHeight: '1.6',
                color: '#64748b',
              }}
            >
              Al ingresar a la plataforma se activará un tutorial paso a paso.
              Te invitamos a seguirlo completo para conocer el flujo principal
              de R.U.T.A.
            </Text>
          </>
        ) : (
          <Text
            className={clasesEmail.text}
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: '1.6',
              color: '#475569',
            }}
          >
            Si crees que hubo un error o tus datos cambiaron, puedes corregirlos
            y enviar una nueva solicitud desde la app.
          </Text>
        )}

        <Text
          className={clasesEmail.textSm}
          style={{
            margin: '16px 0 0 0',
            fontSize: 13,
            lineHeight: '1.6',
            color: '#64748b',
          }}
        >
          Si tienes preguntas, escríbenos a{' '}
          <Link
            href={`mailto:${CONTACTO_EMAIL}`}
            className={clasesEmail.link}
            style={{ color: MORADO }}
          >
            {CONTACTO_EMAIL}
          </Link>
          .
        </Text>
      </Section>
    </EmailLayout>
  );
}
