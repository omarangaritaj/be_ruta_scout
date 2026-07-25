import { Heading, Link, Section, Text } from '@react-email/components';
import {
  etiquetaCargo,
  ETIQUETA_NIVEL_SOLICITABLE,
  type NivelSolicitud,
} from '../../catalogo-cargos/catalogo-cargos';
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
  const nivelConTerritorio = `${ETIQUETA_NIVEL_SOLICITABLE[nivel]}${
    territorioNombre ? ` - ${territorioNombre}` : ''
  }`;

  return (
    <EmailLayout
      preview="Bienvenido a Ruta: recibimos tu solicitud de acceso"
      siteUrl={siteUrl}
    >
      <Section style={estilosEmail.contenido}>
        <Heading
          as="h2"
          className={clasesEmail.heading}
          style={estilosEmail.titulo}
        >
          ¡Hola, {primerNombre}!
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
          Nos alegra mucho que estés aquí. Tu cuenta en{' '}
          <strong className={clasesEmail.strong} style={{ color: '#1e293b' }}>
            R.U.T.A.
          </strong>
          , la herramienta de Registro de Unidad, Trayectoria y Acompañamiento
          de la Dirección Nacional de Programa de Jóvenes, ya está lista.
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
          También recibimos tu solicitud de acceso con estos datos:
        </Text>

        <Section className={clasesEmail.detail} style={estilosEmail.detalle}>
          <Text
            className={clasesEmail.textSm}
            style={{ margin: '0 0 6px 0', fontSize: 13, color: '#64748b' }}
          >
            <strong className={clasesEmail.strong} style={{ color: '#1e293b' }}>
              Nivel:
            </strong>{' '}
            {nivelConTerritorio}
          </Text>
          <Text
            className={clasesEmail.textSm}
            style={{ margin: 0, fontSize: 13, color: '#64748b' }}
          >
            <strong className={clasesEmail.strong} style={{ color: '#1e293b' }}>
              Cargo:
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
          Alguien de tu organización revisará tu solicitud y recibirás un correo
          cuando sea aprobada o rechazada.
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
