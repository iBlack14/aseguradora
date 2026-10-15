import Fastify from 'fastify';
import cors from '@fastify/cors';
import {z} from 'zod';

type QuoteSource='WEB'|'MANUAL';
type Quote={id:string;code:string;plate:string;vehicleType:string;department:string;documentType:string;documentNumber:string;startsAt:string;source:QuoteSource;status:'NUEVA';createdAt:string};

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
  source:z.enum(['WEB','MANUAL']).default('WEB')
});

app.get('/health',async()=>({status:'ok',service:'falabella-insurance-api'}));
app.get('/v1/insurers',async()=>({data:[{id:'la-positiva',name:'La Positiva'},{id:'mapfre',name:'MAPFRE'},{id:'interseguro',name:'Interseguro'},{id:'pacifico',name:'Pacífico'},{id:'protecta',name:'Protecta'}],mode:'DEMO'}));
app.get('/v1/quotes',async()=>({data:quotes,summary:{total:quotes.length,web:quotes.filter(q=>q.source==='WEB').length,manual:quotes.filter(q=>q.source==='MANUAL').length,pending:quotes.filter(q=>q.status==='NUEVA').length}}));
app.post('/v1/quotes',async(req,reply)=>{
  const parsed=quoteInput.safeParse(req.body);
  if(!parsed.success)return reply.status(400).send({error:'VALIDATION_ERROR',details:parsed.error.flatten()});
  const now=new Date();
  const quote:Quote={id:crypto.randomUUID(),code:`COT-${now.getFullYear()}-${String(quotes.length+1).padStart(5,'0')}`,plate:parsed.data.plate,vehicleType:parsed.data.vehicleType,department:parsed.data.department,documentType:parsed.data.documentType,documentNumber:parsed.data.documentNumber,startsAt:parsed.data.startsAt.toISOString(),source:parsed.data.source,status:'NUEVA',createdAt:now.toISOString()};
  quotes.unshift(quote);
  return reply.status(201).send({data:quote,offers:[{insurer:'la-positiva',price:65},{insurer:'mapfre',price:68},{insurer:'pacifico',price:72}]});
});
app.post('/v1/orders',async(_req,reply)=>reply.status(501).send({error:'PAYMENT_PROVIDER_NOT_CONNECTED',message:'La emisión real se habilitará al configurar la pasarela y las integraciones de aseguradoras.'}));

const port=Number(process.env.API_PORT||4000);
await app.listen({port,host:'0.0.0.0'});
