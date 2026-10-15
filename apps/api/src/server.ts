import Fastify from 'fastify';
import cors from '@fastify/cors';
import {z} from 'zod';

type QuoteSource='WEB'|'MANUAL';
type VehicleSnapshot={brand:string;model:string;year:number;color:string;vin:string;chassisNumber:string};
type Quote={id:string;code:string;plate:string;vehicleType:string;department:string;documentType:string;documentNumber:string;startsAt:string;source:QuoteSource;status:'NUEVA';createdAt:string;vehicle?:VehicleSnapshot};

const app=Fastify({logger:true});
await app.register(cors,{origin:['http://localhost:3000','http://localhost:3001']});
const quotes:Quote[]=[];

const quoteInput=z.object({
  plate:z.string().trim().min(5).max(8).transform(value=>value.toUpperCase()),
  vehicleType:z.enum(['AUTO','MOTO','MOTOTAXI','VAN','CARGO']),
  department:z.string().min(2),
  documentType:z.enum(['DNI','CE','RUC']),
  documentNumber:z.string().min(8).max(11),
  startsAt:z.coerce.date(),
  vehicle:z.object({brand:z.string(),model:z.string(),year:z.number().int(),color:z.string(),vin:z.string(),chassisNumber:z.string()}).optional(),
  source:z.enum(['WEB','MANUAL']).default('WEB')
});

app.get('/health',async()=>({status:'ok',service:'falabella-insurance-api'}));
app.get('/v1/insurers',async()=>({data:[{id:'la-positiva',name:'La Positiva'},{id:'mapfre',name:'MAPFRE'},{id:'interseguro',name:'Interseguro'},{id:'pacifico',name:'Pacífico'},{id:'protecta',name:'Protecta'}],mode:'DEMO'}));
const autoCatalog=[{brand:'Toyota',model:'Yaris',year:2022,color:'Blanco',vehicleType:'AUTO'},{brand:'Kia',model:'Sportage',year:2021,color:'Gris',vehicleType:'AUTO'},{brand:'Hyundai',model:'Tucson',year:2023,color:'Negro',vehicleType:'AUTO'}] as const;
const motoCatalog=[{brand:'Honda',model:'CB 190R',year:2022,color:'Rojo',vehicleType:'MOTO'},{brand:'Suzuki',model:'Gixxer 150',year:2021,color:'Azul',vehicleType:'MOTO'},{brand:'Yamaha',model:'FZ 2.0',year:2023,color:'Negro',vehicleType:'MOTO'}] as const;
const verifiedDemoVehicles:Record<string,{brand:string;model:string;year:number;color:string;vehicleType:'MOTO';vin:string;chassisNumber:string}>={'1274-UP':{brand:'Suzuki',model:'GSX-R150 ABS',year:2026,color:'Negro',vehicleType:'MOTO',vin:'9FSDL23E3TC101115',chassisNumber:'9FSDL23E3TC101115'}};
const vehicleIdentifiers=(plate:string)=>{const seed=[...plate].reduce((total,char)=>((total*31)+char.charCodeAt(0))>>>0,17).toString(36).toUpperCase();const normalized=plate.replace(/[^A-Z0-9]/g,'');return {vin:`DEMO${normalized}${seed}`.slice(0,17).padEnd(17,'0'),chassisNumber:`CH-${normalized}-${seed}`}};
app.get('/v1/vehicles/:plate',async(req,reply)=>{const plate=z.string().trim().min(5).max(8).transform(value=>value.toUpperCase()).safeParse((req.params as {plate?:string}).plate);if(!plate.success)return reply.status(400).send({error:'INVALID_PLATE'});const verified=verifiedDemoVehicles[plate.data];if(verified)return {data:{plate:plate.data,...verified},mode:'DEMO_VERIFIED'};const catalog=/^\d{4}-[A-Z]{2}$/.test(plate.data)?motoCatalog:autoCatalog;const index=[...plate.data].reduce((total,char)=>total+char.charCodeAt(0),0)%catalog.length;return {data:{plate:plate.data,...catalog[index],...vehicleIdentifiers(plate.data)},mode:'DEMO'}});
app.get('/v1/quotes',async()=>({data:quotes,summary:{total:quotes.length,web:quotes.filter(q=>q.source==='WEB').length,manual:quotes.filter(q=>q.source==='MANUAL').length,pending:quotes.filter(q=>q.status==='NUEVA').length}}));
// Solo para reiniciar datos demostrativos durante el desarrollo local.
if(process.env.NODE_ENV!=='production')app.delete('/v1/dev/quotes',async(_req,reply)=>{
  quotes.splice(0,quotes.length);
  return reply.status(204).send();
});
app.post('/v1/quotes',async(req,reply)=>{
  const parsed=quoteInput.safeParse(req.body);
  if(!parsed.success)return reply.status(400).send({error:'VALIDATION_ERROR',details:parsed.error.flatten()});
  const now=new Date();
  const quote:Quote={id:crypto.randomUUID(),code:`COT-${now.getFullYear()}-${String(quotes.length+1).padStart(5,'0')}`,plate:parsed.data.plate,vehicleType:parsed.data.vehicleType,department:parsed.data.department,documentType:parsed.data.documentType,documentNumber:parsed.data.documentNumber,startsAt:parsed.data.startsAt.toISOString(),vehicle:parsed.data.vehicle,source:parsed.data.source,status:'NUEVA',createdAt:now.toISOString()};
  quotes.unshift(quote);
  return reply.status(201).send({data:quote,offers:[{insurer:'la-positiva',price:65},{insurer:'mapfre',price:68},{insurer:'pacifico',price:72}]});
});
app.post('/v1/orders',async(_req,reply)=>reply.status(501).send({error:'PAYMENT_PROVIDER_NOT_CONNECTED',message:'La emisión real se habilitará al configurar la pasarela y las integraciones de aseguradoras.'}));

const port=Number(process.env.API_PORT||4000);
await app.listen({port,host:'0.0.0.0'});
