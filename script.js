const getRequiredXP = (level) => 100 + (level * 50);

let state = {
    playerClass: null,
    level: 1, xp: 0, hp: 100, gold: 50, streak: 0, rivalXp: 10,
    hardcore: false, allDoneToday: false,
    lastDate: new Date().toDateString(),
    skills: { str: 1, int: 1, dis: 1 },
    inventory: { potion: 0, shield: 0, artifacts: [] },
    tasks: [
        { id: 1, name: "Deep Work", xp: 20, gold: 10, type: "int", isHard: false, completed: false },
        { id: 2, name: "Intense Workout", xp: 40, gold: 20, type: "str", isHard: true, completed: false }
    ]
};

let bossHP = 50;

function init() {
    setTimeout(() => {
        document.getElementById('loading-screen').style.opacity = '0';
        setTimeout(() => document.getElementById('loading-screen').classList.add('hidden'), 1000);
    }, 1500);

    const saved = localStorage.getItem('levelup_v5');
    if (saved) state = JSON.parse(saved);
    if (!state.inventory) state.inventory = { potion: 0, shield: 0, artifacts: [] }; // Safety catch
    
    setupEventListeners();
    checkDailyReset();
    render();
    
    if (!state.playerClass) document.getElementById('class-modal').classList.remove('hidden');
}

function addCustomTask() {
    const name = document.getElementById('task-name').value;
    const type = document.getElementById('task-type').value;
    const diff = parseInt(document.getElementById('task-diff').value);
    if (!name) return alert("Enter a name!");

    state.tasks.push({
        id: Date.now(), name, type,
        xp: 20 * diff, gold: 10 * diff,
        isHard: diff === 2, completed: false
    });
    save(); render();
}

function deleteTask(e, id) {
    e.stopPropagation();
    state.tasks = state.tasks.filter(t => t.id !== id);
    save(); render();
}

function completeQuest(id) {
    const task = state.tasks.find(t => t.id === id);
    if (task.completed) return;
    task.completed = true;
    
    let mult = (state.playerClass === 'Warrior' && task.type === 'str') || 
               (state.playerClass === 'Mage' && task.type === 'int') || 
               (state.playerClass === 'Rogue' && task.type === 'dis') ? 1.5 : 1;

    state.xp += Math.floor(task.xp * mult);
    state.gold += task.gold;
    state.skills[task.type]++;

    // Level up logic
    if (state.xp >= getRequiredXP(state.level)) {
        state.level++; state.xp = 0; confetti();
    }

    // LOOTBOX LOGIC (20% on Hard Tasks)
    if (task.isHard && Math.random() < 0.20) {
        const artifacts = ["Neon Gem", "Cyber Relic", "Dragon Scale"];
        const drop = artifacts[Math.floor(Math.random() * artifacts.length)];
        state.inventory.artifacts.push(drop);
        state.gold += 50;
        alert(`🎁 LOOTBOX OPENED!\nFound: ${drop} & 50 Gold!`);
    }

    // Streak checking
    if (state.tasks.length > 0 && state.tasks.every(t => t.completed) && !state.allDoneToday) {
        state.allDoneToday = true;
        state.streak++;
        state.rivalXp = Math.max(0, state.rivalXp - 20);
        confetti({ particleCount: 200 });
        if (state.streak > 0 && state.streak % 7 === 0) spawnBoss();
    }
    save(); render();
}

// --- SHOP & INVENTORY ---
function buyItem(item, cost) {
    if (state.gold >= cost) {
        state.gold -= cost;
        state.inventory[item]++;
        save(); render();
    } else alert("Not enough gold!");
}

function useItem(item) {
    if (state.inventory[item] > 0) {
        if (item === 'potion' && state.hp < 100) {
            state.hp = Math.min(100, state.hp + 50);
            state.inventory.potion--;
        } else if (item === 'shield') {
            alert("Shield equipped! It will protect your streak automatically.");
        } else return;
        save(); render();
    }
}

// --- CORE SYSTEM ---
function checkDailyReset() {
    const today = new Date().toDateString();
    if (state.lastDate !== today) {
        if (!state.allDoneToday) {
            if (state.inventory.shield > 0) {
                state.inventory.shield--; alert("🛡️ Aegis Shield consumed! Streak protected.");
            } else { 
                state.streak = 0; state.hp -= 20; state.rivalXp += 30; 
            }
        }
        state.tasks.forEach(t => t.completed = false);
        state.allDoneToday = false;
        state.lastDate = today;
        if (state.hp <= 0) handleDeath();
        save();
    }
}

