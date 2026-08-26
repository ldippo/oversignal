import { SHIPS, shipById } from "../game/ships";
import { MODULES, type ModuleFamily } from "../game/modules";
import { persistSave, type SaveData } from "../core/save";

const FAMILIES: ModuleFamily[] = ["DASH", "TEMPO", "SALVAGE"];

/** Ship shop + module shop/loadout. Mutates + persists save directly. */
export function showHangar(parent: HTMLElement, save: SaveData, onClose: () => void): void {
  const el = document.createElement("div");
  el.className = "screen hangar";
  parent.appendChild(el);

  const loadout = (): string[] => {
    const ship = save.selectedShip;
    if (!save.loadouts[ship]) save.loadouts[ship] = [];
    return save.loadouts[ship];
  };

  const render = (): void => {
    const ship = shipById(save.selectedShip);
    const socketed = loadout();
    el.innerHTML = `
      <h2>HANGAR</h2>
      <div class="stat">SCRAP ${save.scrap} · ${ship.name}: ${socketed.length}/${ship.slots} SLOTS</div>
      <div class="hangar-ships"></div>
      <div class="hangar-modules"></div>
      <button class="secondary back">BACK</button>
    `;

    const shipsBox = el.querySelector(".hangar-ships")!;
    for (const s of SHIPS) {
      const owned = save.ownedShips.includes(s.id);
      const selected = save.selectedShip === s.id;
      const card = document.createElement("button");
      card.className = `card ship-card${selected ? " selected" : ""}`;
      card.innerHTML = `
        <span class="card-name" style="color:#${s.accent.toString(16).padStart(6, "0")}">${s.name}</span>
        <span class="card-desc">${s.desc}</span>
        <span class="card-desc">SLOTS: ${"◆".repeat(s.slots)}</span>
        <span class="card-key">${selected ? "SELECTED" : owned ? "SELECT" : `BUY · ${s.cost} SCRAP`}</span>
      `;
      if (!owned && save.scrap < s.cost) card.disabled = true;
      card.addEventListener("click", () => {
        if (!owned) {
          if (save.scrap < s.cost) return;
          save.scrap -= s.cost;
          save.ownedShips.push(s.id);
        }
        save.selectedShip = s.id;
        persistSave(save);
        render();
      });
      shipsBox.appendChild(card);
    }

    const modBox = el.querySelector(".hangar-modules")!;
    for (const family of FAMILIES) {
      const header = document.createElement("div");
      header.className = "module-family";
      header.textContent = family;
      modBox.appendChild(header);
      for (const mod of MODULES.filter((m) => m.family === family)) {
        const owned = save.ownedModules.includes(mod.id);
        const inLoadout = socketed.includes(mod.id);
        const slotsFree = socketed.length < ship.slots;
        const row = document.createElement("div");
        row.className = `meta-row${inLoadout ? " socketed" : ""}`;
        let action: string;
        let disabled = false;
        if (!owned) {
          action = `${mod.cost} SCRAP`;
          disabled = save.scrap < mod.cost;
        } else if (inLoadout) {
          action = "SOCKETED ✓";
        } else if (slotsFree) {
          action = "SOCKET";
        } else {
          action = "NO SLOT";
          disabled = true;
        }
        row.innerHTML = `
          <span class="meta-name">${mod.name}</span>
          <span class="meta-effect">${mod.desc}</span>
          <button class="meta-buy"${disabled ? " disabled" : ""}>${action}</button>
        `;
        row.querySelector(".meta-buy")!.addEventListener("click", () => {
          if (disabled) return;
          if (!owned) {
            save.scrap -= mod.cost;
            save.ownedModules.push(mod.id);
            if (socketed.length < ship.slots) socketed.push(mod.id); // auto-socket on buy
          } else if (inLoadout) {
            socketed.splice(socketed.indexOf(mod.id), 1);
          } else {
            socketed.push(mod.id);
          }
          persistSave(save);
          render();
        });
        modBox.appendChild(row);
      }
    }

    el.querySelector(".back")!.addEventListener("click", () => {
      el.remove();
      onClose();
    });
  };

  render();
}
