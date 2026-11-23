import { supabase, registrarUsuario, iniciarSesion, cerrarSesion, escucharCambiosSesion } from './auth.js';
import { iniciarJuegoMotor, detenerJuego, configurarDificultad } from './game.js';

// Reunimos referencias a las pantallas y etiquetas que vamos a actualizar desde JavaScript.
const loginScreen = document.getElementById('login-screen');
const mainMenu = document.getElementById('main-menu');
const gameScreen = document.getElementById('game-screen');
const lblName = document.getElementById('user-name');
const lblEmail = document.getElementById('user-email');
const lblAvatar = document.getElementById('user-avatar');
const lblRango = document.getElementById('rango-maximo');

const inputEmail = document.getElementById('input-email');
const inputPassword = document.getElementById('input-password');
const inputFullName = document.getElementById('input-full-name');
const inputRegisterEmail = document.getElementById('input-register-email');
const inputRegisterPassword = document.getElementById('input-register-password');
const inputConfirmPassword = document.getElementById('input-confirm-password');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginTab = document.getElementById('tab-login');
const registerTab = document.getElementById('tab-register');
const authError = document.getElementById('auth-error');
const configPanel = document.getElementById('config-panel');
const difficultyEasy = document.getElementById('difficulty-easy');
const difficultyHard = document.getElementById('difficulty-hard');
const configFeedback = document.getElementById('config-feedback');

// Esta referencia permite mostrar el perfil y guardar el récord del jugador conectado.
let currentUser = null;

// Recordamos la dificultad elegida para que siga igual cuando el jugador vuelva al juego.
const CONFIG_STORAGE_KEY = 'snake-game-difficulty';

function cargarDificultadGuardada() {
    try {
        const savedDifficulty = window.localStorage.getItem(CONFIG_STORAGE_KEY);
        if (savedDifficulty === null || savedDifficulty === 'facil') return 'facil';
        if (savedDifficulty === 'dificil') return 'dificil';

        console.warn('[configuración] Valor guardado no reconocido; se usará Fácil.');
        return 'facil';
    } catch (error) {
        console.error('[configuración] No se pudo leer la preferencia guardada:', error);
        return 'facil';
    }
}

let dificultadActual = cargarDificultadGuardada();
configurarDificultad(dificultadActual);

function actualizarOpcionesDificultad() {
    difficultyEasy.checked = dificultadActual === 'facil';
    difficultyHard.checked = dificultadActual === 'dificil';
}

function limpiarMensajeConfiguracion() {
    configFeedback.textContent = '';
    configFeedback.classList.add('hidden');
}

function mostrarMensajeConfiguracion(message, tone = 'success') {
    configFeedback.textContent = message;
    configFeedback.dataset.tone = tone;
    configFeedback.classList.remove('hidden');
}

// Limpiamos el aviso anterior antes de mostrar el siguiente mensaje de autenticación.
function limpiarMensajeAuth() {
    authError.textContent = '';
    authError.classList.add('hidden');
}

// El formulario reutiliza una misma zona para informar errores, progreso o confirmaciones.
function mostrarMensajeAuth(message, tone = 'error') {
    authError.textContent = message;
    authError.dataset.tone = tone;
    authError.classList.remove('hidden');
}

// Cambiamos entre iniciar sesión y crear cuenta sin recargar la página.
function cambiarModoAuth(mode) {
    const isRegister = mode === 'register';
    loginForm.classList.toggle('hidden', isRegister);
    registerForm.classList.toggle('hidden', !isRegister);
    loginTab.classList.toggle('active', !isRegister);
    registerTab.classList.toggle('active', isRegister);
    loginTab.setAttribute('aria-selected', String(!isRegister));
    registerTab.setAttribute('aria-selected', String(isRegister));
    limpiarMensajeAuth();
}

// Las pestañas abren el formulario que corresponde a la acción elegida.
loginTab.addEventListener('click', () => cambiarModoAuth('login'));
registerTab.addEventListener('click', () => cambiarModoAuth('register'));

// Abrimos el panel con la dificultad que ya está activa, no con una selección desactualizada.
document.getElementById('btn-config').addEventListener('click', () => {
    actualizarOpcionesDificultad();
    limpiarMensajeConfiguracion();
    configPanel.classList.remove('hidden');
});

// Cancelar cierra el panel y descarta cualquier selección que todavía no se haya aplicado.
document.getElementById('btn-config-cancel').addEventListener('click', () => {
    actualizarOpcionesDificultad();
    limpiarMensajeConfiguracion();
    configPanel.classList.add('hidden');
});

// Aplicamos Fácil o Difícil, guardamos la preferencia y la usamos en la próxima partida.
document.getElementById('btn-config-apply').addEventListener('click', () => {
    const selectedOption = document.querySelector('input[name="game-difficulty"]:checked');
    if (!selectedOption) {
        mostrarMensajeConfiguracion('Selecciona Fácil o Difícil antes de aplicar.', 'error');
        return;
    }

    if (selectedOption.value !== 'facil' && selectedOption.value !== 'dificil') {
        console.error('[configuración] La opción de dificultad no es válida:', selectedOption.value);
        mostrarMensajeConfiguracion('No reconocimos esa dificultad. Elige una de las dos opciones.', 'error');
        return;
    }

    dificultadActual = selectedOption.value;
    configurarDificultad(dificultadActual);

    try {
        window.localStorage.setItem(CONFIG_STORAGE_KEY, dificultadActual);
        mostrarMensajeConfiguracion('¡Listo! El cambio se aplicará en la próxima partida.');
    } catch (error) {
        console.error('[configuración] No se pudo guardar la preferencia:', error);
        mostrarMensajeConfiguracion(
            'La dificultad se aplicó para esta visita, pero el navegador no pudo guardarla.',
            'error'
        );
    }
});

