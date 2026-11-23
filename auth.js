// auth.js
// ⚠️ IMPORTANTE: la URL va SIN /rest/v1/ al final
// Estas dos constantes conectan el navegador con el proyecto Supabase.
// En una app web, la clave debe ser publicable; nunca se coloca aquí service_role.
const appConfig = window.APP_CONFIG;
if (
    !appConfig ||
    typeof appConfig.supabaseUrl !== 'string' ||
    typeof appConfig.supabaseAnonKey !== 'string' ||
    appConfig.supabaseUrl.trim() === '' ||
    appConfig.supabaseAnonKey.trim() === ''
) {
    throw new Error('Faltan SUPABASE_URL y SUPABASE_ANON_KEY en la configuración de ejecución.');
}
const SUPABASE_URL = appConfig.supabaseUrl;
const SUPABASE_ANON_KEY = appConfig.supabaseAnonKey;
// Creamos un solo cliente con la URL y la clave publicable inyectadas al iniciar el contenedor.
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Registramos la identidad en Supabase Auth y guardamos el nombre como metadato del perfil.
export async function registrarUsuario(email, password, fullName) {
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                full_name: fullName,
            },
        },
    });
    return { data, error };
}

// Pedimos a Supabase que valide el correo y la contraseña de una cuenta existente.
export async function iniciarSesion(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });
    return { data, error };
}

// Cerramos la sesión remota; el listener de abajo actualizará la interfaz.
export async function cerrarSesion() {
    await supabase.auth.signOut();
}

// Mantenemos sincronizadas las pantallas con el estado de sesión de Supabase.
export function escucharCambiosSesion(callback) {
    supabase.auth.onAuthStateChange((event, session) => {
        callback(session ? session.user : null);
    });
}