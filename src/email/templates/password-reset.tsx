import { Heading, Link, Section, Text } from '@react-email/components';
import { K, t } from '../../i18n';
import {
  clasesEmail,
  CONTACTO_EMAIL,
  EmailButton,
  EmailLayout,
  MORADO,
  estilosEmail,
} from './email-layout';

export interface PasswordResetProps {
  nombre: string;
  url: string;
  minutos: number;
  siteUrl: string;
}

export default function PasswordReset({
  nombre,
  url,
  minutos,
  siteUrl,
}: PasswordResetProps) {
  const primerNombre = nombre.trim().split(/\s+/)[0] || nombre;

  return (
    <EmailLayout preview={t(K.EMAIL.RESET_PREVIEW)} siteUrl={siteUrl}>
      <Section style={estilosEmail.contenido}>
        <Heading
          as="h2"
          className={clasesEmail.heading}
          style={estilosEmail.titulo}
        >
          {t(K.EMAIL.RESET_GREETING, { nombre: primerNombre })}
        </Heading>

        <Text className={clasesEmail.text} style={estilosEmail.parrafo}>
          {t(K.EMAIL.RESET_INTRO)}
          <strong className={clasesEmail.strong} style={{ color: '#1e293b' }}>
            {t(K.EMAIL.BRAND_RUTA)}
          </strong>
          {t(K.EMAIL.RESET_INTRO_AFTER)}
        </Text>

        <Section style={{ marginBottom: 20 }}>
          <EmailButton href={url}>{t(K.EMAIL.RESET_CTA)}</EmailButton>
        </Section>

        <Section
          className={clasesEmail.detailWarn}
          style={estilosEmail.detalle}
        >
          <Text
            className={clasesEmail.textSm}
            style={{ ...estilosEmail.textoPequeno, marginBottom: 8 }}
          >
            {t(K.EMAIL.RESET_EXPIRATION, { minutos })}
          </Text>
          <Text
            className={clasesEmail.textSm}
            style={estilosEmail.textoPequeno}
          >
            {t(K.EMAIL.RESET_IGNORE)}
          </Text>
        </Section>

        <Text
          className={clasesEmail.textSm}
          style={{ ...estilosEmail.textoPequeno, marginBottom: 16 }}
        >
          {t(K.EMAIL.RESET_FALLBACK)}
          <br />
          <Link
            href={url}
            className={clasesEmail.link}
            style={{ color: MORADO, wordBreak: 'break-all' }}
          >
            {url}
          </Link>
        </Text>

        <Text className={clasesEmail.textSm} style={estilosEmail.textoPequeno}>
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