// En el acceso validamos el formulario y bloqueamos el botón mientras responde Supabase.
loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    inputEmail.value = inputEmail.value.trim();

    if (!loginForm.reportValidity()) return;

    const button = document.getElementById('btn-login');
    button.disabled = true;
    button.textContent = 'Ingresando...';
    limpiarMensajeAuth();

    try {
        const { error } = await iniciarSesion(inputEmail.value, inputPassword.value);
        if (error) {
            mostrarMensajeAuth(`No se pudo iniciar sesión: ${error.message}`);
            console.error('[login] error:', error);
        }
    } catch (error) {
        mostrarMensajeAuth('No fue posible conectar. Inténtalo de nuevo.');
        console.error('[login] error inesperado:', error);
    } finally {
        button.disabled = false;
        button.innerHTML = 'Entrar a jugar <span aria-hidden="true">→</span>';
    }
});

// En el registro validamos los datos y la confirmación antes de llamar a Auth.
registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    inputFullName.value = inputFullName.value.trim();
    inputRegisterEmail.value = inputRegisterEmail.value.trim();

    if (!registerForm.reportValidity()) return;

    if (inputRegisterPassword.value !== inputConfirmPassword.value) {
        mostrarMensajeAuth('Las contraseñas no coinciden. Revísalas e inténtalo de nuevo.');
        inputConfirmPassword.focus();
        return;
    }

    const button = document.getElementById('btn-register');
    button.disabled = true;
    mostrarMensajeAuth('Estamos preparando tu cuenta...', 'info');

    try {
        const { data, error } = await registrarUsuario(
            inputRegisterEmail.value,
            inputRegisterPassword.value,
            inputFullName.value
        );

        if (error) {
            mostrarMensajeAuth(`No se pudo crear la cuenta: ${error.message}`);
            console.error('[registro] error:', error);
        } else if (data && data.session) {
            mostrarMensajeAuth('¡Cuenta creada! Ya puedes empezar a jugar.', 'success');
        } else {
            mostrarMensajeAuth('Cuenta creada. Revisa tu correo para confirmar la cuenta antes de iniciar sesión.', 'info');
        }
    } catch (error) {
        mostrarMensajeAuth('No fue posible conectar. Inténtalo de nuevo.');
        console.error('[registro] error inesperado:', error);
    } finally {
        button.disabled = false;
        button.innerHTML = 'Crear mi cuenta <span aria-hidden="true">→</span>';
    }
});

// El cierre de sesión lo resuelve Supabase; el listener actualiza la pantalla después.
document.getElementById('btn-logout').addEventListener('click', async () => {
    await cerrarSesion();
});

// Al comenzar, ocultamos el menú y entregamos al motor la función que guardará el récord.
document.getElementById('btn-jugar').addEventListener('click', () => {
    mainMenu.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    configurarDificultad(dificultadActual);
    iniciarJuegoMotor(registrarPuntajeFinal);
});

// Al volver, detenemos el juego y refrescamos el récord del usuario actual.
document.getElementById('btn-volver-menu').addEventListener('click', () => {
    detenerJuego();
    gameScreen.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    if (currentUser) {
        obtenerDatosJugador(currentUser.id);
    }
});

// Este listener centraliza el paso entre usuario conectado y visitante sin sesión.
escucharCambiosSesion((user) => {
    if (user) {
        currentUser = user;
        loginScreen.classList.add('hidden');
        mainMenu.classList.remove('hidden');

        const fullName = user.user_metadata && typeof user.user_metadata.full_name === 'string'
            ? user.user_metadata.full_name.trim()
            : '';
        const displayName = fullName || user.email || 'Jugador';
        lblName.innerText = displayName;
        lblAvatar.innerText = displayName.charAt(0).toLocaleUpperCase();
        lblEmail.innerText = user.email || '';
        obtenerDatosJugador(user.id);
    } else {
        currentUser = null;
        loginScreen.classList.remove('hidden');
        mainMenu.classList.add('hidden');
        gameScreen.classList.add('hidden');
        detenerJuego();

        loginForm.reset();
        registerForm.reset();
        cambiarModoAuth('login');
    }
});

// Leemos únicamente el récord asociado al identificador autenticado del jugador.
async function obtenerDatosJugador(userId) {
    const { data, error } = await supabase
        .from('jugadores')
        .select('rango_maximo')
        .eq('id', userId)
        .single();

    if (data) {
        lblRango.innerText = data.rango_maximo;
    } else if (error) {
        console.error('[obtenerDatosJugador] error:', error);
    }
}

// Solo enviamos una actualización cuando la partida supera el máximo ya guardado.
export async function registrarPuntajeFinal(scoreFinal) {
    if (!currentUser) return;

    const rangoActual = parseInt(lblRango.innerText, 10) || 0;

    if (scoreFinal > rangoActual) {
        const { error } = await supabase
            .from('jugadores')
            .update({ rango_maximo: scoreFinal })
            .eq('id', currentUser.id);

        if (!error) {
            lblRango.innerText = scoreFinal;
            console.log('¡Nuevo rango máximo registrado!');
        } else {
            console.error('[registrarPuntajeFinal] error:', error);
        }
    }
}
