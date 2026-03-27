const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

app.use(cors());
app.use(express.json({limit:'20mb'}));

const PLANTID_KEY = 'j3YfMbsXc1cSu5LhuPgcLz1QgQIuqIoyo7b69WZ30NVG9j2NCe';
const CROPHEALTH_KEY = 'sy7qILWZk7RKaLlf2IVjQ5E9O1WgHnarg2oKovQTHomoP7W10J';

const TRATAMIENTOS = {
  'powdery mildew': { nombre: 'Oidio (Cenicilla)', tratamiento: 'Aplicar Azufre mojable (Thiovit Jet) 3 g/L. Volumen: 800 L/ha en paltos, 600 L/ha en cítricos. Aplicar en horas frescas (6-9am). Repetir cada 10 días.', productos: 'Thiovit Jet S/25-35/kg, Kumulus DF S/20-28/kg', urgencia: 'Moderada — actuar en 5 días' },
  'spider mite': { nombre: 'Arañita roja (Tetranychus urticae)', tratamiento: 'Aplicar Abamectina 0.5 ml/L + Aceite agrícola 5 ml/L. Mojar bien el envés. Volumen: 1000 L/ha. Repetir a los 7 días.', productos: 'Vertimec 1.8% EC S/45-60/L, Aceite agrícola S/18-25/L', urgencia: 'Alta — actuar en 3 días' },
  'whitefly': { nombre: 'Mosca blanca / Aleurotrachelus', tratamiento: 'Aplicar Buprofezin 1 ml/L + Imidacloprid 0.5 ml/L. Volumen: 800-1000 L/ha. Mojar envés de hojas.', productos: 'Applaud 25% S/80-100/kg, Confidor 350 SC S/55-70/L', urgencia: 'Moderada — actuar en 7 días' },
  'aphid': { nombre: 'Pulgón', tratamiento: 'Aplicar Imidacloprid 0.3 ml/L o Thiamethoxam 0.2 g/L. Agregar adherente. Volumen: 600-800 L/ha.', productos: 'Confidor S/55-70/L, Actara 25 WG S/180-220/kg', urgencia: 'Moderada — actuar en 5 días' },
  'anthracnose': { nombre: 'Antracnosis (Colletotrichum)', tratamiento: 'Aplicar Azoxystrobin 0.5 ml/L + Cobre 2 g/L. Volumen: 800-1200 L/ha. Aplicar preventivamente en floración.', productos: 'Amistar 50 WG S/180-220/kg, Kocide S/35-45/kg', urgencia: 'Alta — actuar en 3 días' },
  'phytophthora': { nombre: 'Phytophthora (Pudrición radicular)', tratamiento: 'Drench al suelo: Fosetil aluminio 3 g/L, 2-3 L por árbol. Mejorar drenaje. Evitar encharcamiento.', productos: 'Aliette 80 WG S/120-150/kg, Ridomil Gold S/140-180/kg', urgencia: 'Crítica — actuar HOY' },
  'iron deficiency': { nombre: 'Deficiencia de Hierro (Fe)', tratamiento: 'Aplicar Quelato de Fe foliar 3-5 g/L. Revisar pH suelo (ideal 5.5-6.5). Si pH>7, acidificar con Sulfato de aluminio.', productos: 'Fetrilon Combi S/90-120/kg, Quelatop Fe S/85-110/kg', urgencia: 'Moderada — aplicar en 7 días' },
  'nitrogen deficiency': { nombre: 'Deficiencia de Nitrógeno (N)', tratamiento: 'Aplicar Urea foliar 5 g/L o Nitrato de amonio al suelo 80-100 kg/ha. Fraccionar en 3 aplicaciones.', productos: 'Urea S/85-100/saco 50kg, Nitrato de amonio S/95-120/saco', urgencia: 'Moderada — aplicar en 10 días' },
  'leaf miner': { nombre: 'Minador de hoja (Phyllocnistis)', tratamiento: 'Aplicar Spinosad 0.5 ml/L en brotes tiernos. Alternar con Abamectina 0.5 ml/L. Aplicar cada 7 días durante brotación.', productos: 'Success 480 SC S/140-180/L, Vertimec S/45-60/L', urgencia: 'Moderada — actuar en 5 días' },
  'scale insect': { nombre: 'Queresa / Cochinilla', tratamiento: 'Aplicar Aceite mineral 1.5% + Clorpirifos 1.5 ml/L. Volumen: 1000-1200 L/ha. Aplicar en estado de ninfa.', productos: 'Aceite mineral S/18-25/L, Lorsban 48% S/35-45/L', urgencia: 'Moderada — actuar en 7 días' },
  'botrytis': { nombre: 'Botrytis (Moho gris)', tratamiento: 'Aplicar Iprodione 1.5 ml/L o Fludioxonil 0.5 ml/L. Mejorar ventilación. Aplicar en floración y cuajado.', productos: 'Rovral 50% S/95-120/kg, Switch 62.5 WG S/180-220/kg', urgencia: 'Alta en floración — actuar en 3 días' },
  'default': { nombre: 'Problema fitosanitario detectado', tratamiento: 'Enviar muestra a laboratorio para diagnóstico preciso. Mientras tanto, evitar estrés hídrico y aplicar Cobre 2 g/L como preventivo.', productos: 'Kocide 2000 S/35-45/kg', urgencia: 'Consultar agrónomo' }
};

