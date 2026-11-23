import pkg from 'pg';

// Tomamos el cliente PostgreSQL del paquete pg para hablar con la base gestionada.
const { Client } = pkg;

class DatabaseManager {
    constructor(connectionString) {
        // La conexión usa TLS; el texto de conexión es privado y no pertenece al frontend.
        this.client = new Client({
            connectionString,
            ssl: { rejectUnauthorized: false }
        });
    }

    async inicializarEstructura() {
        let connected = false;

        try {
            // Abrimos la conexión antes de iniciar cualquier cambio en el esquema.
            await this.client.connect();
            connected = true;
            console.log('Conectado a PostgreSQL de Supabase.');

            await this.client.query('BEGIN');

            try {
                // El perfil se enlaza con Auth: al borrar la cuenta, también se borra su perfil.
                await this.client.query(`
                    CREATE TABLE IF NOT EXISTS public.jugadores (
                        id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
                        email TEXT NOT NULL,
                        rango_maximo INT NOT NULL DEFAULT 0,
                        fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT now()
                    );
                `);

                // Activamos RLS y damos a los jugadores solo los permisos que necesita la app.
                await this.client.query(`
                    ALTER TABLE public.jugadores ENABLE ROW LEVEL SECURITY;
                    REVOKE ALL ON TABLE public.jugadores FROM anon, authenticated;
                    GRANT SELECT, UPDATE ON TABLE public.jugadores TO authenticated;
                `);

                // Cada política limita las filas al usuario que Supabase autentica en la sesión.
                await this.crearPoliticaSiNoExiste(
                    'jugadores_select_own',
                    'SELECT',
                    'USING ((SELECT auth.uid()) = id)'
                );
                await this.crearPoliticaSiNoExiste(
                    'jugadores_update_own',
                    'UPDATE',
                    'USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id)'
                );

                // El trigger usa esta función para crear un perfil cuando nace una cuenta Auth.
                await this.client.query(`
                    CREATE OR REPLACE FUNCTION public.handle_new_user()
                    RETURNS trigger
                    LANGUAGE plpgsql
                    SECURITY DEFINER
                    SET search_path = ''
                    AS $function$
                    BEGIN
                        INSERT INTO public.jugadores (id, email, rango_maximo)
                        VALUES (new.id, new.email, 0)
                        ON CONFLICT (id) DO NOTHING;
                        RETURN new;
                    END;
                    $function$;
                `);

                // Evitamos duplicar el trigger y comprobamos que llame a la función esperada.
                await this.crearTriggerSiNoExiste();

                // Verificamos los objetos principales antes de confirmar la transacción.
                const verification = await this.client.query(`
                    SELECT
                        to_regclass('public.jugadores') IS NOT NULL AS table_exists,
                        EXISTS (
                            SELECT 1
                            FROM pg_trigger
                            WHERE tgname = 'on_auth_user_created'
                              AND tgrelid = 'auth.users'::regclass
                              AND tgfoid = 'public.handle_new_user()'::regprocedure
                              AND NOT tgisinternal
                        ) AS trigger_exists;
                `);

                if (!verification.rows[0].table_exists || !verification.rows[0].trigger_exists) {
                    throw new Error('No se pudo verificar la tabla jugadores y su trigger.');
                }

                // Si todo quedó listo, hacemos permanentes los cambios; ante un error se revierten.
                await this.client.query('COMMIT');
                console.log("Tabla 'public.jugadores' y trigger verificados.");
            } catch (error) {
                await this.client.query('ROLLBACK');
                throw error;
            }
        } catch (error) {
            console.error('Error al inicializar la base de datos:', error);
            throw error;
        } finally {
            // Cerramos el socket incluso cuando una consulta falla.
            if (connected) {
                await this.client.end();
            }
        }
    }

    // Creamos cada política solo si todavía no existe en public.jugadores.
    async crearPoliticaSiNoExiste(nombre, comando, expresion) {
        const existingPolicy = await this.client.query(
            `SELECT 1
             FROM pg_policies
             WHERE schemaname = 'public'
               AND tablename = 'jugadores'
               AND policyname = $1;`,
            [nombre]
        );

        if (existingPolicy.rowCount === 0) {
            await this.client.query(`
                CREATE POLICY ${nombre}
                ON public.jugadores
                FOR ${comando}
                TO authenticated
                ${expresion};
            `);
        }
    }

    // Revisamos el trigger existente antes de instalar uno nuevo.
    async crearTriggerSiNoExiste() {
        const existingTrigger = await this.client.query(`
            SELECT
                EXISTS (
                    SELECT 1
                    FROM pg_trigger
                    WHERE tgname = 'on_auth_user_created'
                      AND tgrelid = 'auth.users'::regclass
                      AND NOT tgisinternal
                ) AS trigger_exists,
                EXISTS (
                    SELECT 1
                    FROM pg_trigger
                    WHERE tgname = 'on_auth_user_created'
                      AND tgrelid = 'auth.users'::regclass
                      AND tgfoid = 'public.handle_new_user()'::regprocedure
                      AND NOT tgisinternal
                ) AS trigger_matches;
        `);

        if (existingTrigger.rows[0].trigger_exists && !existingTrigger.rows[0].trigger_matches) {
            throw new Error('El trigger on_auth_user_created existe pero apunta a otra función.');
        }

        if (!existingTrigger.rows[0].trigger_exists) {
            await this.client.query(`
                CREATE TRIGGER on_auth_user_created
                AFTER INSERT ON auth.users
                FOR EACH ROW
                EXECUTE FUNCTION public.handle_new_user();
            `);
        }
    }
}

// La URI administrativa se entrega desde el entorno y nunca se guarda en el repositorio.
const dbUri = process.env.DATABASE_URL;
if (!dbUri) {
    console.error('Define DATABASE_URL en el entorno antes de inicializar la base de datos.');
    process.exitCode = 1;
} else {
    const dbManager = new DatabaseManager(dbUri);
    dbManager.inicializarEstructura().catch(() => {
        process.exitCode = 1;
    });
}


