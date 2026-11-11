import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {buildBuyerServer} from "../server/buyer-server.mjs";

test("servidor local: espera masiva ligada a sesión, sin pedidos que salten cola",async t=>{
 const dir=await mkdtemp(join(tmpdir(),"paselisto-waiting-"));
 const {server,ready}=buildBuyerServer({filePath:join(dir,"buyers.json")});
 await ready;
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 t.after(async()=>{
  await new Promise(resolve=>server.close(resolve));
  await rm(dir,{recursive:true,force:true});
 });
 const origin="http://127.0.0.1:"+server.address().port;
 const eventId="demo-festival-masivo-2027";
 const request=async(path,{method="GET",cookie="",body,originOverride}={})=>{
  const headers={"X-PaseListo-Request":"1",Accept:"application/json"};
  if(method==="POST"){headers.Origin=originOverride??origin;headers["Content-Type"]="application/json";}
  if(cookie)headers.Cookie=cookie;
  const response=await fetch(origin+"/api/buyer/"+path,{
   method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{})
  });
  const result=await response.json();
  return {status:response.status,result,cookie:response.headers.get("set-cookie")?.split(";")[0]};
 };
 assert.equal((await request("waitlist/status?eventId="+eventId)).status,401);
 const signup=await request("register",{method:"POST",body:{
  email:"waitlist-demo1@example.invalid",password:"exclusiva-demo-muy-larga-01"
 }});
 assert.equal(signup.status,201);
 const cookie=signup.cookie;
 const forged={eventId,buyerId:"buyer-forged-000000000000000000000",status:"admitted",position:0};
 const noTurn=await request("orders",{method:"POST",cookie,body:{
  eventId,ticketTypeId:"general",quantity:1,requestId:"waitlist-order-before-001"
 }});
 assert.equal(noTurn.status,409);
 assert.match(noTurn.result.error,/turno autorizado/);
 const joined=await request("waitlist/join",{method:"POST",cookie,body:forged});
 assert.equal(joined.status,200);
 assert.equal(joined.result.status,"admitted");
 assert.ok(joined.result.expiresAt>Date.now());
 const status=await request("waitlist/status?eventId="+eventId,{cookie});
 assert.equal(status.result.status,"admitted");
 const attack=await request("waitlist/join",{method:"POST",cookie,body:forged,originOverride:"https://evil.example"});
 assert.equal(attack.status,403);
 const orderBody={eventId,ticketTypeId:"general",quantity:7,requestId:"waitlist-order-confirm-001",admitted:true};
 const purchased=await request("orders",{method:"POST",cookie,body:orderBody});
 assert.equal(purchased.status,201);
 assert.equal(purchased.result.quantity,7);
 assert.match(purchased.result.id,/^SIM-/);
 const replay=await request("orders",{method:"POST",cookie,body:orderBody});
 assert.equal(replay.status,201);
 assert.equal(replay.result.id,purchased.result.id);
 assert.equal((await request("waitlist/status?eventId="+eventId,{cookie})).result.status,"used");
 const over=await request("waitlist/join",{method:"POST",cookie,body:{eventId}});
 assert.equal(over.status,409);
 const orderWithoutTurn=await request("orders",{method:"POST",cookie,body:{
  eventId,ticketTypeId:"general",quantity:1,requestId:"waitlist-order-extra-002"
 }});
 assert.equal(orderWithoutTurn.status,409);
 const signupTwo=await request("register",{method:"POST",body:{
  email:"waitlist-demo2@example.invalid",password:"exclusiva-demo-muy-larga-02"
 }});
 assert.equal(signupTwo.status,201);
 assert.equal((await request("waitlist/status?eventId="+eventId,{cookie:signupTwo.cookie})).result.status,"not_joined");
});
