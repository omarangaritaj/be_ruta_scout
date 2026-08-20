import { Heading, Section, Text } from '@react-email/components';
import { K, t } from '../../i18n';
import {
  clasesEmail,
  EmailButton,
  EmailLayout,
  estilosEmail,
} from './email-layout';

export interface AccesoCambiadoProps {
  nombre: string;
  /** `true` cuando se suspende; `false` cuando se le devuelve el acceso. */
  suspendido: boolean;
  /** Motivo que dejó quien administra. Puede no haberlo. */
  nota?: string | null;
  siteUrl: string;
}

/**
 * Aviso de que a alguien le suspendieron el acceso — o se lo devolvieron.
 *
 * Es la etapa del flujo que faltaba: sin este correo, a la persona la
 * suspendían, entraba a la app, se topaba con la pantalla de acceso suspendido
 * y nunca supo por qué ni cuándo. Enterarse por un muro es la peor manera.
 *
 * No lleva botón cuando se suspende: invitar a entrar a quien no puede sería
 * burlarse. Al reactivar sí, porque ahí sí hay a dónde ir.
 */
export default function AccesoCambiado({
  nombre,
  suspendido,
  nota = null,
  siteUrl,
}: AccesoCambiadoProps) {
  const primerNombre = nombre.trim().split(/\s+/)[0] || nombre;

  return (
    <EmailLayout
      preview={t(
        suspendido
          ? K.EMAIL.SUSPENDED_PREVIEW
          : K.EMAIL.REINSTATED_PREVIEW,
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
            suspendido
              ? K.EMAIL.SUSPENDED_HEADING
              : K.EMAIL.REINSTATED_HEADING,
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
          {t(suspendido ? K.EMAIL.SUSPENDED_BODY : K.EMAIL.REINSTATED_BODY)}
        </Text>

        {nota && (
          <Text
            className={clasesEmail.text}
            style={{
              margin: '0 0 16px 0',
              fontSize: 15,
              lineHeight: '1.6',
              color: '#475569',
            }}
          >
            <strong>{t(K.EMAIL.LABEL_APPROVER_NOTE)}</strong> {nota}
          </Text>
        )}

        {!suspendido && (
          <EmailButton href={siteUrl}>{t(K.EMAIL.RESOLVED_CTA)}</EmailButton>
        )}

        <Text
          className={clasesEmail.text}
          style={{
            margin: '16px 0 0 0',
            fontSize: 15,
            lineHeight: '1.6',
            color: '#475569',
          }}
        >
          {t(K.EMAIL.SUSPENDED_CONTACT)}
        </Text>
      </Section>
    </EmailLayout>
  );
}
