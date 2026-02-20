const getRequiredXP = (level) => 100 + (level * 50);

// DEFAULT STATE (Zero Data Loss Merge Setup)
let state = {
    playerClass: null, level: 1, xp: 0, hp: 100, gold: 50, streak: 0, rivalXp: 10,
    hardcore: false, allDoneToday: false, lastDate: new Date().toDateString(),
    skills: { str: 1, int: 1, dis: 1 },
    inventory: { potion: 0, shield: 0, artifacts: [], gear: [] },
    equippedGear: null, totalXp: 0, prestige: 0, pet: { xp: 0, level: 1 },
    combo: 0, lastTaskTime: 0, dailyBounty: { name: "Do 20 Pushups", done: false, xp: 100, type: "str" },
    tasks: [
        { id: 1, name: "Deep Work", xp: 20, gold: 10, type: "int", isHard: false, completed: false },
        { id: 2, name: "Intense Workout", xp: 40, gold: 20, type: "str", isHard: true, completed: false }
    ],
    // v7 NEW STATS
    stamina: 10, dungeonFloor: 1, trophies: [], auras: [], activeAura: null, eventProgress: 0, eventDone: false
};

let bossHP = 50;

function init() {
    setTimeout(() => {
        document.getElementById('loading-screen').style.opacity = '0';
        setTimeout(() => document.getElementById('loading-screen').classList.add('hidden'), 1000);
    }, 1500);

    // MERGE ENGINE - Keeps older saves perfectly intact
    const saved = localStorage.getItem('levelup_v5');
    if (saved) {
        let parsed = JSON.parse(saved);
        state = { ...state, ...parsed }; 
    }
    
    setupEventListeners();
    checkDailyReset();
    checkTrophies();
    render();
    if (!state.playerClass) document.getElementById('class-modal').classList.remove('hidden');
}

function addCustomTask() {
    const name = document.getElementById('task-name').value;
    const type = document.getElementById('task-type').value;
    const diff = parseInt(document.getElementById('task-diff').value);
    if (!name) return alert("Enter a name!");
    state.tasks.push({ id: Date.now(), name, type, xp: 20 * diff, gold: 10 * diff, isHard: diff === 2, completed: false });
    save(); render();
}

function deleteTask(e, id) { e.stopPropagation(); state.tasks = state.tasks.filter(t => t.id !== id); save(); render(); }

function completeQuest(id, isBounty = false) {
    let task = isBounty ? state.dailyBounty : state.tasks.find(t => t.id === id);
    if (task.completed || task.done) return;
    if (isBounty) task.done = true; else task.completed = true;
    
    // Combo & Recovery
    let now = Date.now();
    if (now - state.lastTaskTime < 3600000) state.combo++; else state.combo = 1;
    state.lastTaskTime = now;
    let comboMult = 1 + (state.combo * 0.1);
    
    // Stamina Recovery
    if(state.stamina < 10) state.stamina++;

    // Base XP Multipliers
    let mult = (state.playerClass === 'Warrior' && task.type === 'str') || 
               (state.playerClass === 'Mage' && task.type === 'int') || 
               (state.playerClass === 'Rogue' && task.type === 'dis') ? 1.5 : 1;
    
    // Gear System
    if (state.equippedGear === 'Scholar Robes' && task.type === 'int') mult += 0.5;
    if (state.equippedGear === 'Swift Boots' && task.type === 'str') mult += 0.5;

    // Pet Skill: 5% Double Gold if Pet Lv >= 10
    let petGoldMult = (state.pet.level >= 10 && Math.random() < 0.05) ? 2 : 1;
    if (petGoldMult === 2) alert("🐾 Your pet found extra gold!");

    let finalXp = Math.floor(task.xp * mult * comboMult);
    state.xp += finalXp; state.totalXp += finalXp; state.pet.xp += finalXp;
    state.gold += Math.floor((task.gold || 50) * comboMult * petGoldMult);
    if (!isBounty) state.skills[task.type]++;

    // Seasonal Event Check
    if(task.type === 'int' && !state.eventDone) {
        state.eventProgress++;
        if(state.eventProgress >= 3) {
            state.eventDone = true;
            if(!state.auras.includes('Frost Aura')) state.auras.push('Frost Aura');
            alert("❄️ Event Complete! You unlocked the Frost Aura!");
        }
    }

    checkLevelUps();

    // Lootboxes
    if (task.isHard && Math.random() < 0.20) {
        const artifacts = ["Neon Gem", "Cyber Relic", "Dragon Scale"];
        const drop = artifacts[Math.floor(Math.random() * artifacts.length)];
        state.inventory.artifacts.push(drop); state.gold += 50;
        alert(`🎁 LOOTBOX OPENED!\nFound: ${drop} & 50 Gold!`);
    }

    if (state.tasks.every(t => t.completed) && !state.allDoneToday) {
        state.allDoneToday = true; state.streak++; state.rivalXp = Math.max(0, state.rivalXp - 20);
        confetti({ particleCount: 200 });
        checkTrophies();
        if (state.streak > 0 && state.streak % 7 === 0) spawnBoss();
    }
    save(); render();
}

