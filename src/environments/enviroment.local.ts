/**
 * Entorno de DESARROLLO LOCAL: apunta al backend que levanta el docker-compose de any_func_sql.
 *
 * Se activa con `npm run start:local` (o `ng serve --configuration local`), que lo sustituye por
 * enviroment.ts mediante fileReplacements. Gracias a eso enviroment.ts nunca se edita, y no hay
 * riesgo de desplegar a produccion apuntando a localhost.
 *
 * El navegador corre en la maquina, no dentro de Docker, asi que la URL es localhost aunque el
 * backend este en un contenedor: 7071 esta publicado por el compose.
 */
const apiUrlBase = 'http://localhost:7071/api';

export const environment = {
    production: false,
    apiUrlBase,
    apiUrlV3: `${apiUrlBase}/V3`,
};
