/* Starfall Dominion v6.7 — colony construction, fleet capacity and troop logistics.
   Pure balance rules: shared by rendering and game actions, no save-key changes. */
'use strict';
const StarfallEconomy = (() => {
  const BUILDING_FIELDS=Object.freeze({
    mine:'mines',reactor:'reactors',farm:'farms',shipyard:'shipyards',
    extractor:'extractors',foundry:'foundry',laboratory:'laboratory',
    tradeHub:'tradeHub',outpost:'outpost',fortress:'fortress',
    refinery:'refinery',barracks:'barracks',factory:'factory'
  });
  const SHIP_BATCH=Object.freeze({fleet:2,frigate:1,cruiser:1});
  const integer=n=>Number.isFinite(Number(n))?Math.max(0,Math.floor(Number(n))):0;
  function buildingLevel(type,system,jobs=[],systemId=-1) {
    const field=BUILDING_FIELDS[type];if(!field)return 0;
    return integer(system?.[field]) + (jobs||[]).filter(j=>j&&j.system===systemId&&j.type===type).length;
  }
  function buildingCost(type,base,system,jobs=[],systemId=-1) {
    if(!BUILDING_FIELDS[type]||!base)return base;
    const level=buildingLevel(type,system,jobs,systemId);
    const rate=Math.pow(1.55,Math.min(30,level));
    return Object.fromEntries(Object.entries(base).map(([key,n])=>[key,Math.ceil(n*rate)]));
  }
  function shipCapacity(system) {return 10+25*integer(system?.shipyards);}
  function queuedShips(jobs,systemId) {
    return (jobs||[]).reduce((count,j)=>count+(j&&j.system===systemId?(SHIP_BATCH[j.type]||0):0),0);
  }
  function shipSlotsLeft(system,jobs,systemId) {
    return Math.max(0,shipCapacity(system)-integer(system?.ships)-queuedShips(jobs,systemId));
  }
  function canBuildShips(type,system,jobs,systemId) {
    return !!SHIP_BATCH[type]&&shipSlotsLeft(system,jobs,systemId)>=SHIP_BATCH[type];
  }
  function cargoCapacity(fleet) {
    const total=integer(fleet?.ships);
    const cruisers=Math.min(total,integer(fleet?.cruisers));
    const frigates=Math.min(total-cruisers,integer(fleet?.frigates));
    return (total-cruisers-frigates)*5+frigates*15+cruisers*35;
  }
  // Space costs: infantry = 1 slot; marines = 2; armored vehicles = 5.
  // Prioritize scarce armored support, then marines, then infantry.
  function loadCargo(stock,fleet) {
    const total=cargoCapacity(fleet);
    let remaining=total;
    const armor=Math.min(integer(stock?.armor),Math.floor(remaining/5));remaining-=armor*5;
    const marines=Math.min(integer(stock?.marines),Math.floor(remaining/2));remaining-=marines*2;
    const troops=Math.min(integer(stock?.troops),remaining);remaining-=troops;
    return {troops,marines,armor,slots:total,used:total-remaining};
  }
  return Object.freeze({BUILDING_FIELDS,buildingLevel,buildingCost,shipCapacity,queuedShips,shipSlotsLeft,canBuildShips,cargoCapacity,loadCargo});
})();
