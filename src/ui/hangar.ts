import { SHIPS } from "../game/ships";
import { META_TRACKS, tierCost } from "../game/meta";
import { persistSave, type SaveData } from "../core/save";

/** Ship shop + permanent upgrade tracks. Mutates + persists save directly. */
export function showHangar(parent: HTMLElement, save: SaveData, onClose: () => void): void {
  const el = document.createElement("div");
  el.className = "screen hangar";
  parent.appendChild(el);

  const render = (): void => {
    el.innerHTML = `
      <h2>HANGAR</h2>
      <div class="stat">SCRAP ${save.scrap}</div>
      <div class="hangar-ships"></div>
      <div class="hangar-meta"></div>
      <button class="secondary back">BACK</button>
    `;

    const shipsBox = el.querySelector(".hangar-ships")!;
    for (const ship of SHIPS) {
      const owned = save.ownedShips.includes(ship.id);
      const selected = save.selectedShip === ship.id;
      const card = document.createElement("button");
      card.className = `card ship-card${selected ? " selected" : ""}`;
      card.innerHTML = `
        <span class="card-name" style="color:#${ship.accent.toString(16).padStart(6, "0")}">${ship.name}</span>
        <span class="card-desc">${ship.desc}</span>
        <span class="card-key">${selected ? "SELECTED" : owned ? "SELECT" : `BUY · ${ship.cost} SCRAP`}</span>
      `;
      if (!owned && save.scrap < ship.cost) card.disabled = true;
      card.addEventListener("click", () => {
        if (!owned) {
          if (save.scrap < ship.cost) return;
          save.scrap -= ship.cost;
          save.ownedShips.push(ship.id);
        }
        save.selectedShip = ship.id;
        persistSave(save);
        render();
      });
      shipsBox.appendChild(card);
    }

    const metaBox = el.querySelector(".hangar-meta")!;
    for (const track of META_TRACKS) {
      const tier = save.meta[track.id];
      const maxed = tier >= track.maxTier;
      const cost = maxed ? 0 : tierCost(track, tier);
      const row = document.createElement("div");
      row.className = "meta-row";
      const pips = Array.from({ length: track.maxTier }, (_, i) =>
        `<span class="pip${i < tier ? " filled" : ""}"></span>`).join("");
      row.innerHTML = `
        <span class="meta-name">${track.name}</span>
        <span class="meta-effect">${track.effect}</span>
        <span class="meta-pips">${pips}</span>
        <button class="meta-buy"${maxed || save.scrap < cost ? " disabled" : ""}>
          ${maxed ? "MAX" : `${cost} SCRAP`}
        </button>
      `;
      row.querySelector(".meta-buy")!.addEventListener("click", () => {
        if (maxed || save.scrap < cost) return;
        save.scrap -= cost;
        save.meta[track.id] = tier + 1;
        persistSave(save);
        render();
      });
      metaBox.appendChild(row);
    }

    el.querySelector(".back")!.addEventListener("click", () => {
      el.remove();
      onClose();
    });
  };

  render();
}