function checkLevelUps() {
    if (state.xp >= getRequiredXP(state.level)) { state.level++; state.xp = 0; confetti(); checkTrophies(); }
    let newPetLevel = Math.floor(state.pet.xp / 200) + 1;
    if (newPetLevel > state.pet.level) { state.pet.level = newPetLevel; alert("🐾 Your Pet Evolved!"); }
}

function checkTrophies() {
    let newTrophy = false;
    if(state.streak >= 7 && !state.trophies.includes("Novice Dedication (7-Day)")) { state.trophies.push("Novice Dedication (7-Day)"); newTrophy = true; }
    if(state.streak >= 30 && !state.trophies.includes("Legendary Discipline (30-Day)")) { state.trophies.push("Legendary Discipline (30-Day)"); newTrophy = true; }
    if(state.level >= 50 && !state.trophies.includes("Half-Century Hero")) { state.trophies.push("Half-Century Hero"); newTrophy = true; }
    if(newTrophy) alert("🏆 New Trophy Unlocked! Check the Trophies Tab.");
}

function completeBounty() { completeQuest(null, true); }

function prestige() {
    if (state.level >= 100 && confirm("Prestige resets level to 1 but gives permanent multipliers. Proceed?")) {
        state.prestige++; state.level = 1; state.xp = 0; alert("🌟 PRESTIGED!"); save(); render();
    }
}

// DUNGEON
function exploreDungeon() {
    if(state.stamina < 1) return alert("Not enough stamina! Complete quests to recover.");
    state.stamina--;
    const log = document.getElementById('dungeon-log');
    let roll = Math.random();
    let msg = `[Floor ${state.dungeonFloor}] `;
    
    if(roll < 0.3) {
        let g = Math.floor(Math.random() * 20) + 10;
        state.gold += g; msg += `Found a chest! +${g} Gold.`;
    } else if(roll < 0.5) {
        let x = Math.floor(Math.random() * 30) + 10;
        state.xp += x; msg += `Defeated a goblin! +${x} XP.`;
    } else if(roll < 0.6) {
        state.inventory.artifacts.push("Abyssal Shard");
        msg += `✨ Rare drop! Found an Abyssal Shard!`;
    } else if(roll < 0.8) {
        msg += `Empty corridor. Nothing here.`;
    } else {
        state.dungeonFloor++; msg += `🚪 Found the stairs! Advanced to Floor ${state.dungeonFloor}!`;
    }
    
    log.innerHTML = `<p>${msg}</p>` + log.innerHTML;
    save(); render();
}

// SHOP & INVENTORY
function buyItem(item, cost, isGear = false) {
    if (state.gold >= cost) {
        state.gold -= cost;
        if (isGear) state.inventory.gear.push(item); else state.inventory[item]++;
        save(); render();
    } else alert("Not enough gold!");
}

function useItem(item) {
    if (state.inventory[item] > 0) {
        if (item === 'potion' && state.hp < 100) { state.hp = Math.min(100, state.hp + 50); state.inventory.potion--; }
        else if (item === 'shield') alert("Shield active! Protects streak automatically.");
        save(); render();
    }
}