function handleDeath() {
    if (state.hardcore) { alert("💀 PERMADEATH."); localStorage.clear(); location.reload(); } 
    else { alert("💀 YOU DIED."); state.level = Math.max(1, state.level - 1); state.hp = 100; state.xp = 0; }
}

function spawnBoss() {
    bossHP = 50 + (state.level * 5);
    document.getElementById('boss-modal').classList.remove('hidden');
}

function damageBoss() {
    bossHP--;
    document.getElementById('boss-hp-fill').style.width = (bossHP / (50 + state.level * 5) * 100) + '%';
    if (bossHP <= 0) {
        document.getElementById('boss-modal').classList.add('hidden');
        state.gold += 150; state.xp += 300;
        alert("⚔️ BOSS VANQUISHED! Massive Rewards Acquired.");
        save(); render();
    }
}

// --- RENDER ---
function render() {
    document.getElementById('gold-count').innerText = state.gold;
    document.getElementById('streak-count').innerText = state.streak;
    document.getElementById('hp-fill').style.width = state.hp + '%';
    document.getElementById('class-display').innerText = state.playerClass || "NONE";
    document.getElementById('tree-level').innerText = state.level;
    
    document.getElementById('xp-fill').style.width = (state.xp / getRequiredXP(state.level) * 100) + '%';
    document.getElementById('rival-fill').style.width = Math.min(100, state.rivalXp) + '%';
    
    document.getElementById('skill-str').innerText = `Lv.${state.skills.str}`;
    document.getElementById('skill-int').innerText = `Lv.${state.skills.int}`;
    document.getElementById('skill-dis').innerText = `Lv.${state.skills.dis}`;

    // Quests
    document.getElementById('quests-list').innerHTML = state.tasks.map(t => `
        <div class="quest-card ${t.completed ? 'completed' : ''}" onclick="completeQuest(${t.id})">
            <div>
                <strong>${t.isHard ? '🔥 ' : ''}${t.name}</strong><br>
                <small>+${t.xp} XP | +${t.gold}g</small>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span>${t.completed ? '✅' : '⚡'}</span>
                <button class="delete-btn" onclick="deleteTask(event, ${t.id})">🗑️</button>
            </div>
        </div>
    `).join('');

    // Shop
    document.getElementById('shop-list').innerHTML = `
        <div class="shop-item" onclick="buyItem('potion', 50)">🧪 HP Potion (50g)<p>Heals 50 HP</p></div>
        <div class="shop-item" onclick="buyItem('shield', 200)">🛡️ Aegis Shield (200g)<p>Auto-Saves Streak</p></div>
    `;

    // Inventory
    document.getElementById('inventory-list').innerHTML = `
        <div class="inv-item" onclick="useItem('potion')"><div>🧪 HP Potion</div><div>x${state.inventory.potion} (Click to Use)</div></div>
        <div class="inv-item"><div>🛡️ Aegis Shield</div><div>x${state.inventory.shield} (Passive)</div></div>
        ${state.inventory.artifacts.map(a => `<div class="inv-item" style="border-color:var(--rival-color)"><div>✨ ${a}</div><div>Rare Artifact</div></div>`).join('')}
    `;
    
    document.getElementById('hardcore-toggle').checked = state.hardcore;
}

function setupEventListeners() {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-btn, .tab-pane').forEach(el => el.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    }));
    document.querySelectorAll('.class-choice').forEach(c => c.addEventListener('click', () => {
        state.playerClass = c.dataset.class;
        document.getElementById('class-modal').classList.add('hidden');
        save(); render();
    }));
    document.getElementById('boss-sprite').addEventListener('click', damageBoss);
    document.getElementById('hardcore-toggle').addEventListener('change', e => { state.hardcore = e.target.checked; save(); });
    document.getElementById('wipe-btn').addEventListener('click', () => { if(confirm("RESET ALL?")) { localStorage.clear(); location.reload(); }});
}
function save() { localStorage.setItem('levelup_v5', JSON.stringify(state)); }
init();