/* Starfall Dominion v6.6 — deterministic, per-ship tactical combat.
   Deliberately independent of the map, UI and resource economy. */
'use strict';
const StarfallCombat = (() => {
  const STATS = Object.freeze({
    corvette: {hull:10, shield:2, armor:0.02, dps:1.3, target:['frigate','corvette','cruiser'], bonus:{frigate:1.15}},
    frigate:  {hull:24, shield:8, armor:0.12, dps:3.2, target:['corvette','frigate','cruiser'], bonus:{corvette:1.35}},
    cruiser:  {hull:50, shield:18,armor:0.25, dps:6.5, target:['cruiser','frigate','corvette'], bonus:{cruiser:1.30}}
  });
  const TYPES = ['corvette','frigate','cruiser'];
  const integer = n => Math.max(0, Math.floor(Number.isFinite(Number(n)) ? Number(n) : 0));
  function composition(f) {
    const ships = Math.min(5000, integer(f.ships));
    const cruisers = Math.min(ships,integer(f.cruisers));
    const frigates = Math.min(ships-cruisers,integer(f.frigates));
    return {corvette:ships-frigates-cruisers,frigate:frigates,cruiser:cruisers};
  }
  function createUnits(f, shieldTech=false) {
    const roster=composition(f), units=[];
    for (const type of TYPES) for(let i=0;i<roster[type];i++)
      units.push({type,hull:STATS[type].hull,shield:STATS[type].shield+(shieldTech?3:0)});
    return units;
  }
  function summary(units) {
    const result={ships:0,corvette:0,frigate:0,cruiser:0,hull:0,shield:0,maxHull:0,maxShield:0};
    for(const u of units||[]) {
      if(!u||!STATS[u.type]||!Number.isFinite(u.hull)||u.hull<=0)continue;
      result.ships++;result[u.type]++;
      result.hull+=u.hull;result.shield+=Math.max(0,u.shield||0);
      result.maxHull+=STATS[u.type].hull;
      result.maxShield+=STATS[u.type].shield+(u.techShield?3:0);
    }
    return result;
  }
  function legacyUnits(f, legacyHull) {
    const units=createUnits(f);
    if(!Number.isFinite(legacyHull))return units;
    // Existing v6.5 battles stored one aggregate hull pool. Convert it once;
    // never synthesize lost ships back into a saved fight.
    let damage=Math.max(0,summary(units).hull-Math.max(0,legacyHull));
    for(const u of units) {
      if(damage<=0)break;
      const hit=Math.min(damage,u.hull);
      u.hull-=hit;u.shield=0;damage-=hit;
    }
    return units.filter(u=>u.hull>0);
  }
  function ensure(e) {
    if(!Array.isArray(e.attackUnits))e.attackUnits=legacyUnits({ships:e.attackShips,frigates:e.attackFrigates,cruisers:e.attackCruisers},e.attackHP);
    if(!Array.isArray(e.defendUnits))e.defendUnits=legacyUnits({ships:e.defendShips,frigates:e.defendFrigates,cruisers:e.defendCruisers},e.defendHP);
    if(!e.attackStart)e.attackStart=composition({ships:e.attackShips,frigates:e.attackFrigates,cruisers:e.attackCruisers});
    if(!e.defendStart)e.defendStart=composition({ships:e.defendShips,frigates:e.defendFrigates,cruisers:e.defendCruisers});
    sync(e);
    return e;
  }
  function sync(e) {
    const a=summary(e.attackUnits),d=summary(e.defendUnits);
    e.attackShips=a.ships;e.attackFrigates=a.frigate;e.attackCruisers=a.cruiser;e.attackHP=a.hull;
    e.defendShips=d.ships;e.defendFrigates=d.frigate;e.defendCruisers=d.cruiser;e.defendHP=d.hull;
    return {attack:a,defense:d};
  }
  function start(e, attacker, defender, attackerShieldTech=false, defenderShieldTech=false) {
    e.attackUnits=createUnits(attacker,attackerShieldTech);
    e.defendUnits=createUnits(defender,defenderShieldTech);
    e.attackStart=composition(attacker);
    e.defendStart=composition(defender);
    sync(e);
    return e;
  }
  function reinforce(e, side, fleet, shieldTech=false) {
    ensure(e);
    const key=side==='attack'?'attackUnits':'defendUnits';
    const initial=side==='attack'?'attackStart':'defendStart';
    const roster=composition(fleet);
    e[key].push(...createUnits(fleet,shieldTech));
    for(const type of TYPES)e[initial][type]=(e[initial][type]||0)+roster[type];
    sync(e);
  }
  function volleyPlan(units, boost, dt, fortress=0) {
    const counts=summary(units);
    return TYPES.map(type=>({type,damage:counts[type]*STATS[type].dps*boost*dt}))
      .concat(fortress>0?[{type:'corvette',damage:fortress*2*dt}]:[]);
  }
  function strike(targets,volley,armorBonus=0) {
    let amount=volley.damage,iterations=0;
    const attacker=STATS[volley.type];
    while(amount>0.00001&&iterations++<10000) {
      let unit;
      for(const desired of attacker.target) {
        unit=targets.find(u=>u.type===desired&&u.hull>0);
        if(unit)break;
      }
      if(!unit)break;
      const bonus=attacker.bonus[unit.type]||1;
      const takeShield=Math.min(Math.max(0,unit.shield||0),amount*bonus);
      unit.shield=Math.max(0,(unit.shield||0)-takeShield);
      amount-=takeShield/bonus;
      if(amount<=0.00001)break;
      const protection=Math.min(0.65,STATS[unit.type].armor+armorBonus);
      const needed=unit.hull/(bonus*(1-protection));
      const spent=Math.min(amount,needed);
      unit.hull=Math.max(0,unit.hull-spent*bonus*(1-protection));
      amount-=spent;
      if(unit.hull<=0.00001){unit.hull=0;unit.shield=0;}
    }
  }
  function advance(e,dt,context={}) {
    ensure(e);
    if(!Number.isFinite(dt)||dt<=0)return sync(e);
    // Snapshots make volleys simultaneous: units destroyed this tick still fire.
    const attack=volleyPlan(e.attackUnits,(context.attackWeapons?1.6:1)*(context.attackMilitary?1.2:1)*(context.guard?0.75:1),dt);
    const defend=volleyPlan(e.defendUnits,1,dt,Math.max(0,context.fortress||0)+(context.defendShields?1:0));
    for(const shot of attack)strike(e.defendUnits,shot,context.defendShields?0.08:0);
    for(const shot of defend)strike(e.attackUnits,shot,context.guard?0.07:context.attackShields?0.08:0);
    e.attackUnits=e.attackUnits.filter(u=>u.hull>0);
    e.defendUnits=e.defendUnits.filter(u=>u.hull>0);
    return sync(e);
  }
  function losses(start,remaining) {
    return 'Corvettes '+Math.max(0,(start.corvette||0)-remaining.corvette)+
      ', frigates '+Math.max(0,(start.frigate||0)-remaining.frigate)+
      ', cruisers '+Math.max(0,(start.cruiser||0)-remaining.cruiser);
  }
  return Object.freeze({STATS,composition,createUnits,summary,ensure,start,reinforce,advance,sync,losses});
})();
