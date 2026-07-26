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
  EmailLayout,
  MORADO,
  estilosEmail,
} from './email-layout';

export interface SolicitudRecibidaProps {
  nombre: string;
  nivel: NivelSolicitud;
  cargo: string;
  territorioNombre?: string | null;
  siteUrl: string;
}

export default function SolicitudRecibida({
  nombre,
  nivel,
  cargo,
  territorioNombre = null,
  siteUrl,
}: SolicitudRecibidaProps) {
  const primerNombre = nombre.trim().split(/\s+/)[0] || nombre;
  const nivelConTerritorio = territorioNombre
    ? t(K.EMAIL.LEVEL_WITH_TERRITORY, {
        nivel: ETIQUETA_NIVEL_SOLICITABLE[nivel],
        territorio: territorioNombre,
      })
    : ETIQUETA_NIVEL_SOLICITABLE[nivel];

  return (
    <EmailLayout preview={t(K.EMAIL.RECEIVED_PREVIEW)} siteUrl={siteUrl}>
      <Section style={estilosEmail.contenido}>
        <Heading
          as="h2"
          className={clasesEmail.heading}
          style={estilosEmail.titulo}
        >
          {t(K.EMAIL.RECEIVED_GREETING, { nombre: primerNombre })}
        </Heading>
        <Text
          className={clasesEmail.text}
          style={{
            margin: '0 0 20px 0',
            fontSize: 15,
            lineHeight: '1.6',
            color: '#475569',
          }}
        >
          {t(K.EMAIL.RECEIVED_INTRO_BEFORE)}
          <strong className={clasesEmail.strong} style={{ color: '#1e293b' }}>
            {t(K.EMAIL.BRAND_RUTA)}
          </strong>
          {t(K.EMAIL.RECEIVED_INTRO_AFTER)}
        </Text>
        <Text
          className={clasesEmail.text}
          style={{
            margin: '0 0 16px 0',
            fontSize: 15,
            lineHeight: '1.6',
            color: '#475569',
          }}
        >
          {t(K.EMAIL.RECEIVED_DATA_INTRO)}
        </Text>

        <Section className={clasesEmail.detail} style={estilosEmail.detalle}>
          <Text
            className={clasesEmail.textSm}
            style={{ margin: '0 0 6px 0', fontSize: 13, color: '#64748b' }}
          >
            <strong className={clasesEmail.strong} style={{ color: '#1e293b' }}>
              {t(K.EMAIL.LABEL_LEVEL)}
            </strong>{' '}
            {nivelConTerritorio}
          </Text>
          <Text
            className={clasesEmail.textSm}
            style={{ margin: 0, fontSize: 13, color: '#64748b' }}
          >
            <strong className={clasesEmail.strong} style={{ color: '#1e293b' }}>
              {t(K.EMAIL.LABEL_POSITION)}
            </strong>{' '}
            {etiquetaCargo(cargo)}
          </Text>
        </Section>

        <Text
          className={clasesEmail.text}
          style={{
            margin: '0 0 8px 0',
            fontSize: 15,
            lineHeight: '1.6',
            color: '#475569',
          }}
        >
          {t(K.EMAIL.RECEIVED_REVIEW_NOTICE)}
        </Text>
        <Text
          className={clasesEmail.textSm}
          style={{
            margin: 0,
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