function equipGear(gearName) { state.equippedGear = gearName; save(); render(); }
function equipAura(auraName) { state.activeAura = auraName; save(); render(); }

// DAILY & BOSS
function checkDailyReset() {
    const today = new Date().toDateString();
    if (state.lastDate !== today) {
        if (!state.allDoneToday && state.tasks.length > 0) {
            if (state.inventory.shield > 0) { state.inventory.shield--; alert("🛡️ Aegis Shield protected your streak."); } 
            else { state.streak = 0; state.hp -= 20; state.rivalXp += 30; }
        }
        state.tasks.forEach(t => t.completed = false);
        state.allDoneToday = false; state.combo = 0; state.stamina = 10;
        
        const bounties = [{name:"Read 30 mins", type:"int"}, {name:"Run 2 miles", type:"str"}, {name:"Meditate 15m", type:"dis"}];
        state.dailyBounty = { ...bounties[Math.floor(Math.random() * bounties.length)], xp: 100, done: false };
        
        state.lastDate = today;
        if (state.hp <= 0) { if (state.hardcore) { localStorage.clear(); location.reload(); } else { state.level = Math.max(1, state.level - 1); state.hp = 100; state.xp = 0; } }
        save();
    }
}

function spawnBoss() { bossHP = 50 + (state.level * 5); document.getElementById('boss-modal').classList.remove('hidden'); }
function damageBoss() {
    bossHP--; document.getElementById('boss-hp-fill').style.width = (bossHP / (50 + state.level * 5) * 100) + '%';
    if (bossHP <= 0) { document.getElementById('boss-modal').classList.add('hidden'); state.gold += 150; state.xp += 300; alert("⚔️ BOSS VANQUISHED!"); save(); render(); }
}

