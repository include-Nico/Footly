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

// === MINIGIOCO 2: CONTENIMENTO IN DIFESA (SOPRAVVIVENZA A TEMPO CON TAP) ===
export function initDefenseModal(userStr, cpuStr, onSuccess, onFailSpeed, onFailFoul) {
    const modal = document.getElementById('defense-modal');
    const safeZone = document.getElementById('def-safe-zone');
    const indicator = document.getElementById('def-indicator');
    const progressBar = document.getElementById('def-progress-fill');
    const btn = document.getElementById('def-press-btn');

    let ratio = userStr / (userStr + cpuStr);
    if (isNaN(ratio)) ratio = 0.5;

    // La zona sicura
    let safeSize = 20 + (ratio * 25);
    let safeTop = 50 - (safeSize / 2);
    let safeBottom = safeTop + safeSize;

    safeZone.style.top = safeTop + '%';
    safeZone.style.height = safeSize + '%';

    let pressure = 50; 
    let isAnimating = true;
    let animFrame;

    let gravity = 0.02 + ((1 - ratio) * 0.035); 
    let tapBoost = 7 + (ratio * 4); 

    // Timer della Sopravvivenza (4 Secondi in cui resistere)
    let totalTime = 4000; 
    let timeLeft = totalTime;

    progressBar.style.width = '100%';
    progressBar.style.background = 'var(--gold)';
    indicator.style.background = 'white';

    const handleTap = (e) => {
        e.preventDefault(); 
        if(!isAnimating) return;
        pressure += tapBoost;
        btn.style.transform = 'scale(0.92)';
        setTimeout(() => { if(isAnimating) btn.style.transform = 'scale(1)'; }, 50);
    };

    btn.addEventListener('mousedown', handleTap);
    btn.addEventListener('touchstart', handleTap, {passive: false});

    function cleanup() {
        isAnimating = false;
        cancelAnimationFrame(animFrame);
        btn.removeEventListener('mousedown', handleTap);
        btn.removeEventListener('touchstart', handleTap);
        btn.style.transform = 'scale(1)';
    }

    function finish(result) {
        cleanup();
        if (result === 'win') {
            indicator.style.background = '#00f5a0';
            progressBar.style.background = '#00f5a0';
            setTimeout(() => { modal.classList.remove('active'); onSuccess(); }, 1200);
        } else if (result === 'speed') {
            indicator.style.background = '#00d4ff'; 
            progressBar.style.background = '#00d4ff';
            setTimeout(() => { modal.classList.remove('active'); onFailSpeed(); }, 1200);
        } else if (result === 'foul') {
            indicator.style.background = '#f05252'; 
            progressBar.style.background = '#f05252';
            setTimeout(() => { modal.classList.remove('active'); onFailFoul(); }, 1200);
        }
    }

    modal.classList.add('active');

    let lastTime = performance.now();
    function animate(time) {
        if (!isAnimating) return;
        let dt = time - lastTime;
        lastTime = time;

        // La gravità lo fa scendere, il tempo scorre
        pressure -= gravity * dt;
        timeLeft -= dt;

        // Aggiorna il Timer visivo in basso
        let timePercent = Math.max(0, (timeLeft / totalTime) * 100);
        progressBar.style.width = timePercent + '%';

        // Sconfitta immediata se sbatte sui bordi prima che scada il tempo!
        if (pressure >= 100) { pressure = 100; indicator.style.bottom = '100%'; finish('foul'); return; }
        if (pressure <= 0) { pressure = 0; indicator.style.bottom = '0%'; finish('speed'); return; }

        indicator.style.bottom = pressure + '%';

        // Controlla se sei nella zona verde (solo effetto visivo)
        let pTop = 100 - pressure; 
        let inZone = (pTop >= safeTop && pTop <= safeBottom);
        indicator.style.background = inZone ? '#00f5a0' : 'white';

        // Se il tempo è scaduto, si giudica la posizione dell'indicatore
        if (timeLeft <= 0) {
            if (inZone) finish('win'); // Hai temporeggiato con successo!
            else finish('speed'); // Eri sbilanciato, l'attaccante scappa
            return;
        }

        animFrame = requestAnimationFrame(animate);
    }
    animFrame = requestAnimationFrame(animate);
}