/**
 * apiUrlBase  -> raiz del Function App. De aqui cuelgan las funciones propias:
 *                Login, Refresh, Logout, Session, CreateUser, RegisterUser, UpdateUser,
 *                UploadImage.
 * apiUrlV3    -> gateway generico de datos (apiUrlBase + /V3).
 *
 * El JwtInterceptor adjunta el Bearer a todo lo que empiece por apiUrlBase, asi que ambas
 * deben apuntar al mismo host.
 *
 * Para trabajar contra el backend local: descomentar el bloque de localhost.
 */
// Para trabajar contra el backend local NO se edita este archivo: se usa
// `npm run start:local`, que lo sustituye por enviroment.local.ts.
const apiUrlBase = 'https://any-function-sql.azurewebsites.net/api';

export const environment = {
    production: false,
    apiUrlBase,
    apiUrlV3: `${apiUrlBase}/V3`,
};