// RENDER
function render() {
    document.getElementById('gold-count').innerText = state.gold;
    document.getElementById('streak-count').innerText = state.streak;
    document.getElementById('hp-fill').style.width = state.hp + '%';
    document.getElementById('stamina-fill').style.width = (state.stamina * 10) + '%';
    document.getElementById('class-display').innerText = state.playerClass || "NONE";
    document.getElementById('tree-level').innerText = state.level;
    document.getElementById('combo-count').innerText = state.combo;
    document.getElementById('prestige-badge').innerText = state.prestige > 0 ? '🌟'.repeat(state.prestige) : '';
    document.getElementById('dungeon-floor').innerText = state.dungeonFloor;
    
    // Event Progress
    document.getElementById('event-prog').innerText = Math.min(3, state.eventProgress);
    if(state.eventDone) document.getElementById('seasonal-event-box').style.opacity = '0.5';

    // Visual Tiers Update
    let avatarContainer = document.getElementById('avatar-container');
    avatarContainer.className = 'avatar-glow'; // reset
    if(state.equippedGear === 'Ragged Tunic') avatarContainer.classList.add('tier-ragged');
    if(state.equippedGear === 'Steel Armor') avatarContainer.classList.add('tier-steel');
    if(state.equippedGear === 'Legendary Plate') avatarContainer.classList.add('tier-legendary');
    if(state.activeAura === 'Frost Aura') avatarContainer.classList.add('aura-frost');

    // Pet Evolution visuals
    let petIcon = state.pet.level < 5 ? "🥚" : state.pet.level < 10 ? "🐣" : state.pet.level < 20 ? "🐺" : "🐉";
    document.getElementById('pet-display').innerText = `${petIcon} Pet Lv.${state.pet.level}`;
    
    // Map & Bars
    document.getElementById('map-progress').value = state.totalXp % 1000;
    document.getElementById('xp-fill').style.width = (state.xp / getRequiredXP(state.level) * 100) + '%';
    document.getElementById('rival-fill').style.width = Math.min(100, state.rivalXp) + '%';
    
    document.getElementById('skill-str').innerText = `Lv.${state.skills.str}`;
    document.getElementById('skill-int').innerText = `Lv.${state.skills.int}`;
    document.getElementById('skill-dis').innerText = `Lv.${state.skills.dis}`;

    if (state.level >= 100) document.getElementById('prestige-btn').classList.remove('hidden');

    document.getElementById('bounty-text').innerHTML = state.dailyBounty.done ? "✅ Completed" : `<strong>${state.dailyBounty.name}</strong> (+100 XP)`;
    document.getElementById('daily-bounty-box').onclick = () => completeBounty();
    if(state.dailyBounty.done) document.getElementById('daily-bounty-box').style.borderColor = "var(--success)";

    document.getElementById('quests-list').innerHTML = state.tasks.map(t => `
        <div class="quest-card ${t.completed ? 'completed' : ''}" onclick="completeQuest(${t.id})">
            <div><strong>${t.isHard ? '🔥 ' : ''}${t.name}</strong><br><small>+${t.xp} XP | +${t.gold}g</small></div>
            <div style="display:flex; align-items:center; gap:10px;"><span>${t.completed ? '✅' : '⚡'}</span><button class="delete-btn" onclick="deleteTask(event, ${t.id})">🗑️</button></div>
        </div>
    `).join('');

    // Shop updated with Tiered Visual Gear
    document.getElementById('shop-list').innerHTML = `
        <div class="shop-item" onclick="buyItem('potion', 50)">🧪 Potion (50g)</div>
        <div class="shop-item" onclick="buyItem('shield', 200)">🛡️ Shield (200g)</div>
        <div class="shop-item" onclick="buyItem('Scholar Robes', 500, true)">🧥 Scholar Robes (500g)<p>+INT XP</p></div>
        <div class="shop-item" onclick="buyItem('Swift Boots', 500, true)">🥾 Swift Boots (500g)<p>+STR XP</p></div>
        <div class="shop-item" onclick="buyItem('Ragged Tunic', 100, true)">👕 Ragged Tunic (100g)<p>Basic visual</p></div>
        <div class="shop-item" onclick="buyItem('Steel Armor', 1000, true)">⚔️ Steel Armor (1000g)<p>Silver visual tier</p></div>
        <div class="shop-item" onclick="buyItem('Legendary Plate', 5000, true)">🌟 Legendary Plate (5000g)<p>Gold glowing tier</p></div>
    `;

    document.getElementById('active-gear').innerText = state.equippedGear || "None";
    document.getElementById('active-aura').innerText = state.activeAura || "None";
    
    document.getElementById('inventory-list').innerHTML = `
        <div class="inv-item" onclick="useItem('potion')">🧪 Potion x${state.inventory.potion}</div>
        <div class="inv-item">🛡️ Shield x${state.inventory.shield}</div>
        ${[...new Set(state.inventory.gear)].map(g => `<div class="inv-item" onclick="equipGear('${g}')">👕 ${g} (Click Equip)</div>`).join('')}
        ${state.auras.map(a => `<div class="inv-item" onclick="equipAura('${a}')">✨ ${a} (Equip Aura)</div>`).join('')}
        ${state.inventory.artifacts.map(a => `<div class="inv-item">✨ ${a}</div>`).join('')}
    `;

    document.getElementById('trophies-list').innerHTML = state.trophies.map(t => `<div class="inv-item trophy-item" style="border-color: gold;">🏆<p style="font-size:0.8rem">${t}</p></div>`).join('');
    
    document.getElementById('hardcore-toggle').checked = state.hardcore;
}

function setupEventListeners() {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn, .tab-pane').forEach(el => el.classList.remove('active'));
        btn.classList.add('active'); document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    }));
    document.querySelectorAll('.class-choice').forEach(c => c.addEventListener('click', () => {
        state.playerClass = c.dataset.class; document.getElementById('class-modal').classList.add('hidden'); save(); render();
    }));
    document.getElementById('boss-sprite').addEventListener('click', damageBoss);
    document.getElementById('hardcore-toggle').addEventListener('change', e => { state.hardcore = e.target.checked; save(); });
    document.getElementById('wipe-btn').addEventListener('click', () => { if(confirm("RESET ALL?")) { localStorage.removeItem('levelup_v5'); location.reload(); }});
}
function save() { localStorage.setItem('levelup_v5', JSON.stringify(state)); }
init();
