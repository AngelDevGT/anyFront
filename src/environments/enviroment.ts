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
const apiUrlBase = 'https://any-function-sql.azurewebsites.net/api';
// Para trabajar contra el backend local, cambiar por esta linea (y NO commitear el cambio):
// const apiUrlBase = 'http://localhost:7071/api';

export const environment = {
    production: false,
    apiUrlBase,
    apiUrlV3: `${apiUrlBase}/V3`,
};
