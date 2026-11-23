// El Canvas y estas etiquetas son el puente entre el motor y lo que ve el jugador.
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameOverModal = document.getElementById('game-over-modal');
const lblScoreActual = document.getElementById('score-actual');
const lblPuntajeFinal = document.getElementById('puntaje-final');

// El estado de la partida vive aquí: cuerpo, ratón, dirección, puntaje y reloj del juego.
let snake = [];
let raton = {};
let dx = 0;
let dy = 0;
let score = 0;
let gameInterval = null;
const gridSize = 20;
let dificultadActual = 'facil';

let onGameOverCallback = null;

// La dificultad guarda el intervalo que se usará cuando arranque o se reinicie la partida.
export function configurarDificultad(dificultad) {
    if (dificultad !== 'facil' && dificultad !== 'dificil') {
        throw new TypeError('La dificultad debe ser "facil" o "dificil".');
    }

    dificultadActual = dificultad;
}

// Preparamos una partida nueva con tres segmentos y arrancamos su actualización periódica.
export function iniciarJuegoMotor(callback) {
    if (typeof callback === 'function') {
        onGameOverCallback = callback;
    }

    snake = [
        { x: 160, y: 160 },
        { x: 140, y: 160 },
        { x: 120, y: 160 }
    ];
    dx = gridSize;
    dy = 0;
    score = 0;
    lblScoreActual.innerText = score;
    gameOverModal.classList.add('hidden');

    generarRaton();
    dibujarFrame();
    detenerJuego();
    const intervaloMs = dificultadActual === 'dificil' ? 75 : 150;
    gameInterval = setInterval(actualizarJuego, intervaloMs);
}

// Detenemos el reloj para que no queden partidas ejecutándose en segundo plano.
export function detenerJuego() {
    if (gameInterval !== null) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
}

// Elegimos una casilla libre para el ratón; si coincide con la serpiente, volvemos a sortear.
function generarRaton() {
    raton = {
        x: Math.floor(Math.random() * (canvas.width / gridSize)) * gridSize,
        y: Math.floor(Math.random() * (canvas.height / gridSize)) * gridSize
    };
    if (snake.some(segmento => segmento.x === raton.x && segmento.y === raton.y)) {
        generarRaton();
    }
}

// Cada pulso mueve la cabeza, comprueba choques y decide si la serpiente crece.
function actualizarJuego() {
    const cabeza = { x: snake[0].x + dx, y: snake[0].y + dy };

    if (cabeza.x < 0 || cabeza.x >= canvas.width ||
        cabeza.y < 0 || cabeza.y >= canvas.height ||
        colisionCuerpo(cabeza)) {
        manejarGameOver();
        return;
    }

    snake.unshift(cabeza);

    if (cabeza.x === raton.x && cabeza.y === raton.y) {
        score += 10;
        lblScoreActual.innerText = score;
        generarRaton();
    } else {
        snake.pop();
    }

    dibujarFrame();
}

// Revisamos si la nueva cabeza ocuparía una casilla ya tomada por el cuerpo.
function colisionCuerpo(cabeza) {
    return snake.some(segmento => segmento.x === cabeza.x && segmento.y === cabeza.y);
}

// Redibujamos las capas visuales en orden: suelo, ratón y serpiente.
function dibujarFrame() {
    dibujarTablero();
    dibujarRaton();
    dibujarSerpiente();
}

// El patrón alternado ayuda a distinguir las casillas de la cuadrícula.
function dibujarTablero() {
    const columnas = canvas.width / gridSize;
    const filas = canvas.height / gridSize;

    for (let fila = 0; fila < filas; fila += 1) {
        for (let columna = 0; columna < columnas; columna += 1) {
            ctx.fillStyle = (fila + columna) % 2 === 0 ? '#a8e65a' : '#9ddd4e';
            ctx.fillRect(columna * gridSize, fila * gridSize, gridSize, gridSize);
        }
    }
}

