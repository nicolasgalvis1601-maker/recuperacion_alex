document.addEventListener("DOMContentLoaded", () => {
  const TOTAL_LEVELS = 10;

  // Nivel hasta el que se ha llegado (por defecto 1). Se guarda en
  // localStorage desde completeLevel() cada vez que se resuelve un reto.
  // Ya no se usa para bloquear niveles, solo para marcar cuáles están
  // completados en el mapa de niveles.
  const unlockedLevel = parseInt(localStorage.getItem("pacman_max_level"), 10) || 1;

  let completedCount = 0;

  for (let i = 1; i <= TOTAL_LEVELS; i++) {
    const levelCard = document.getElementById(`level-${i}`);
    if (!levelCard) continue; // Esta sección solo existe en index.html

    const statusSpan = levelCard.querySelector(".level-status");

    // Todos los niveles son jugables en cualquier orden: no se toca el
    // href original (ya viene correcto desde el HTML).
    levelCard.classList.add("unlocked");

    if (i < unlockedLevel) {
      // Nivel ya resuelto en una sesión anterior
      levelCard.classList.add("completed");
      if (statusSpan) statusSpan.textContent = "COMPLETADO";
      completedCount++;
    } else {
      levelCard.classList.remove("completed");
      if (statusSpan) statusSpan.textContent = "DISPONIBLE";
    }
  }

  const progressEl = document.getElementById("progressIndicator");
  if (progressEl) {
    progressEl.textContent = `${completedCount} / ${TOTAL_LEVELS} NIVELES COMPLETADOS`;
  }

  // ---------------------------------------------------------------
  // Auto-resolución y paso automático al siguiente nivel
  // ---------------------------------------------------------------
  // Segundos que se muestra el mensaje de éxito antes de cambiar de nivel.
  const AUTO_NEXT_DELAY_SECONDS = 2;

  // Segundos sin resolver el nivel antes de mostrar la pista (LEVEL_HINT).
  const HINT_DELAY_SECONDS = 30;

  // Número del nivel actual, sacado del nombre del archivo (nivel_3_...).
  // En index.html no hay coincidencia, así que vale null.
  const levelMatch = window.location.pathname.match(/nivel_(\d+)_/);
  const currentLevel = levelMatch ? parseInt(levelMatch[1], 10) : null;

  let levelSolved = false;
  let countdownTimer = null;
  let countdownInfo = null;

  function getCountdownInfo() {
    if (!countdownInfo) {
      countdownInfo = document.createElement("div");
      countdownInfo.className = "auto-next-info";
      const msgBox = document.getElementById("msgBox");
      if (msgBox) msgBox.insertAdjacentElement("afterend", countdownInfo);
    }
    return countdownInfo;
  }

  // ---- Pista tras HINT_DELAY_SECONDS sin resolver ----
  let hintBox = null;
  let hintTimer = null;
  let hintDue = false; // ya pasaron HINT_DELAY_SECONDS sin resolver

  function showHint() {
    if (typeof LEVEL_HINT === "undefined" || levelSolved) return;
    if (!hintBox) {
      hintBox = document.createElement("div");
      hintBox.className = "hint-box";
      hintBox.setAttribute("role", "status");
      const msgBox = document.getElementById("msgBox");
      if (msgBox) msgBox.insertAdjacentElement("beforebegin", hintBox);
    }
    hintBox.textContent = "💡 PISTA: " + LEVEL_HINT;
    hintBox.style.display = "block";
  }

  function hideHint() {
    if (hintBox) hintBox.style.display = "none";
  }

  // Solo en páginas de nivel (las que definen LEVEL_HINT), no en index.html.
  if (currentLevel && typeof LEVEL_HINT !== "undefined") {
    hintTimer = setTimeout(() => {
      hintDue = true;
      showHint();
    }, HINT_DELAY_SECONDS * 1000);
  }

  function startCountdownToNextLevel() {
    // El último nivel no tiene "siguiente": se queda en pantalla con su botón final.
    if (!currentLevel || currentLevel >= TOTAL_LEVELS) return;

    const nextLink =
      document.getElementById("btnNext") || document.getElementById("btnRestart");
    if (!nextLink) return;

    let remaining = AUTO_NEXT_DELAY_SECONDS;
    const info = getCountdownInfo();
    info.textContent = `➔ SIGUIENTE NIVEL EN ${remaining}...`;

    countdownTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        window.location.href = nextLink.href;
      } else {
        info.textContent = `➔ SIGUIENTE NIVEL EN ${remaining}...`;
      }
    }, 1000);
  }

  // Si el jugador cambia la respuesta mientras corre la cuenta regresiva,
  // se cancela el avance y el nivel vuelve a quedar pendiente.
  function cancelSolvedState() {
    levelSolved = false;
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (countdownInfo) countdownInfo.textContent = "";

    const badge = document.getElementById("statusBadge");
    const msgBox = document.getElementById("msgBox");
    const nextBtn =
      document.getElementById("btnNext") || document.getElementById("btnRestart");
    if (badge) {
      badge.className = "status-badge";
      badge.innerText = "PENDIENTE";
    }
    if (msgBox) {
      msgBox.className = "message-box";
      msgBox.innerText = "";
    }
    if (nextBtn) nextBtn.classList.remove("visible");
    if (hintDue) showHint();
  }

  // Se llama en cada tecla: si la respuesta ya es correcta, ejecuta el
  // código solo (mensaje de éxito, sonido, progreso) y programa el avance.
  function autoCheck() {
    if (typeof isSolved !== "function" || typeof executeCode !== "function") return;

    if (isSolved()) {
      if (levelSolved) return;
      levelSolved = true;
      hideHint();
      executeCode();
      startCountdownToNextLevel();
    } else if (levelSolved) {
      cancelSolvedState();
    }
  }

  // Cablea los campos de código de la página de nivel actual (no hace
  // nada en index.html, que no tiene inputs .code-input).
  document.querySelectorAll(".code-input").forEach((input) => {
    // Enter ejecuta el código, igual que el botón "EJECUTAR CÓDIGO"
    // (útil para ver el mensaje de error si la respuesta aún no es correcta).
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && typeof executeCode === "function") {
        e.preventDefault();
        if (!levelSolved) executeCode();
      }
    });

    // Mientras se escribe: vista previa en vivo + comprobación automática.
    // Ya no hace falta pulsar "EJECUTAR CÓDIGO" cuando la respuesta es correcta.
    input.addEventListener("input", () => {
      if (typeof livePreview === "function") livePreview();
      autoCheck();
    });
  });

  if (typeof livePreview === "function") {
    livePreview();
  }

  // ---------------------------------------------------------------
  // Etiqueta con las medidas (px) del recuadro donde está Pac-Man
  // ---------------------------------------------------------------
  const style = document.createElement("style");
  style.textContent = `
    .size-badge {
      position: absolute;
      right: 8px;
      bottom: 6px;
      z-index: 1000;
      pointer-events: none;
      font-family: 'Press Start 2P', monospace;
      font-size: 0.5rem;
      color: #00ffff;
      background: rgba(0, 0, 0, 0.75);
      border: 1px solid #1919a6;
      border-radius: 4px;
      padding: 4px 6px;
    }
    .size-badge.on-top { bottom: auto; top: 6px; }
    .size-wrapper { position: relative; width: 100%; }
    .hint-box {
      display: none;
      font-family: 'Press Start 2P', monospace;
      font-size: 0.6rem;
      line-height: 1.7;
      color: #ffff00;
      background: rgba(255, 255, 0, 0.06);
      border: 2px dashed #ffff00;
      border-radius: 6px;
      padding: 12px;
      animation: hint-in 0.4s ease;
    }
    @keyframes hint-in {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .auto-next-info {
      font-family: 'Press Start 2P', monospace;
      font-size: 0.6rem;
      color: #00ffff;
      min-height: 16px;
    }
  `;
  document.head.appendChild(style);

  document
    .querySelectorAll(".maze-container, .horizontal-scroll-container")
    .forEach((box) => {
      const badge = document.createElement("div");
      badge.className = "size-badge";

      if (getComputedStyle(box).overflowX === "auto") {
        // Un contenedor con scroll movería la etiqueta al desplazarse,
        // así que se envuelve en un div fijo y la etiqueta va sobre el wrapper.
        const wrapper = document.createElement("div");
        wrapper.className = "size-wrapper";
        box.parentNode.insertBefore(wrapper, box);
        wrapper.appendChild(box);
        badge.classList.add("on-top");
        wrapper.appendChild(badge);
      } else {
        box.appendChild(badge);
      }

      // offsetWidth/offsetHeight = tamaño total del recuadro (borde incluido),
      // el mismo que se ve en las herramientas de desarrollo.
      const updateSize = () => {
        badge.textContent = `${box.offsetWidth}px × ${box.offsetHeight}px`;
      };
      updateSize();
      if (typeof ResizeObserver === "function") {
        new ResizeObserver(updateSize).observe(box);
      } else {
        window.addEventListener("resize", updateSize);
      }
    });

  // ---------------------------------------------------------------
  // Pac-Man no puede salir del recuadro
  // ---------------------------------------------------------------
  // Da igual qué valores escriba el jugador (left: 5000px, top: -300px...):
  // si Pac-Man se saliera, se le aplica un "translate" que lo deja pegado
  // a la pared del recuadro. Los valores del editor no se tocan.
  const pacmanEl = document.getElementById("pacman");
  const mazeEl = document.querySelector(".maze-container");

  if (pacmanEl && mazeEl && mazeEl.contains(pacmanEl) && "translate" in pacmanEl.style) {
    const keepPacmanInside = () => {
      // Mientras Pac-Man se anima no se puede medir su destino, así que se usa
      // una copia invisible, sin animación ni corrección, que recibe los mismos
      // estilos (mismo id y mismo style en línea) y se mide al instante.
      const probe = pacmanEl.cloneNode(true);
      probe.style.transition = "none";
      probe.style.translate = "none";
      probe.style.visibility = "hidden";
      probe.style.pointerEvents = "none";
      pacmanEl.parentNode.insertBefore(probe, pacmanEl);
      const target = probe.getBoundingClientRect();
      probe.remove();

      // Zona jugable: el interior del recuadro (sin contar el borde).
      const box = mazeEl.getBoundingClientRect();
      const left = box.left + mazeEl.clientLeft;
      const top = box.top + mazeEl.clientTop;
      const right = left + mazeEl.clientWidth;
      const bottom = top + mazeEl.clientHeight;

      let dx = 0;
      let dy = 0;
      if (target.right > right) dx = right - target.right;
      if (target.left + dx < left) dx = left - target.left;
      if (target.bottom > bottom) dy = bottom - target.bottom;
      if (target.top + dy < top) dy = top - target.top;

      const correction = dx || dy ? `${dx}px ${dy}px` : "";
      if (pacmanEl.style.translate !== correction) {
        pacmanEl.style.translate = correction;
      }
    };

    // Cada vez que cambia el style de Pac-Man (al escribir, al ejecutar el
    // código o al resolver el reto) se vuelve a comprobar.
    new MutationObserver(keepPacmanInside).observe(pacmanEl, {
      attributes: true,
      attributeFilter: ["style"],
    });

    // Y también si el recuadro cambia de tamaño (ventana más pequeña, móvil...).
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(keepPacmanInside).observe(mazeEl);
    } else {
      window.addEventListener("resize", keepPacmanInside);
    }

    keepPacmanInside();
  }
});

// Se llama desde cada página de nivel al resolver el reto correctamente
// (ver executeCode() en cada nivel_*.html). Guarda el progreso para que
// el mapa de niveles en index.html lo recuerde la próxima vez.
function completeLevel(currentLevel) {
  const nextLevel = currentLevel + 1;
  const currentMax = parseInt(localStorage.getItem("pacman_max_level"), 10) || 1;

  if (nextLevel > currentMax) {
    localStorage.setItem("pacman_max_level", nextLevel);
  }
}
