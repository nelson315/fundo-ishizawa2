const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

app.use(cors());
app.use(express.json({limit:'20mb'}));

const PLANTID_KEY    = process.env.PLANTID_KEY    || '';
const CROPHEALTH_KEY = process.env.CROPHEALTH_KEY || '';
const ANTHROPIC_KEY  = process.env.ANTHROPIC_KEY  || '';

function estadoFenologico(cultivo) {
  const mes = new Date().getMonth() + 1;
  const c = (cultivo||'').toLowerCase();
  if(c.includes('palt')||c.includes('avocado')) {
    if(mes>=1&&mes<=3) return 'Floración/Cuajado — etapa crítica, máximo cuidado con hongos';
    if(mes>=4&&mes<=7) return 'Desarrollo de fruto — crítico para K y agua';
    if(mes>=8&&mes<=10) return 'Maduración — reducir N, aumentar K';
    return 'Reposo/Brotación — preparar para próxima floración';
  }
  if(c.includes('mandarin')||c.includes('citrus')||c.includes('citro')||c.includes('naranjo')) {
    if(mes>=2&&mes<=4) return 'Floración — crítico para Zn y B';
    if(mes>=5&&mes<=8) return 'Desarrollo de fruto';
    return 'Post-cosecha / Mantenimiento';
  }
  if(c.includes('grape')||c.includes('uva')||c.includes('vid')||c.includes('vitis')) {
    if(mes>=12||mes<=2) return 'Envero/Cosecha — crítico K y Ca';
    if(mes>=3&&mes<=5) return 'Post-cosecha/Poda';
    return 'Brotación/Desarrollo vegetativo';
  }
  return 'Verificar etapa fenológica con agrónomo';
}

