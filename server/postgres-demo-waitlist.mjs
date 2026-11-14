/**
 * PostgreSQL FIFO waiting room for localhost DEMO only.
 * Never trust queue positions, buyer IDs or admission flags from a client.
 * Every transition is serialized per event with a transaction-scoped advisory lock.
 * Prerequisite: db/005_demo_waitlist.sql. This does not reserve or sell real tickets.
 */
import { eventRequiresWaitingRoom, WAITLIST_ADMISSION_SLOTS, WAITLIST_MAX_ENTRIES,
 WAITLIST_ADMISSION_TTL_MS, WAITLIST_PENDING_TTL_MS } from "../src/waiting-room.mjs";

const bad=(status,message)=>Object.assign(new Error(message),{status});
const buyerOk=id=>typeof id==="string"&&/^buyer-[0-9a-f-]{36}$/i.test(id);
const validEvent=id=>typeof id==="string"&&/^demo-[a-z0-9-]{3,100}$/i.test(id);
export function createPostgresDemoWaitlist({pool,catalog}){
 const eventMap=new Map(catalog.events.map(e=>[e.id,e]));
 function validate(eventId,buyerId){
  if(!validEvent(eventId))throw bad(422,"Evento de espera inválido");
  if(!buyerOk(buyerId))throw bad(401,"Sesión de comprador inválida");
  const event=eventMap.get(eventId);
  if(!event||event.status!=="published")throw bad(422,"Evento DEMO no publicado");
  return event;
 }
 async function lock(client,eventId){
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
   ["paselisto-waitlist:"+eventId]);
 }
 async function reconcile(client,eventId){
  // All callers hold the same event lock before touching this queue.
  await client.query(`UPDATE demo_waitlist SET status='expired',expires_at=NULL
   WHERE event_id=$1 AND
   ((status='admitted' AND expires_at<=clock_timestamp())
     OR (status='waiting' AND joined_at<=clock_timestamp()-($2::bigint * interval '1 millisecond')))`,
   [eventId,WAITLIST_PENDING_TTL_MS]);
  const {rows}=await client.query(
   "SELECT count(*)::int AS n FROM demo_waitlist WHERE event_id=$1 AND status='admitted'",
   [eventId]);
  const free=Math.max(0,WAITLIST_ADMISSION_SLOTS-Number(rows[0].n));
  if(!free)return;
  await client.query(`WITH next AS (
    SELECT entry_id FROM demo_waitlist WHERE event_id=$1 AND status='waiting'
    ORDER BY joined_at,entry_id LIMIT $2 FOR UPDATE
   )
   UPDATE demo_waitlist SET status='admitted',admitted_at=clock_timestamp(),
    expires_at=clock_timestamp()+($3::bigint * interval '1 millisecond')
   WHERE entry_id IN (SELECT entry_id FROM next)`,
   [eventId,free,WAITLIST_ADMISSION_TTL_MS]);
 }
 async function position(client,eventId,buyerId){
  const {rows}=await client.query(
   "SELECT entry_id,status,joined_at,expires_at FROM demo_waitlist WHERE event_id=$1 AND buyer_id=$2",
   [eventId,buyerId]);
  if(!rows.length)return {required:true,status:"not_joined",position:null};
  const row=rows[0];let place=null;
  if(row.status==="waiting"){
   const rank=await client.query(`SELECT rn::int AS n FROM (
    SELECT buyer_id, row_number() OVER (ORDER BY joined_at,entry_id) AS rn
    FROM demo_waitlist WHERE event_id=$1 AND status='waiting'
   ) queued WHERE buyer_id=$2`,[eventId,buyerId]);
   place=Number(rank.rows[0]?.n||0);
  }
  return {required:true,status:row.status,position:place,
   expiresAt:row.status==="admitted"?new Date(row.expires_at).getTime():null};
 }
 async function transaction(eventId,buyerId,action){
  const event=validate(eventId,buyerId);
  if(!eventRequiresWaitingRoom(event)){
   if(action==="join")throw bad(422,"Este evento no requiere lista de espera");
   return {required:false,status:"disabled",position:0};
  }
  const client=await pool.connect();let active=false;
  try{
   await client.query("BEGIN");active=true;await lock(client,eventId);
   await reconcile(client,eventId);
   if(action==="join"){
    const limit=event.maxTicketsPerPerson??7;
    const total=await client.query(
     "SELECT COALESCE(SUM(quantity),0)::int AS n FROM demo_orders WHERE event_id=$1 AND buyer_id=$2 AND status='demo_confirmed'",
     [eventId,buyerId]);
    if(Number(total.rows[0].n)>=limit)throw bad(409,"Ya alcanzaste el máximo de boletos para este evento");
    const exists=await client.query(
     "SELECT status FROM demo_waitlist WHERE event_id=$1 AND buyer_id=$2 FOR UPDATE",
     [eventId,buyerId]);
    if(!exists.rows.length||!["waiting","admitted"].includes(exists.rows[0].status)){
     const size=await client.query(
      "SELECT count(*)::int AS n FROM demo_waitlist WHERE event_id=$1 AND status IN ('waiting','admitted')",
      [eventId]);
     if(Number(size.rows[0].n)>=WAITLIST_MAX_ENTRIES)
      throw bad(429,"Lista de espera temporalmente completa");
     await client.query(`INSERT INTO demo_waitlist(event_id,buyer_id,status,joined_at)
       VALUES($1,$2,'waiting',clock_timestamp())
       ON CONFLICT(event_id,buyer_id)
       DO UPDATE SET status='waiting',joined_at=clock_timestamp(),admitted_at=NULL,expires_at=NULL
       WHERE demo_waitlist.status NOT IN('waiting','admitted')`,
       [eventId,buyerId]);
    }
   }else if(action==="leave"){
    await client.query(`UPDATE demo_waitlist SET status='cancelled',expires_at=NULL
     WHERE event_id=$1 AND buyer_id=$2 AND status IN('waiting','admitted')`,
     [eventId,buyerId]);
   }
   await reconcile(client,eventId);
   const result=await position(client,eventId,buyerId);
   await client.query("COMMIT");active=false;
   return result;
  }catch(error){if(active)await client.query("ROLLBACK");throw error}
  finally{client.release()}
 }
 async function requireAdmission(client,{eventId,buyerId}){
  const event=validate(eventId,buyerId);
  if(!eventRequiresWaitingRoom(event))return null;
  await lock(client,eventId);
  await reconcile(client,eventId);
  const {rows}=await client.query(`SELECT entry_id,status,expires_at
   FROM demo_waitlist WHERE event_id=$1 AND buyer_id=$2 FOR UPDATE`,
   [eventId,buyerId]);
  if(!rows.length||rows[0].status!=="admitted"||new Date(rows[0].expires_at).getTime()<=Date.now())
   throw bad(409,"Debes esperar tu turno autorizado antes de comprar");
  return rows[0].entry_id;
 }
 async function consumeAdmission(client,entryId,eventId){
  if(entryId===null)return;
  const result=await client.query(`UPDATE demo_waitlist SET status='used',expires_at=NULL
   WHERE entry_id=$1 AND event_id=$2 AND status='admitted' RETURNING entry_id`,
   [entryId,eventId]);
  if(result.rowCount!==1)throw bad(409,"El turno de espera ya no está disponible");
  await reconcile(client,eventId);
 }
 return {
  joinWaitingRoom:({eventId,buyerId})=>transaction(eventId,buyerId,"join"),
  leaveWaitingRoom:({eventId,buyerId})=>transaction(eventId,buyerId,"leave"),
  waitlistStatus:({eventId,buyerId})=>transaction(eventId,buyerId,"status"),
  requireAdmission,consumeAdmission
 };
}
