import { Heading, Link, Section, Text } from '@react-email/components';
import {
  etiquetaCargo,
  ETIQUETA_NIVEL_SOLICITABLE,
  type NivelSolicitud,
} from '../../catalogo-cargos/catalogo-cargos';
import { K, t } from '../../i18n';
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
      preview={t(
        aprobado
          ? K.EMAIL.RESOLVED_APPROVED_PREVIEW
          : K.EMAIL.RESOLVED_REJECTED_PREVIEW,
      )}
      siteUrl={siteUrl}
    >
      <Section style={estilosEmail.contenido}>
        <Heading
          as="h2"
          className={clasesEmail.heading}
          style={estilosEmail.titulo}
        >
          {t(
            aprobado
              ? K.EMAIL.RESOLVED_APPROVED_HEADING
              : K.EMAIL.RESOLVED_REJECTED_HEADING,
            { nombre: primerNombre },
          )}
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
          {t(K.EMAIL.RESOLVED_REQUEST_PREFIX)}
          <strong className={clasesEmail.strong} style={{ color: '#1e293b' }}>
            {t(K.EMAIL.BRAND_RUTA)}
          </strong>
          {t(
            aprobado
              ? K.EMAIL.RESOLVED_APPROVED_SUFFIX
              : K.EMAIL.RESOLVED_REJECTED_SUFFIX,
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
                {t(K.EMAIL.LABEL_LEVEL)}
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
                {t(K.EMAIL.LABEL_POSITION)}
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
                  {t(K.EMAIL.LABEL_APPROVER_NOTE)}
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
                {t(K.EMAIL.LABEL_REJECTION_REASON)}
              </strong>{' '}
              {nota ?? ''}
            </Text>
          </Section>
        )}

        {aprobado ? (
          <>
            <EmailButton href={siteUrl}>{t(K.EMAIL.RESOLVED_CTA)}</EmailButton>
            <Text
              className={clasesEmail.textSm}
              style={{
                margin: '16px 0 0 0',
                fontSize: 13,
                lineHeight: '1.6',
                color: '#64748b',
              }}
            >
              {t(K.EMAIL.RESOLVED_TUTORIAL_NOTICE)}
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
            {t(K.EMAIL.RESOLVED_REJECTED_RETRY)}
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
          {t(K.EMAIL.CONTACT_PROMPT)}
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