app.post('/analyze', async (req, res) => {
  try {
    const {image, mediaType} = req.body;
    const imageDataUrl = 'data:' + mediaType + ';base64,' + image;

    let cultivoDetectado = 'No determinado';
    let plantIdInfo = '';
    let enfermedades = [];
    let cropResults = [];

    // --- crop.health ---
    try {
      const cropRes = await fetch('https://crop.kindwise.com/api/v1/identification', {
        method: 'POST',
        headers: {'Api-Key': CROPHEALTH_KEY, 'Content-Type': 'application/json'},
        body: JSON.stringify({images: [imageDataUrl], similar_images: false})
      });
      const cropData = await cropRes.json();
      if (cropData?.result?.crop?.suggestions?.length) {
        cultivoDetectado = cropData.result.crop.suggestions[0].name;
      }
      if (cropData?.result?.disease?.suggestions?.length) {
        cropResults = cropData.result.disease.suggestions.slice(0, 4);
      }
    } catch(e) { console.log('crop.health error:', e.message); }

    // --- plant.id ---
    try {
      const pidRes = await fetch('https://plant.id/api/v3/health_assessment', {
        method: 'POST',
        headers: {'Api-Key': PLANTID_KEY, 'Content-Type': 'application/json'},
        body: JSON.stringify({images: [imageDataUrl], health: 'all', similar_images: false})
      });
      const pidData = await pidRes.json();
      if (pidData?.result?.classification?.suggestions?.length) {
        if (cultivoDetectado === 'No determinado') {
          cultivoDetectado = pidData.result.classification.suggestions[0].name;
        }
      }
      if (pidData?.result?.disease?.suggestions?.length) {
        enfermedades = pidData.result.disease.suggestions.slice(0, 4);
      }
    } catch(e) { console.log('plant.id error:', e.message); }

    // Combinar y resumir para Claude
    const todasEnf = [...cropResults, ...enfermedades]
      .filter(e => e.probability > 0.05)
      .sort((a,b) => b.probability - a.probability)
      .slice(0, 5);

    if (todasEnf.length) {
      plantIdInfo = `Cultivo identificado: ${cultivoDetectado}. Problemas detectados: ${todasEnf.map(e=>`${e.name} (${(e.probability*100).toFixed(0)}%)`).join(', ')}.`;
    } else {
      plantIdInfo = `Cultivo identificado: ${cultivoDetectado}. Sin problemas claros detectados por las APIs especializadas.`;
    }

    const fenologia = estadoFenologico(cultivoDetectado);

    // --- Claude Vision ---
    const prompt = `Eres un agrónomo peruano experto con 25 años en fundos de la costa peruana (Ica, Lima, La Libertad). Analizas el Fundo Ishizawa (29.4 há): Palta Hass/Fuerte/Naval/Villacampa, Uva Quebranta/Borgoña, Lúcuma, Mandarina Okitsu/Río, Toronja, Limón, Caqui, Manzana de Caña.

APIs especializadas ya procesaron la imagen:
${plantIdInfo}
Estado fenológico estimado: ${fenologia}

Analiza la imagen y responde EXACTAMENTE en este formato (sin introducción, empieza directo):

🌿 CULTIVO: [nombre exacto del cultivo visible]
🔍 PROBLEMA: [nombre científico + nombre común peruano]
📍 PARTE AFECTADA: [hoja/tallo/raíz/fruto/planta completa]
🚨 SEVERIDAD: [Leve/Moderado/Grave] — [% área afectada estimado]

📊 DIAGNÓSTICO TÉCNICO:
[Descripción precisa de síntomas observados, mecanismo de daño, condiciones que favorecen el problema: temperatura/humedad/época del año]

🌱 ESTADO FENOLÓGICO:
[Etapa actual en la costa peruana y su implicancia para el manejo]

🌿 ESTADO NUTRICIONAL:
[Deficiencias o excesos detectados visualmente. Valores de referencia: N 1.8-2.5%, Fe 60-200ppm, Zn 30-100ppm, Ca 1-2%, B 20-60ppm, Mg 0.3-0.8%, K 0.75-2%]

💊 TRATAMIENTO PARA FUNDO COMERCIAL (cientos de árboles):
Paso 1: [acción inmediata concreta]
Paso 2: [producto principal + dosis exacta en ml/L o g/L]
Paso 3: [producto complementario si aplica + dosis]
Volumen de caldo: paltos 800-1200 L/ha | cítricos 600-800 L/ha | uvas 400-600 L/ha
[Poda sanitaria: desinfectar tijeras en lejía 5% entre árbol y árbol]

🧪 PRODUCTOS DISPONIBLES EN PERÚ:
- [Nombre comercial] — [ingrediente activo] — [dosis exacta] — S/[precio referencial]/litro o kg
- [Alternativa comercial] — [dosis]
- [Tercera opción si existe]

🛒 INSUMOS PARA 1 HECTÁREA:
[lista con cantidades exactas y costo estimado en soles]

⏰ MOMENTO DE APLICACIÓN:
[hora del día ideal, temperatura máxima, humedad, días después de lluvia, frecuencia]

🛡️ PREVENCIÓN PRÓXIMAS 4 SEMANAS:
[3-4 medidas específicas para este cultivo y problema, no genéricas]

⚡ URGENCIA: [Crítica — actuar HOY / Alta — actuar en 3 días / Moderada — actuar en 5-7 días / Baja — puede esperar] — [razón concreta]`;

    if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_KEY no configurada en el servidor. Agregar en Render > Environment.');

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            {type: 'image', source: {type: 'base64', media_type: mediaType, data: image}},
            {type: 'text', text: prompt}
          ]
        }]
      })
    });

    const rawText = await claudeRes.text();
    let claudeData;
    try { claudeData = JSON.parse(rawText); }
    catch(e) { throw new Error('Anthropic API error (HTTP ' + claudeRes.status + '): respuesta no válida. Verifica la ANTHROPIC_KEY en Render.'); }
    if (claudeData.error) throw new Error('Claude error ' + claudeRes.status + ': ' + claudeData.error.message);
    const resultado = claudeData.content?.[0]?.text || 'Sin respuesta de Claude';

    const sevMatch = resultado.match(/🚨 SEVERIDAD:\s*(Leve|Moderado|Grave)/i);
    const cultivoMatch = resultado.match(/🌿 CULTIVO:\s*(.+)/);
    const severidad = sevMatch?.[1] || 'Moderado';
    const cultivo = cultivoMatch?.[1]?.trim() || cultivoDetectado;

    res.json({
      resultado,
      cultivo,
      enfermedades: todasEnf,
      severidad,
      saludable: todasEnf.length === 0,
      plantIdInfo
    });

  } catch(err) {
    console.error('Error en /analyze:', err.message);
    res.status(500).json({error: err.message});
  }
});

app.get('/', (req, res) => res.json({
  status: 'ok',
  service: 'Fundo Ishizawa API',
  version: '2.3',
  actualizado: '28/03/2026',
  apis: ['plant.id', 'crop.health', 'Claude Vision claude-opus-4-6']
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Fundo Ishizawa API v2.3 corriendo en puerto', PORT));
