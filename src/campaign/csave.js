// Speichern und Laden der Kampagne. Die Karte selbst entsteht beim Laden aus dem Startwert neu.
import { C, setCampaign } from './cstate.js';

const KEY = 'aschenmark.campaign.v1';
export function serializeCampaign() { return JSON.stringify(C); }
export function deserializeCampaign(text) {
  const c = JSON.parse(text);
  if (!c || c.v !== 1 || !Array.isArray(c.provs)) throw new Error('Kampagnenstand passt nicht zu dieser Version');
  c.pending ||= []; // Stände vor den Echtzeit-Schlachten
  c.offers ||= []; c.events ||= []; if (!c.dip) { c.dip = {}; const F = Object.keys(c.emp); for (const a of F) for (const b of F) if (a < b) c.dip[a + '|' + b] = { st: 'war', since: 1, truce: 0 }; } // vor der Diplomatie: alle im Krieg
  for (const e of Object.values(c.emp || {})) { // Stände vor dem Forschungsbaum
    e.ctech ||= {}; e.traits ||= [];
    if (e.research && e.research.need === undefined) e.research = null;
  }
  setCampaign(c); return c;
}
export function saveCampaign() { try { localStorage.setItem(KEY, serializeCampaign()); return true; } catch (_) { return false; } }
export function hasCampaign() { try { return !!localStorage.getItem(KEY); } catch (_) { return false; } }
export function loadCampaign() { try { const t = localStorage.getItem(KEY); return t ? deserializeCampaign(t) : null; } catch (_) { return null; } }
export function dropCampaign() { try { localStorage.removeItem(KEY); } catch (_) {} }
