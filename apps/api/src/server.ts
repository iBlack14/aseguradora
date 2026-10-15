import Fastify from 'fastify';import cors from '@fastify/cors';import {z} from 'zod';
const app=Fastify({logger:true});await app.register(cors,{origin:['http://localhost:3000','http://localhost:3001']});
const quoteInput=z.object({plate:z.string().min(5).max(8),vehicleType:z.enum(['AUTO','MOTO','MOTOTAXI','CARGO']),department:z.string().min(2),documentType:z.enum(['DNI','CE','RUC']),documentNumber:z.string().min(8).max(11),startsAt:z.coerce.date()});
app.get('/health',async()=>({status:'ok',service:'falabella-insurance-api'}));
app.get('/v1/insurers',async()=>({data:[{id:'la-positiva',name:'La Positiva'},{id:'mapfre',name:'MAPFRE'},{id:'interseguro',name:'Interseguro'},{id:'pacifico',name:'Pacífico'},{id:'protecta',name:'Protecta'}],mode:'DEMO'}));
app.post('/v1/quotes',async(req,reply)=>{const parsed=quoteInput.safeParse(req.body);if(!parsed.success)return reply.status(400).send({error:'VALIDATION_ERROR',details:parsed.error.flatten()});return reply.status(201).send({id:`COT-${Date.now()}`,status:'QUOTED',mode:'DEMO',offers:[{insurer:'la-positiva',price:65},{insurer:'mapfre',price:68},{insurer:'pacifico',price:72}]})});
app.post('/v1/orders',async(_req,reply)=>reply.status(501).send({error:'PAYMENT_PROVIDER_NOT_CONNECTED',message:'La emisión real se habilitará al configurar la pasarela y las integraciones de aseguradoras.'}));
const port=Number(process.env.API_PORT||4000);await app.listen({port,host:'0.0.0.0'});
