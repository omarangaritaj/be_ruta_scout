import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfigService } from '../../config';
import {
  SiscoutClient,
  type MembersResponse,
} from '../ports/siscout-client.port';

interface Cookie {
  name: string;
  value: string;
}

/** Columnas que exige el endpoint DataTables, en orden. */
const COLUMNS = [
  'person_id',
  'citizenship_card',
  'nombre',
  'tipomiembro',
  'cargo',
  'telefono',
  'email',
  'sex',
  'group_id',
  'group_name',
  'district_name',
  'district_id',
  'zone_id',
  'code_raw',
];

/**
 * Adaptador contra SiScout.
 *
 * SiScout es una aplicación Laravel, no una API: la autenticación es por
 * formulario con token CSRF y cookies de sesión, y el listado es un endpoint
 * DataTables. Nada de esto sale de este archivo.
 *
 * Las credenciales, cookies y tokens CSRF no se escriben nunca en los logs.
 */
@Injectable()
export class SiscoutHttpClient extends SiscoutClient {
  private readonly logger = new Logger(SiscoutHttpClient.name);

  constructor(
    @Inject(ConfigService)
    private readonly config: AppConfigService,
  ) {
    super();
  }

  isConfigured(): boolean {
    return Boolean(
      this.config.get('SISCOUT_BASE_URL', { infer: true }) &&
      this.config.get('SISCOUT_MASTER_USER', { infer: true }) &&
      this.config.get('SISCOUT_MASTER_PASSWORD', { infer: true }) &&
      this.config.get('SISCOUT_CHANGE_ROL_PATH', { infer: true }),
    );
  }

