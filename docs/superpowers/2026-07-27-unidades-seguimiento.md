# Unidades: puntos abiertos tras la entrega

Fecha: 2026-07-27
Rama: `feat/units` en `be_ruta`, `fe_ruta` y `powersync`
Spec: [2026-07-27-unidades-design.md](specs/2026-07-27-unidades-design.md)

Lo que la revisión final de rama dejó identificado y **no** se arregló, ordenado por
lo que pesa. Cada punto se verificó contra el código, no es especulación.

## Seguridad

### 1. La escritura offline de asistencia no distingue el rol

`src/powersync/powersync.service.ts` — `canWrite` autoriza con la sola existencia de
una fila en `unit_memberships`, sin mirar `role`. Un protagonista con cuenta aprobada
tiene fila `member` de su unidad, así que puede **escribir y borrar** la asistencia de
todos sus compañeros.

El propio `user.schema.ts` lo advierte por escrito: *"Quien derive permisos de aquí
debe exigir `tipo === 'adulto'`"*. Y no hay ningún guard de `tipo` en `src/auth/`,
`src/powersync/` ni `users.service.ts`: nada impide que un protagonista se registre.

Arreglo: exigir `role` de `unit_leader` o `assistant` para escribir.

### 2. El nivel `region` concede alcance nacional, ahora también para escribir

`src/units/unit-scope.ts` — `UNFILTERED_LEVELS` incluye `REGION`, así que
`scopeReaches` devuelve `true` para cualquier unidad del país. Antes solo afectaba al
listado; desde que `scopeReaches` es la puerta de `configure`, `setMembers` y
`remove`, afecta a la escritura.

No es arreglable hoy sin tocar el modelo: `User` tiene `districtId` pero no `regionId`,
así que no hay con qué acotar una región.

### 3. Declarar jefatura es irreversible

`declareLeadership` solo admite a quien está en `leadership-required`. Una vez
declarada, la persona pasa a alcance `branch` y no puede corregirse si se equivocó de
rama. La única salida hoy es que un administrador reescriba `cargos` con
`PATCH /users/:id`.

No es un callejón sin salida, pero es un procedimiento manual que soporte debe conocer.
Lo más barato para atacar la causa: una confirmación explícita en el selector del
frontend, porque el problema real es el clic apresurado.

## Rendimiento

### 4. `GET /units` escanea el grupo entero en cada petición

`src/units/units.service.ts` — la resiembra incremental cambió el corte de
`unitModel.exists({groupId})` a `userModel.exists({..., unitId: null})`.

Consecuencia: un grupo con **un solo** protagonista sin unidad (por rama ilegible, o
por no tener ningún adulto) deja de cortar barato y paga el `find` completo de los
usuarios del grupo más `planGroupSeed` en cada visita, para acabar en `skipped`.

En la muestra real eso es **33 de 36 grupos**, y `/units` es la pantalla de entrada de
cada dirigente. Además `users.unitId` **no tiene índice**.

Arreglo: índice en `users.unitId`, y un corte previo barato que evite el escaneo
cuando no hay nada que sembrar.

## Corrección

### 5. El modal no puede filtrar a los adultos activos

`assertEligibleLeaders` exige `estado: true`, pero el bucket `adults_of_the_group` de
`powersync/sync-config.yaml` **no filtra por `estado` ni baja esa columna**. El
frontend no tiene el dato para excluir a los desactivados del desplegable de jefe ni
de los subjefes, así que el usuario los ve, los elige, y descubre el error al guardar.

El arreglo cruza los tres repos: filtrar y bajar `estado` en la regla de sync, y
filtrar en `configure-dialog.tsx`.

### 6. El reparador solo repara la mitad

`src/tools/rebuild-unit-memberships.ts` reproyecta `unit_memberships` desde
`units.members`, pero **nunca escribe `users.unitId`**. El criterio de aceptación 7 del
spec ("correr el reconstructor después no produce ningún cambio") solo verifica una de
las dos colecciones derivadas.

### 7. `applySeedPlan` no sincroniza cuando no hay nadie nuevo

`src/units/units.service.ts` — hace `continue` sin llamar a `syncMembership` si
`incoming` está vacío. Si alguna vez un protagonista apareciera en `units.members`
**sin** `users.unitId` (hoy imposible por construcción, pero es justo el estado que el
diseño teme), la resiembra lo ve como pendiente, comprueba que ya está en la unidad, y
no escribe nada: huérfano permanente **y** el escaneo caro del punto 4 disparado para
siempre.

### 8. El `$unset` de `syncMembership` no tiene cobertura

Se añadió para cerrar una fuga latente en el método **central** del diseño. El
re-revisor lo demostró: revirtió ese `$unset` a la semántica anterior y los 43 tests
siguieron en verde. Si alguien lo deshace en un refactor, nada se pone rojo.

### 9. No existe traslado entre unidades existentes

Una separación crea siempre una unidad **nueva**; la resiembra incremental elige
destino sola (la unidad no vacía más antigua). Un recién llegado que aterrice en la
unidad equivocada **no se puede mover** con la API actual, y tras cada separación
todos los nuevos caen en la mitad más antigua, que se desbalancea sin remedio.

Declarado fuera de alcance en el spec, pero conviene saber que la consecuencia
operativa es más dura de lo que parecía al decidirlo.

### 10. Divergencia entre `leader-resolution.ts` y `unit-scope.ts`

`titlesOf()` **une** `cargos[]` y `cargoSiscout` con `.some()`, mientras
`resolveUnitScope` aplica jerarquía (`asignado ?? siscout`). Un adulto con
`cargos[JEFE DE MANADA]` y `cargoSiscout: JEFE DE TROPA` es candidato a jefe de
**ambas** ramas para el sembrador. Sin test.

## Limpieza

### 11. `global_reference` baja `cargos` y el cliente no declara la tabla

`powersync/sync-config.yaml` sincroniza esa colección al dispositivo y `AppSchema` de
`fe_ruta` no la declara: datos que bajan y ningún `useQuery` puede leer. Preexistente.

### 12. `units` baja con `SELECT *`

El array `members[]` completo de todas las unidades del grupo llega a todo adulto del
grupo. Son ObjectId opacos (los nombres solo llegan por membresía), así que el riesgo
es bajo, pero es candidato a la misma minimización que se aplicó a `users`.

## Operativo

### 13. Rotar la credencial de MongoDB Atlas

La cadena de conexión de `be_ruta/.env`, con usuario y contraseña, quedó expuesta en el
historial de la sesión de trabajo del 2026-07-27. Es una base con datos de menores:
conviene rotarla.
