// js/minigames.js
export function initDribblingModal(userStr, cpuStr, onSuccess, onFail) {
    const modal = document.getElementById('dribble-modal');
    const target = document.getElementById('dribble-target');
    const indicator = document.getElementById('dribble-indicator');
    const btn = document.getElementById('dribble-action-btn');

    let ratio = userStr / (userStr + cpuStr);
    if (isNaN(ratio)) ratio = 0.5;

    // Difficoltà Dinamica: L'area verde va dal 15% (molto difficile) al 45% (facile) dello schermo
    let targetWidth = 15 + (ratio * 30); 
    let targetLeft = 50 - (targetWidth / 2);

    target.style.width = targetWidth + '%';
    target.style.left = targetLeft + '%';
    target.style.background = 'var(--accent)';

    modal.classList.add('active');

    let pos = 0;
    let direction = 1;
    // Velocità Dinamica: L'indicatore va veloce se l'avversario è forte, lento se sei più forte tu
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
        btn.onclick = null; // Rimuove il listener per evitare doppi click

        let indCenter = pos + 1; // Centro approssimativo dell'indicatore
        let isInside = indCenter >= targetLeft && indCenter <= (targetLeft + targetWidth);

        if (isInside) {
            target.style.background = '#00f5a0'; // Diventa verde acceso (Vittoria)
            setTimeout(() => { modal.classList.remove('active'); onSuccess(); }, 1200);
        } else {
            target.style.background = '#f05252'; // Diventa rosso (Sconfitta)
            setTimeout(() => { modal.classList.remove('active'); onFail(); }, 1200);
        }
    };
}