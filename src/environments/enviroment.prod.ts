/**
 * Ver las notas de enviroment.ts.
 *
 * Ojo: angular.json no define fileReplacements, asi que hoy el build de produccion usa
 * enviroment.ts. Este archivo se mantiene alineado para que no vuelva a quedar obsoleto.
 */
const apiUrlBase = 'https://any-function-sql.azurewebsites.net/api';

export const environment = {
    production: true,
    apiUrlBase,
    apiUrlV3: `${apiUrlBase}/V3`,
};
