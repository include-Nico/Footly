// js/minigames.js

// === MINIGIOCO 1: DRIBBLING IN ATTACCO ===
export function initDribblingModal(userStr, cpuStr, onSuccess, onFail) {
    const modal = document.getElementById('dribble-modal');
    const target = document.getElementById('dribble-target');
    const indicator = document.getElementById('dribble-indicator');
    const btn = document.getElementById('dribble-action-btn');

    let ratio = userStr / (userStr + cpuStr);
    if (isNaN(ratio)) ratio = 0.5;

    let targetWidth = 15 + (ratio * 30); 
    let targetLeft = 50 - (targetWidth / 2);

    target.style.width = targetWidth + '%';
    target.style.left = targetLeft + '%';
    target.style.background = 'var(--accent)';

    modal.classList.add('active');

    let pos = 0;
    let direction = 1;
    let speed = 1.0 + ((1 - ratio) * 3.0); 
    let isAnimating = true;
    let animFrame;

    function animate() {
        if (!isAnimating) return;
        pos += speed * direction;
        if (pos >= 98) { pos = 98; direction = -1; }
        if (pos <= 0) { pos = 0; direction = 1; }
        indicator.style.left = pos + '%';
        animFrame = requestAnimationFrame(animate);
    }
    animFrame = requestAnimationFrame(animate);

    btn.onclick = () => {
        isAnimating = false;
        cancelAnimationFrame(animFrame);
        btn.onclick = null; 

        let indCenter = pos + 1; 
        let isInside = indCenter >= targetLeft && indCenter <= (targetLeft + targetWidth);

        if (isInside) {
            target.style.background = '#00f5a0'; 
            setTimeout(() => { modal.classList.remove('active'); onSuccess(); }, 1200);
        } else {
            target.style.background = '#f05252'; 
            setTimeout(() => { modal.classList.remove('active'); onFail(); }, 1200);
        }
    };
}

// === MINIGIOCO 2: CONTENIMENTO IN DIFESA ===
export function initDefenseModal(userStr, cpuStr, onSuccess, onFailSpeed, onFailFoul) {
    const modal = document.getElementById('defense-modal');
    const safeZone = document.getElementById('def-safe-zone');
    const indicator = document.getElementById('def-indicator');
    const progressBar = document.getElementById('def-progress-fill');
    const btn = document.getElementById('def-press-btn');

    // Calcolo difficoltà
    let ratio = userStr / (userStr + cpuStr);
    if (isNaN(ratio)) ratio = 0.5;

    // La zona sicura (Safe Zone) è larga dal 25% al 45% della barra, centrata
    let safeSize = 25 + (ratio * 20); 
    let safeTop = 50 - (safeSize / 2);
    let safeBottom = safeTop + safeSize;

    safeZone.style.top = safeTop + '%';
    safeZone.style.height = safeSize + '%';

    let pressure = 50; // Parte dal centro
    let progress = 0;
    let isPressing = false;
    let isAnimating = true;
    let animFrame;

    progressBar.style.width = '0%';
    progressBar.style.background = 'var(--notif-info)';
    indicator.style.background = 'white';

    // Logica di Interazione "Hold & Release"
    const pressStart = (e) => { e.preventDefault(); isPressing = true; btn.style.transform = 'scale(0.95)'; };
    const pressEnd = (e) => { e.preventDefault(); isPressing = false; btn.style.transform = 'scale(1)'; };

    btn.addEventListener('mousedown', pressStart);
    btn.addEventListener('touchstart', pressStart, {passive: false});
    window.addEventListener('mouseup', pressEnd);
    window.addEventListener('touchend', pressEnd, {passive: false});

    function cleanup() {
        isAnimating = false;
        cancelAnimationFrame(animFrame);
        btn.removeEventListener('mousedown', pressStart);
        btn.removeEventListener('touchstart', pressStart);
        window.removeEventListener('mouseup', pressEnd);
        window.removeEventListener('touchend', pressEnd);
    }

    function finish(result) {
        cleanup();
        if (result === 'win') {
            progressBar.style.background = '#00f5a0';
            indicator.style.background = '#00f5a0';
            setTimeout(() => { modal.classList.remove('active'); onSuccess(); }, 1200);
        } else if (result === 'speed') {
            indicator.style.background = '#00d4ff'; // Troppo lento
            setTimeout(() => { modal.classList.remove('active'); onFailSpeed(); }, 1200);
        } else if (result === 'foul') {
            indicator.style.background = '#f05252'; // Fallo, barra esplosa
            setTimeout(() => { modal.classList.remove('active'); onFailFoul(); }, 1200);
        }
    }

    modal.classList.add('active');

    let lastTime = performance.now();
    function animate(time) {
        if (!isAnimating) return;
        let dt = time - lastTime;
        lastTime = time;
        
        // La pressione aumenta se tieni premuto, sennò cade per gravità
        if (isPressing) { pressure += 0.35 * (dt / 16); } 
        else { pressure -= 0.35 * (dt / 16); }

        // Sconfitta immediata se tocca i bordi (0 = saltato, 100 = fallo)
        if (pressure >= 100) { pressure = 100; finish('foul'); return; }
        if (pressure <= 0) { pressure = 0; finish('speed'); return; }

        indicator.style.bottom = pressure + '%';

        // Controllo se l'indicatore è dentro la Zona Verde
        let pTop = 100 - pressure; 
        
        if (pTop >= safeTop && pTop <= safeBottom) {
            progress += 0.4 * (dt / 16); // Aumenta il progresso di vittoria
            indicator.style.background = '#00f5a0';
        } else {
            indicator.style.background = 'white';
            progress -= 0.1 * (dt / 16); // Perde progresso lentamente
            if (progress < 0) progress = 0;
        }

        progressBar.style.width = progress + '%';

        // Vittoria!
        if (progress >= 100) {
            progress = 100;
            finish('win');
            return;
        }

        animFrame = requestAnimationFrame(animate);
    }
    animFrame = requestAnimationFrame(animate);
}