  async authenticate(): Promise<string> {
    const base = this.baseUrl();
    const username = this.config.get('SISCOUT_MASTER_USER', { infer: true });
    const password = this.config.get('SISCOUT_MASTER_PASSWORD', {
      infer: true,
    });
    const changeRolPath = this.config.get('SISCOUT_CHANGE_ROL_PATH', {
      infer: true,
    });

    if (!username || !password || !changeRolPath) {
      throw new Error(
        'Faltan SISCOUT_MASTER_USER, SISCOUT_MASTER_PASSWORD o SISCOUT_CHANGE_ROL_PATH',
      );
    }

    // 1. GET /login: token CSRF y cookies iniciales.
    const loginPage = await fetch(`${base}/login`, { redirect: 'follow' });
    if (!loginPage.ok) {
      throw new Error(`GET /login falló: ${loginPage.status}`);
    }

    const html = await loginPage.text();
    const csrf = /name="_token"\s+value="([^"]+)"/.exec(html)?.[1];
    if (!csrf) {
      throw new Error('No se encontró el token CSRF en GET /login');
    }

    const initialCookies = this.readCookies(loginPage);

    // 2. POST /login. El campo de usuario es `username`, no `email`.
    const body = new URLSearchParams({
      _token: csrf,
      username,
      password,
    });

    const loginResponse = await fetch(`${base}/login`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: this.toCookieHeader(initialCookies),
      },
      body: body.toString(),
    });

    let cookies = this.mergeCookies(
      initialCookies,
      this.readCookies(loginResponse),
    );

    // 3. Seguir el redirect a mano: Laravel fija ahí la sesión definitiva.
    const location = loginResponse.headers.get('location');
    if (location && loginResponse.status >= 300 && loginResponse.status < 400) {
      const target = location.startsWith('http')
        ? location
        : `${base}${location}`;
      const redirected = await fetch(target, {
        redirect: 'manual',
        headers: { Cookie: this.toCookieHeader(cookies) },
      });
      cookies = this.mergeCookies(cookies, this.readCookies(redirected));
    }

    if (!cookies.some((c) => c.name === 'siscout_session')) {
      throw new Error(
        'No se obtuvo siscout_session: credenciales incorrectas o cambió la estructura del login',
      );
    }

    const cookieHeader = this.toCookieHeader(
      cookies.filter((c) => ['XSRF-TOKEN', 'siscout_session'].includes(c.name)),
    );

    // 4. Activar el rol con acceso nacional.
    await this.activateNationalRole(base, cookieHeader, changeRolPath);

    this.logger.log('Sesión de SiScout establecida con rol nacional activo');

    return cookieHeader;
  }

  async listZoneMembers(
    cookie: string,
    zoneId: number,
    start: number,
    length: number,
    draw: number,
  ): Promise<MembersResponse> {
    const base = this.baseUrl();
    const params = new URLSearchParams({
      tipos: 'A', // A = zona (D sería región)
      filter: String(zoneId),
      inscripcion: 'INS',
      useractivos: 'A',
      filter_period: '1',
      draw: String(draw),
      start: String(start),
      length: String(length),
      'search[value]': '',
    });

    COLUMNS.forEach((column, index) => {
      params.set(`columns[${index}][data]`, column);
    });

    const response = await fetch(
      `${base}/administracion-territorial/miembros/listar-miembros?${params}`,
      { headers: this.requestHeaders(base, cookie) },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `listar-miembros zona ${zoneId} (start=${start}) falló: ${response.status}\n${body.slice(0, 600)}`,
      );
    }

    const json = (await response.json()) as {
      recordsTotal?: unknown;
      recordsFiltered?: number | null;
      data?: unknown[];
    };

    if (typeof json.recordsTotal !== 'number') {
      throw new Error(
        `listar-miembros zona ${zoneId} (start=${start}): recordsTotal ausente o no numérico`,
      );
    }

    return {
      recordsTotal: json.recordsTotal,
      recordsFiltered: json.recordsFiltered ?? null,
      data: Array.isArray(json.data) ? json.data : [],
    };
  }

  private async activateNationalRole(
    base: string,
    cookie: string,
    changeRolPath: string,
  ): Promise<void> {
    const response = await fetch(`${base}${changeRolPath}`, {
      redirect: 'follow',
      headers: this.requestHeaders(base, cookie),
    });

    if (!response.ok) {
      throw new Error(`change-rol falló: ${response.status}`);
    }
  }

  private baseUrl(): string {
    const base = this.config.get('SISCOUT_BASE_URL', { infer: true });
    if (!base) {
      throw new Error('SISCOUT_BASE_URL no está configurada');
    }
    return base.replace(/\/$/, '');
  }

  private requestHeaders(base: string, cookie: string): Record<string, string> {
    const xsrf = this.xsrfToken(cookie);

    return {
      Cookie: cookie,
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json',
      Referer: `${base}/administracion-territorial/miembros`,
      ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}),
    };
  }

  /** Laravel espera el valor DECODIFICADO de la cookie XSRF-TOKEN. */
  private xsrfToken(cookie: string): string | undefined {
    const value = /XSRF-TOKEN=([^;]+)/.exec(cookie)?.[1];
    if (!value) return undefined;

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  private readCookies(response: Response): Cookie[] {
    const headers = response.headers as unknown as {
      getSetCookie?: () => string[];
    };
    const raw =
      typeof headers.getSetCookie === 'function'
        ? headers.getSetCookie()
        : [response.headers.get('set-cookie')].filter(
            (v): v is string => v !== null,
          );

    return raw
      .map((line) => {
        const [pair] = line.split(';');
        const separator = pair.indexOf('=');
        if (separator === -1) return null;
        return {
          name: pair.slice(0, separator).trim(),
          value: pair.slice(separator + 1).trim(),
        };
      })
      .filter((c): c is Cookie => c !== null);
  }

  /** Las cookies nuevas tienen precedencia sobre las antiguas del mismo nombre. */
  private mergeCookies(older: Cookie[], newer: Cookie[]): Cookie[] {
    const names = new Set(newer.map((c) => c.name));
    return [...newer, ...older.filter((c) => !names.has(c.name))];
  }

  private toCookieHeader(cookies: Cookie[]): string {
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  }
}
