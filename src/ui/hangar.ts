import { SHIPS, shipById } from "../game/ships";
import { MODULES, type ModuleFamily } from "../game/modules";
import { persistSave, type SaveData } from "../core/save";
import { ShipPreview } from "./ship-preview";

const FAMILIES: ModuleFamily[] = ["HEAT", "GROOVE", "DASH"];

/** Ship shop + module shop/loadout. Mutates + persists save directly. */
export function showHangar(parent: HTMLElement, save: SaveData, onClose: () => void): void {
  const el = document.createElement("div");
  el.className = "hangar-screen";
  parent.appendChild(el);
  const preview = new ShipPreview();

  const loadout = (): string[] => {
    const ship = save.selectedShip;
    if (!save.loadouts[ship]) save.loadouts[ship] = [];
    return save.loadouts[ship];
  };

  const render = (): void => {
    const ship = shipById(save.selectedShip);
    const socketed = loadout();
    el.innerHTML = `
      <div class="hangar-head">
        <h2 class="hangar-title">HANGAR</h2>
        <p class="hangar-sub">◆ ${save.scrap} SCRAP&ensp;·&ensp;${ship.name}&ensp;·&ensp;${socketed.length}/${ship.slots} SLOTS</p>
      </div>
      <div class="preview-slot"></div>
      <div class="hangar-ships"></div>
      <div class="hangar-modules"></div>
      <button class="back-btn back"><span>BACK</span></button>
    `;
    el.querySelector(".preview-slot")!.appendChild(preview.canvas);
    preview.setShip(ship);

    const shipsBox = el.querySelector(".hangar-ships")!;
    for (const s of SHIPS) {
      const owned = save.ownedShips.includes(s.id);
      const selected = save.selectedShip === s.id;
      const card = document.createElement("button");
      card.className = `ship-card${selected ? " selected" : ""}`;
      card.innerHTML = `
        <span class="card-name" style="color:#${s.accent.toString(16).padStart(6, "0")}">${s.name}</span>
        <span class="card-desc">${s.desc}</span>
        <span class="card-desc card-rule">${s.ruleDesc}</span>
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
      preview.dispose();
      el.remove();
      onClose();
    });
  };

  render();
}