// Dibujamos el ratón con formas de Canvas, sin depender de una imagen externa.
function dibujarRaton() {
    const centroX = raton.x + gridSize / 2;
    const centroY = raton.y + gridSize / 2;

    ctx.save();

    ctx.beginPath();
    ctx.moveTo(centroX - 4, centroY + 1);
    ctx.quadraticCurveTo(centroX - 11, centroY - 2, centroX - 9, centroY + 6);
    ctx.strokeStyle = '#9b5b51';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(centroX - 1, centroY + 2, 5.2, 3.8, -0.15, 0, Math.PI * 2);
    ctx.fillStyle = '#d7d0c8';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centroX + 4, centroY - 1, 3.7, 0, Math.PI * 2);
    ctx.fillStyle = '#e9e1d7';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centroX + 2, centroY - 5, 1.8, 0, Math.PI * 2);
    ctx.arc(centroX + 6, centroY - 4.5, 1.7, 0, Math.PI * 2);
    ctx.fillStyle = '#e98991';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centroX + 5.3, centroY - 1.7, 0.75, 0, Math.PI * 2);
    ctx.fillStyle = '#332c2c';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(centroX + 7.2, centroY + 0.4, 1.05, 0, Math.PI * 2);
    ctx.fillStyle = '#ef7584';
    ctx.fill();

    ctx.restore();
}

// Pintamos primero el cuerpo y al final la cabeza, que también lleva los ojos.
function dibujarSerpiente() {
    for (let i = snake.length - 1; i >= 1; i -= 1) {
        const segmento = snake[i];
        const inset = 1.5;
        dibujarRectanguloRedondeado(
            segmento.x + inset,
            segmento.y + inset,
            gridSize - inset * 2,
            gridSize - inset * 2,
            6,
            i % 2 === 0 ? '#3479ec' : '#2868df'
        );
    }

    const cabeza = snake[0];
    dibujarRectanguloRedondeado(cabeza.x + 0.5, cabeza.y + 0.5, gridSize - 1, gridSize - 1, 7, '#2769df');
    dibujarOjos(cabeza);
}

// Esta utilidad da bordes suaves a cada segmento de la serpiente.
function dibujarRectanguloRedondeado(x, y, width, height, radius, color) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

// Orientamos los ojos y la mirada según la dirección actual del movimiento.
function dibujarOjos(cabeza) {
    let ojos;
    let miradaX = 0;
    let miradaY = 0;

    if (dx > 0) {
        ojos = [{ x: cabeza.x + 14, y: cabeza.y + 5.5 }, { x: cabeza.x + 14, y: cabeza.y + 14.5 }];
        miradaX = 1;
    } else if (dx < 0) {
        ojos = [{ x: cabeza.x + 6, y: cabeza.y + 5.5 }, { x: cabeza.x + 6, y: cabeza.y + 14.5 }];
        miradaX = -1;
    } else if (dy > 0) {
        ojos = [{ x: cabeza.x + 5.5, y: cabeza.y + 14 }, { x: cabeza.x + 14.5, y: cabeza.y + 14 }];
        miradaY = 1;
    } else {
        ojos = [{ x: cabeza.x + 5.5, y: cabeza.y + 6 }, { x: cabeza.x + 14.5, y: cabeza.y + 6 }];
        miradaY = -1;
    }

    ojos.forEach((ojo) => {
        ctx.beginPath();
        ctx.arc(ojo.x, ojo.y, 3.1, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(ojo.x + miradaX, ojo.y + miradaY, 1.45, 0, Math.PI * 2);
        ctx.fillStyle = '#183b69';
        ctx.fill();
    });
}

// Cerramos la partida, mostramos el resultado y avisamos para guardar el récord.
function manejarGameOver() {
    detenerJuego();
    lblPuntajeFinal.innerText = score;
    gameOverModal.classList.remove('hidden');
    if (onGameOverCallback) onGameOverCallback(score);
}

// Las flechas cambian la dirección; no permitimos girar directamente hacia el propio cuerpo.
document.addEventListener('keydown', (event) => {
    if (gameInterval === null) return;

    let handled = true;
    if (event.key === 'ArrowUp' && dy === 0) { dx = 0; dy = -gridSize; }
    else if (event.key === 'ArrowDown' && dy === 0) { dx = 0; dy = gridSize; }
    else if (event.key === 'ArrowLeft' && dx === 0) { dx = -gridSize; dy = 0; }
    else if (event.key === 'ArrowRight' && dx === 0) { dx = gridSize; dy = 0; }
    else handled = false;

    if (handled) event.preventDefault();
});

// El botón del modal vuelve a inicializar el estado del juego desde cero.
document.getElementById('btn-reinicio').addEventListener('click', () => {
    iniciarJuegoMotor();
});