function buscarTratamiento(nombre) {
  const n = (nombre||'').toLowerCase();
  for(const [key, val] of Object.entries(TRATAMIENTOS)) {
    if(n.includes(key)) return val;
  }
  return TRATAMIENTOS['default'];
}

function estadoFenologico(cultivo) {
  const mes = new Date().getMonth() + 1;
  const c = (cultivo||'').toLowerCase();
  if(c.includes('palt') || c.includes('avocado')) {
    if(mes>=1&&mes<=3) return 'Floración/Cuajado — etapa crítica, máximo cuidado con hongos';
    if(mes>=4&&mes<=7) return 'Desarrollo de fruto — crítico para K y agua';
    if(mes>=8&&mes<=10) return 'Maduración — reducir N, aumentar K';
    return 'Reposo/Brotación — preparar para próxima floración';
  }
  if(c.includes('mandarin')||c.includes('citrus')||c.includes('citro')) {
    if(mes>=2&&mes<=4) return 'Floración — crítico para Zn y B';
    if(mes>=5&&mes<=8) return 'Desarrollo de fruto';
    return 'Post-cosecha / Mantenimiento';
  }
  if(c.includes('grape')||c.includes('uva')||c.includes('vid')) {
    if(mes>=12||mes<=2) return 'Envero/Cosecha — crítico K y Ca';
    if(mes>=3&&mes<=5) return 'Post-cosecha/Poda';
    return 'Brotación/Desarrollo vegetativo';
  }
  return 'Verificar etapa fenológica con agrónomo';
}

app.post('/analyze', async (req, res) => {
  try {
    const {image, mediaType} = req.body;
    const imageData = 'data:' + mediaType + ';base64,' + image;
    
    let cultivoDetectado = 'No determinado';
    let enfermedades = [];
    let saludable = true;
    let cropResults = [];

    // Llamar crop.health
    try {
      const cropRes = await fetch('https://crop.kindwise.com/api/v1/identification', {
        method:'POST',
        headers:{'Api-Key': CROPHEALTH_KEY, 'Content-Type':'application/json'},
        body: JSON.stringify({images:[imageData], similar_images:false})
      });
      const cropData = await cropRes.json();
      if(cropData?.result?.crop?.suggestions?.length) {
        cultivoDetectado = cropData.result.crop.suggestions[0].name;
      }
      if(cropData?.result?.disease?.suggestions?.length) {
        cropResults = cropData.result.disease.suggestions.slice(0,4);
        saludable = cropData.result.is_healthy?.binary || false;
      }
    } catch(e) { console.log('crop.health error:', e.message); }

    // Llamar plant.id
    try {
      const pidRes = await fetch('https://plant.id/api/v3/health_assessment', {
        method:'POST',
        headers:{'Api-Key': PLANTID_KEY, 'Content-Type':'application/json'},
        body: JSON.stringify({images:[imageData], health:'all', similar_images:false})
      });
      const pidData = await pidRes.json();
      if(pidData?.result?.classification?.suggestions?.length) {
        if(cultivoDetectado === 'No determinado') {
          cultivoDetectado = pidData.result.classification.suggestions[0].name;
        }
      }
      if(pidData?.result?.disease?.suggestions?.length) {
        enfermedades = pidData.result.disease.suggestions.slice(0,4);
      }
    } catch(e) { console.log('plant.id error:', e.message); }

    // Combinar resultados
    const todasEnfermedades = [...cropResults, ...enfermedades]
      .filter(e => e.probability > 0.05)
      .sort((a,b) => b.probability - a.probability)
      .slice(0,4);

    const principal = todasEnfermedades[0];
    const trat = buscarTratamiento(principal?.name || '');
    const fenologia = estadoFenologico(cultivoDetectado);
    const severidad = principal?.probability > 0.6 ? 'Grave' : principal?.probability > 0.3 ? 'Moderado' : 'Leve';

    const resultado = `🌿 CULTIVO: ${cultivoDetectado}
🔍 PROBLEMA: ${trat.nombre}
🚨 SEVERIDAD: ${severidad} — ${principal ? (principal.probability*100).toFixed(0)+'% probabilidad' : 'Ver síntomas'}

📊 PROBLEMAS DETECTADOS:
${todasEnfermedades.map(e=>`• ${e.name}: ${(e.probability*100).toFixed(0)}%`).join('\n') || '• Sin problemas claros detectados'}

🌱 ESTADO FENOLÓGICO:
${fenologia}

💊 TRATAMIENTO PARA FUNDO COMERCIAL:
${trat.tratamiento}

🧪 PRODUCTOS DISPONIBLES EN PERÚ:
${trat.productos}

🛒 PARA 1 HECTÁREA:
Calcular según dosis indicada x volumen de caldo (800-1200 L/ha paltos, 600-800 L/ha cítricos)

⏰ CUÁNDO APLICAR:
Aplicar en horas frescas: 6-9am o después de las 5pm. Temperatura ideal menor a 30°C. No aplicar con viento fuerte.

🛡️ PREVENCIÓN PRÓXIMAS 4 SEMANAS:
Monitorear semanalmente. Registrar incidencia. Rotar productos para evitar resistencia.

⚡ URGENCIA: ${trat.urgencia}`;

    res.json({
      resultado,
      cultivo: cultivoDetectado,
      enfermedades: todasEnfermedades,
      severidad,
      saludable
    });

  } catch(err) {
    res.status(500).json({error: err.message});
  }
});

app.get('/', (req,res) => res.json({status:'ok', service:'Fundo Ishizawa API'}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port', PORT));
