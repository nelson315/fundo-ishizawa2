const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

app.use(cors());
app.use(express.json({limit:'20mb'}));

app.post('/analyze', async (req, res) => {
  try {
    const {image, mediaType, anthropicKey} = req.body;
    
    // Claude Vision
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key': anthropicKey || process.env.ANTHROPIC_KEY,
        'anthropic-version':'2023-06-01'
      },
      body: JSON.stringify({
        model:'claude-opus-4-5',
        max_tokens:2000,
        messages:[{role:'user',content:[
          {type:'image',source:{type:'base64',media_type:mediaType,data:image}},
          {type:'text',text:`Eres un agrónomo peruano experto con 25 años en fundos de la costa peruana. Analizas cultivos del Fundo Ishizawa: Palta Hass/Fuerte/Naval/Villacampa, Uva Quebranta/Borgoña, Lúcuma, Mandarina Okitsu/Río, Toronja, Limón, Caqui, Manzana de Caña.

IDENTIFICACIÓN VISUAL:
- Palto: hojas ovaladas grandes 10-20cm, verde oscuro brillante, nervadura central gruesa
- Mandarina/Cítricos: hojas pequeñas 5-8cm elípticas, peciolo alado, brillo intenso
- Uva: hojas lobuladas 5 puntas
- Lúcuma: hojas grandes 15-25cm, verde oscuro mate

Analiza y responde:

🌿 CULTIVO: [nombre exacto]
🔍 PROBLEMA: [nombre científico + nombre común]
📍 PARTE: [hoja/tallo/raíz/fruto]
🚨 SEVERIDAD: [Leve/Moderado/Grave] — [% área afectada]

📊 DIAGNÓSTICO TÉCNICO:
[síntomas precisos, propagación, condiciones]

🌱 ESTADO FENOLÓGICO:
[etapa actual en costa peruana]

🌿 ESTADO NUTRICIONAL:
[deficiencias con valores de referencia: N 1.8-2.5%, Fe 60-200ppm, Zn 30-100ppm, Ca 1-2%, B 20-60ppm, Mg 0.3-0.8%, K 0.75-2%]

💊 TRATAMIENTO PARA FUNDO COMERCIAL:
Paso 1: [para cientos de árboles]
Paso 2: [producto + dosis en ml/L o g/L]
Paso 3: [volumen: paltos 800-1200 L/ha, cítricos 600-800 L/ha]

🧪 PRODUCTOS EN PERÚ:
- [nombre comercial] — [dosis] — S/[precio]/litro o kg

🛒 INSUMOS PARA 1 HA:
[cantidades exactas]

⏰ CUÁNDO APLICAR:
[hora, temperatura, humedad]

🛡️ PREVENCIÓN 4 SEMANAS:
[medidas específicas]

⚡ URGENCIA: [Sí/No] — [razón y días]`}
        ]}]
      })
    });
    
    const claudeData = await claudeRes.json();
    if(claudeData.error) return res.status(400).json({error:claudeData.error.message});
    res.json({resultado: claudeData.content[0].text});
    
  } catch(err) {
    res.status(500).json({error: err.message});
  }
});

app.post('/plantid', async (req, res) => {
  try {
    const {image, mediaType} = req.body;
    const pidRes = await fetch('https://plant.id/api/v3/health_assessment', {
      method:'POST',
      headers:{'Api-Key': process.env.PLANTID_KEY || 'j3YfMbsXc1cSu5LhuPgcLz1QgQIuqIoyo7b69WZ30NVG9j2NCe','Content-Type':'application/json'},
      body: JSON.stringify({images:['data:'+mediaType+';base64,'+image],health:'all'})
    });
    const data = await pidRes.json();
    res.json(data);
  } catch(err) {
    res.status(500).json({error: err.message});
  }
});

app.get('/', (req,res) => res.json({status:'ok', service:'Fundo Ishizawa API'}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port', PORT));
