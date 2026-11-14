// One public visibility contract for the store and the operations dashboard.
// References are NOT an authorization to sell tickets. No customer records here.
import { chileToday } from './week-events.mjs';
import { hasHeroPoster, hasEventDescription } from './hero-carousel.mjs';

const dateString = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const list = source => Array.isArray(source) ? source : Array.isArray(source?.events) ? source.events : [];

export function publicReferenceEvents(references, today = chileToday()) {
  return list(references).filter(event => event && dateString(event.date) &&
    (event.endDate || event.date) >= today &&
    hasHeroPoster(event, 'reference') &&
    hasEventDescription(event))
    .sort((a,b) => a.date.localeCompare(b.date));
}
export function catalogReconciliation(store, references, today = chileToday()) {
  const all = list(references);
  const displayed = publicReferenceEvents(all, today);
  const demos = Array.isArray(store?.events) ? store.events : [];
  const displayedIds = new Set(displayed.map(e => e.id));
  return {
    publicVisible: displayed.length,
    publicIds: displayed.map(e => e.id),
    referencesTotal: all.length,
    referencesArchived: all.filter(e => (e.endDate || e.date) < today).length,
    referencesNotInStore: all.filter(e => !displayedIds.has(e.id)).length,
    referencesMissingMediaOrDescription: all.filter(e =>
      (e.endDate || e.date) >= today &&
      (!hasHeroPoster(e, 'reference') || !hasEventDescription(e))).length,
    demoTotal: demos.length,
    demoPublished: demos.filter(e => e.status === 'published').length,
    demoPaused: demos.filter(e => e.status === 'paused').length,
    combinedTotal: all.length + demos.length
  };
}
export function managementEventRows(store, references, today = chileToday()) {
  const visibleIds = new Set(publicReferenceEvents(references, today).map(e => e.id));
  const referenceRows = list(references).map(e => {
    const expired = (e.endDate || e.date) < today;
    return {
      id:e.id, title:e.title, date:e.date, endDate:e.endDate || e.date,
      category:e.category || 'Otros', city:e.city || '—', venue:e.venue || '—',
      company:e.organizer || 'Sin contrato acreditado',
      kind:'reference', inStore:visibleIds.has(e.id), sold:0,
      capacity:null, status:expired?'ended':visibleIds.has(e.id)?'visible':'incomplete',
      statusLabel:expired?'Finalizado · referencia':visibleIds.has(e.id)?'En tienda · sin venta':'Sin ficha pública completa',
      canManage:false
    };
  });
  const organizations = new Map((store?.organizers || []).map(x => [x.id,x.name]));
  const demoRows = (store?.events || []).map(e => ({
    id:e.id, title:e.title, date:e.date, endDate:e.date,
    category:e.category || 'Otros', city:e.city || '—', venue:e.venue || '—',
    company:organizations.get(e.organizerId) || 'Organizador DEMO',
    kind:'demo', inStore:false,
    sold:(store?.orders || []).filter(o=>o.eventId===e.id && o.status==='demo_confirmed')
      .reduce((sum,o)=>sum+Number(o.quantity||0),0),
    capacity:(e.ticketTypes || []).reduce((sum,t)=>sum+Number(t.capacity||0),0),
    status:e.status==='paused'?'paused':e.date<today?'demo_ended':'demo_published',
    statusLabel:e.status==='paused'?'Pausado · DEMO':e.date<today?'Finalizado · DEMO':'Publicación interna · DEMO',
    canManage:true
  }));
  return [...referenceRows, ...demoRows].sort((a,b)=>a.date.localeCompare(b.date) || a.title.localeCompare(b.title,'es'));
}
