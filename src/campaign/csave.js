// Speichern und Laden der Kampagne. Die Karte selbst entsteht beim Laden aus dem Startwert neu.
import { C, setCampaign } from './cstate.js';

const KEY = 'aschenmark.campaign.v1';
export function serializeCampaign() { return JSON.stringify(C); }
export function deserializeCampaign(text) {
  const c = JSON.parse(text);
  if (!c || c.v !== 1 || !Array.isArray(c.provs)) throw new Error('Kampagnenstand passt nicht zu dieser Version');
  c.pending ||= []; // Stände vor den Echtzeit-Schlachten
  setCampaign(c); return c;
}
export function saveCampaign() { try { localStorage.setItem(KEY, serializeCampaign()); return true; } catch (_) { return false; } }
export function hasCampaign() { try { return !!localStorage.getItem(KEY); } catch (_) { return false; } }
export function loadCampaign() { try { const t = localStorage.getItem(KEY); return t ? deserializeCampaign(t) : null; } catch (_) { return null; } }
export function dropCampaign() { try { localStorage.removeItem(KEY); } catch (_) {} }
