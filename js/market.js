// js/market.js
import { gameState, saveGame } from './state.js';
import { showNotification, showConfirm, updateDashboardHeader } from './ui.js';
import { generatePlayer, generateRandomNameByNation } from './players.js';

export function checkMarketNotifications() {
    let hasOffers = false;
    if(gameState.userTeam.players) {
        hasOffers = gameState.userTeam.players.some(p => p.isListed && p.offers && p.offers.length > 0);
    }
    let navIcon = document.querySelector('.nav-item[data-target="market"]');
    if (navIcon) {
        let dot = navIcon.querySelector('.market-notif-dot');
        if (hasOffers) {
            if (!dot) {
                navIcon.style.position = 'relative';
                navIcon.innerHTML += `<div class="market-notif-dot" style="position:absolute; top:2px; right:10px; width:10px; height:10px; background:var(--notif-error); border-radius:50%; box-shadow:0 0 5px var(--notif-error);"></div>`;
            }
        } else if (dot) { dot.remove(); }
    }
}

export function renderMarket() {
    const searchBtn = document.getElementById('market-search-btn');
    const resultsContainer = document.getElementById('market-results');
    const tabSearch = document.getElementById('tab-market-search');
    const tabTransfer = document.getElementById('tab-market-transfer');
    const searchView = document.getElementById('market-search-view');
    const transferView = document.getElementById('market-transfer-view');
    
    let hasOffers = gameState.userTeam.players.some(p => p.isListed && p.offers && p.offers.length > 0);
    const transferBadge = document.getElementById('transfer-notif-badge');
    if (transferBadge) transferBadge.style.display = hasOffers ? 'block' : 'none';

    if (tabSearch && tabTransfer) {
        tabSearch.onclick = () => {
            tabSearch.style.borderColor = "var(--accent)"; tabSearch.style.color = "var(--accent)";
            tabTransfer.style.borderColor = "var(--border-dim)"; tabTransfer.style.color = "white";
            searchView.style.display = 'flex'; transferView.style.display = 'none';
        };
        tabTransfer.onclick = () => {
            tabTransfer.style.borderColor = "var(--accent)"; tabTransfer.style.color = "var(--accent)";
            tabSearch.style.borderColor = "var(--border-dim)"; tabSearch.style.color = "white";
            searchView.style.display = 'none'; transferView.style.display = 'flex';
            renderTransferList();
        };
    }

    function renderTransferList() {
        const c = document.getElementById('transfer-list-container'); c.innerHTML = '';
        let listedPlayers = gameState.userTeam.players.filter(p => p.isListed);
        if (listedPlayers.length === 0) {
            c.innerHTML = `<div style="text-align:center; color:var(--text-hint); font-size:12px; margin-top:20px;">Non hai giocatori in vendita.<br>Vai nella schermata Rosa per aggiungere giocatori alla lista trasferimenti.</div>`; return;
        }

        listedPlayers.forEach(p => {
            let offerHtml = `<div style="color:var(--text-hint); font-size:11px; margin-top:8px;">Nessuna offerta. Attendi le prossime giornate...</div>`;
            if (p.offers && p.offers.length > 0) {
                let off = p.offers[0];
                offerHtml = `
                    <div style="background:rgba(0,245,160,0.1); border:1px solid var(--accent); border-radius:4px; padding:10px; margin-top:10px;">
                        <div style="font-size:11px; color:var(--text-hint); margin-bottom:4px;">Offerta da: <b>${off.teamName}</b></div>
                        <div style="font-size:18px; font-weight:bold; color:var(--gold); margin-bottom:10px;">💰 ${off.amount.toLocaleString()}</div>
                        <div style="display:flex; gap:5px;">
                            <button class="glass-btn btn-accept-offer" data-id="${p.id}" style="flex:1; border-color:var(--accent); color:var(--accent); font-size:11px; padding:6px;"><i class="fas fa-check"></i> Accetta</button>
                            <button class="glass-btn btn-nego-offer" data-id="${p.id}" style="flex:1; border-color:var(--notif-info); color:var(--notif-info); font-size:11px; padding:6px;"><i class="fas fa-comments"></i> Tratta</button>
                            <button class="glass-btn btn-reject-offer" data-id="${p.id}" style="flex:1; border-color:var(--notif-error); color:var(--notif-error); font-size:11px; padding:6px;"><i class="fas fa-xmark"></i> Rifiuta</button>
                        </div>
                    </div>
                `;
            }
            c.innerHTML += `<div class="glass-panel" style="padding:15px;"><div style="display:flex; align-items:center; gap:12px;"><div class="card-overall" style="color:${p.color}; font-size:22px;">${p.overall}</div><div><div style="font-weight:bold; font-size:14px; color:var(--text-primary);">${p.name}</div><div style="font-size:10px; color:var(--text-muted);">${p.position} · Valore: 💰 ${(p.value || p.overall * 100).toLocaleString()}</div></div></div>${offerHtml}</div>`;
        });

        document.querySelectorAll('.btn-accept-offer').forEach(btn => { btn.onclick = (e) => {
            let pId = e.currentTarget.getAttribute('data-id'); let player = gameState.userTeam.players.find(x => x.id === pId); let off = player.offers[0];
            showConfirm("Accetta Offerta", `Vuoi vendere ${player.name} al ${off.teamName} per 💰${off.amount.toLocaleString()}?`, () => { executeTransfer(player, off); });
        };});

        document.querySelectorAll('.btn-reject-offer').forEach(btn => { btn.onclick = (e) => {
            let pId = e.currentTarget.getAttribute('data-id'); let player = gameState.userTeam.players.find(x => x.id === pId);
            player.offers = []; saveGame(); renderTransferList(); checkMarketNotifications(); showNotification("Offerta Rifiutata", "Attendi nuove offerte in futuro.", "info");
        };});

        document.querySelectorAll('.btn-nego-offer').forEach(btn => { btn.onclick = (e) => {
            let pId = e.currentTarget.getAttribute('data-id'); let player = gameState.userTeam.players.find(x => x.id === pId); let off = player.offers[0];
            let reqPrice = prompt(`Controproposta per ${player.name} al ${off.teamName}.\nOfferta attuale: ${off.amount.toLocaleString()}\nInserisci la nuova richiesta (es. ${Math.floor(off.amount * 1.1)}):`, off.amount);
            if (reqPrice !== null) {
                reqPrice = parseInt(reqPrice.replace(/\D/g, '')); if (isNaN(reqPrice) || reqPrice <= 0) return;
                let multiplier = reqPrice / off.amount; let acceptChance = 0;
                if (multiplier <= 1.05) acceptChance = 0.90; else if (multiplier <= 1.15) acceptChance = 0.60; else if (multiplier <= 1.25) acceptChance = 0.30; else acceptChance = 0.05;
                if (Math.random() < acceptChance) {
                    off.amount = reqPrice; 
                    showConfirm("Affare Fatto!", `Il ${off.teamName} ha accettato la tua controproposta di 💰${reqPrice.toLocaleString()}!`, () => { executeTransfer(player, off); }, "Vendi", false, true);
                } else {
                    player.offers = []; saveGame(); renderTransferList(); checkMarketNotifications(); showNotification("Trattativa Saltata", `Il ${off.teamName} ha ritenuto la richiesta eccessiva e si è ritirato.`, "error", 4000);
                }
            }
        };});
    }

    function executeTransfer(player, offer) {
        if(gameState.userTeam.players.length <= 12) { showNotification('Rosa Corta', 'Devi avere ALMENO 12 giocatori! Impossibile vendere.', 'error'); return; }
        gameState.userTeam.players = gameState.userTeam.players.filter(p => p.id !== player.id); gameState.userTeam.coins += offer.amount;
        player.isStarter = false; player.slotIndex = -1; player.isListed = false; player.offers = [];
        let cpuTeam = gameState.world[offer.league][offer.division].find(t => t.name === offer.teamName);
        if (cpuTeam) { cpuTeam.roster.push(player); if (cpuTeam.roster.length > 14) { cpuTeam.roster.sort((a,b) => a.overall - b.overall); cpuTeam.roster.shift(); } }
        saveGame(); updateDashboardHeader(); renderTransferList(); checkMarketNotifications();
        showNotification('Venduto!', `${player.name} ceduto al ${offer.teamName}. +💰${offer.amount.toLocaleString()}`, 'success');
    }

    if(!searchBtn || !resultsContainer) return;
    
    searchBtn.onclick = () => {
        const nameFilterEl = document.getElementById('market-search-name');
        const posFilterEl = document.getElementById('market-pos');
        const rarityFilterEl = document.getElementById('market-rarity');
        const ageFilterEl = document.getElementById('market-age');
        const budgetFilterEl = document.getElementById('market-budget');

        if (!budgetFilterEl) {
            showNotification('Errore', 'Errore di caricamento. Ricarica la pagina.', 'error');
            return;
        }

        const nameFilter = nameFilterEl.value.toLowerCase();
        const posFilter = posFilterEl.value;
        const rarityFilter = rarityFilterEl.value;
        const ageFilter = ageFilterEl.value;
        const budgetMax = budgetFilterEl.value !== "" ? parseInt(budgetFilterEl.value) : Infinity;

        let allPlayers = [];
        if(gameState.world) {
            for (const lg in gameState.world) {
                [1, 2, 3].forEach(div => {
                    if(gameState.world[lg][div]) {
                        gameState.world[lg][div].forEach(team => { team.roster.forEach(p => { p.teamName = team.name; p.leagueName = lg; p.divLevel = div; allPlayers.push(p); }); });
                    }
                });
            }
        }

        let filtered = allPlayers.filter(p => {
            if(nameFilter && !p.name.toLowerCase().includes(nameFilter)) return false;
            if(posFilter && p.position !== posFilter) return false;
            if(rarityFilter && p.rarity !== rarityFilter) return false;
            
            let playerPrice = p.value || (p.overall * 100);
            if (playerPrice > budgetMax) return false;
            
            if(ageFilter) {
                let [minAge, maxAge] = ageFilter.split('-');
                if(maxAge) { if(p.age < parseInt(minAge) || p.age > parseInt(maxAge)) return false; } else { if(p.age < 30) return false; }
            }
            return true;
        });

        filtered.sort((a, b) => b.overall - a.overall);
        resultsContainer.innerHTML = '';
        if(filtered.length === 0) { resultsContainer.innerHTML = '<p style="color: var(--text-hint);">Nessun talento trovato col budget selezionato.</p>'; return; }

        filtered.slice(0, 30).forEach(p => {
            const flag = p.nationality ? p.nationality.split(' ')[0] : '';
            resultsContainer.innerHTML += `
                <div class="player-card" style="border: 1px solid ${p.color}; box-shadow: 0 4px 12px ${p.color}40; width: 105px; padding: 8px; cursor:default; position:relative;">
                    <div style="position: absolute; top: -6px; left: -6px; background: var(--bg-surface); border: 1px solid var(--border-dim); border-radius: 4px; padding: 2px 4px; font-size: 8px; color: var(--text-muted);">Div ${p.divLevel} - ${p.leagueName.substring(0,3)}</div>
                    <div class="card-overall" style="color: ${p.color}; text-shadow: 0 0 8px ${p.color}80;">${p.overall}</div>
                    <div class="card-pos">${p.position} <span style="font-size:10px;">${flag} ${p.age}a</span></div>
                    <div class="card-name" title="${p.name}" style="font-size: 10px; margin-bottom: 4px;">${p.name.split(' ')[1] || p.name}</div>
                    <div style="font-size: 8px; color: var(--text-muted); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; border-top: 1px solid var(--border-dim); padding-top: 4px;">${p.teamName}</div>
                    <button class="glass-btn buy-btn" data-id="${p.id}" data-team="${p.teamName}" data-league="${p.leagueName}" data-div="${p.divLevel}" data-price="${p.value || (p.overall*100)}" style="padding: 6px; font-size: 11px; margin-top: 8px; width: 100%; border-color: var(--gold); color: var(--gold);">💰 ${(p.value || p.overall*100).toLocaleString()}</button>
                </div>
            `;
        });

        document.querySelectorAll('.buy-btn').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.target.getAttribute('data-id'); const price = parseInt(e.target.getAttribute('data-price')) || 100;
                const teamName = e.target.getAttribute('data-team'); const lg = e.target.getAttribute('data-league'); const div = e.target.getAttribute('data-div');

                if(gameState.userTeam.coins >= price) {
                    showConfirm("Acquisto", `Vuoi acquistare il giocatore dal ${teamName} per 💰${price.toLocaleString()} monete?`, () => {
                        gameState.userTeam.coins -= price; let boughtPlayer = null;
                        const cpuTeam = gameState.world[lg][div].find(t => t.name === teamName);
                        if(cpuTeam) {
                            const pIndex = cpuTeam.roster.findIndex(p => p.id === id);
                            if(pIndex > -1) { boughtPlayer = cpuTeam.roster.splice(pIndex, 1)[0]; let clonePlayer = generatePlayer(boughtPlayer.position, false, 'BRONZE'); clonePlayer.name = generateRandomNameByNation(clonePlayer.nationKey); cpuTeam.roster.push(clonePlayer); }
                        }
                        if(boughtPlayer) { boughtPlayer.isStarter = false; gameState.userTeam.players.push(boughtPlayer); saveGame(); updateDashboardHeader(); showNotification('Acquisto Completato!', `Hai acquistato ${boughtPlayer.name}!`, 'success'); searchBtn.click(); }
                    });
                } else showNotification('Fondi Insufficienti', 'Non hai abbastanza monete.', 'error');
            };
        });
    };
}