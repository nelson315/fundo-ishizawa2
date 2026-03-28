const express  = require('express');
const cors     = require('cors');
const fetch    = require('node-fetch');
const FormData = require('form-data');
const sharp    = require('sharp');
const app = express();

app.use(cors());
app.use(express.json({limit:'20mb'}));

// APIs existentes
const PLANTID_KEY    = process.env.PLANTID_KEY    || '';
const CROPHEALTH_KEY = process.env.CROPHEALTH_KEY || '';
const ANTHROPIC_KEY  = process.env.ANTHROPIC_KEY  || '';
// APIs nuevas
const PLANTNET_KEY   = process.env.PLANTNET_KEY   || '';
const INAT_TOKEN     = process.env.INAT_TOKEN     || '';
const AGRIO_KEY      = process.env.AGRIO_KEY      || '';
const GEMINI_KEY     = process.env.GEMINI_KEY     || '';
// Coordenadas exactas del Fundo Ishizawa - Huayán, Huaral, Lima, Perú
const FUNDO_LAT = -11.4521;
const FUNDO_LON = -77.1235;

// Base de conocimiento fitosanitario para el Fundo Ishizawa
const TRATAMIENTOS = {
  'powdery mildew':      { nombre:'Oidio / Cenicilla (Erysiphe sp.)', tratamiento:'Paso 1: Suspender riegos por aspersión.\nPaso 2: Aplicar Azufre mojable (Thiovit Jet) 3 g/L o Trifloxystrobin 0.3 ml/L.\nPaso 3: Volumen de caldo: paltos 1000 L/ha, cítricos 700 L/ha, uvas 500 L/ha.\nRepetir cada 10-12 días. Aplicar en horas frescas (6-9am).', productos:'• Thiovit Jet 80 WG — S/25-35/kg — dosis 3 g/L\n• Kumulus DF — S/20-28/kg — dosis 2.5 g/L\n• Flint 50 WG (Trifloxystrobin) — S/180-220/kg — dosis 0.3 g/L', compras:'Para 1 ha palto (1000 L caldo): Thiovit Jet 3 kg = S/90-105', urgencia:'Moderada — actuar en 5 días' },
  'spider mite':         { nombre:'Arañita roja (Tetranychus urticae / T. cinnabarinus)', tratamiento:'Paso 1: Mojar bien envés de hojas (ahí viven las arañitas).\nPaso 2: Aplicar Abamectina 1.8% EC 0.5 ml/L + Aceite agrícola 5 ml/L.\nPaso 3: Volumen: 1000-1200 L/ha en paltos. Repetir a los 7 días.\nRotar con Bifenazato 0.8 ml/L en segunda aplicación.', productos:'• Vertimec 1.8% EC (Abamectina) — S/45-60/L — dosis 0.5 ml/L\n• Floramite 240 SC (Bifenazato) — S/220-280/L — dosis 0.8 ml/L\n• Aceite agrícola — S/18-25/L — dosis 5 ml/L', compras:'Para 1 ha palto (1200 L): Vertimec 0.6 L = S/27-36, Aceite 6 L = S/108-150', urgencia:'Alta — actuar en 3 días' },
  'whitefly':            { nombre:'Mosca blanca / Aleurotrachelus (Bemisia tabaci)', tratamiento:'Paso 1: Mojar envés de hojas donde se concentran los adultos y ninfas.\nPaso 2: Aplicar Buprofezin 1 ml/L (regula desarrollo) + Imidacloprid 0.5 ml/L.\nPaso 3: Volumen: 800-1000 L/ha. Repetir a los 14 días.', productos:'• Applaud 25 SC (Buprofezin) — S/80-100/L — dosis 1 ml/L\n• Confidor 350 SC (Imidacloprid) — S/55-70/L — dosis 0.5 ml/L\n• Movento 150 OD (Spirotetramat) — S/280-320/L — dosis 0.75 ml/L', compras:'Para 1 ha (1000 L): Applaud 1 L = S/80-100, Confidor 0.5 L = S/28-35', urgencia:'Moderada — actuar en 7 días' },
  'aphid':               { nombre:'Pulgón / Áfido (Toxoptera aurantii, Aphis gossypii)', tratamiento:'Paso 1: Revisar brotes tiernos donde se concentran las colonias.\nPaso 2: Aplicar Imidacloprid 0.3 ml/L + adherente siliconado 0.5 ml/L.\nPaso 3: Volumen: 600-800 L/ha. Si hay hormigas asociadas, controlarlas también.', productos:'• Confidor 350 SC (Imidacloprid) — S/55-70/L — dosis 0.3 ml/L\n• Actara 25 WG (Thiamethoxam) — S/180-220/kg — dosis 0.2 g/L\n• Pirimicarb (Pirimor 50%) — S/140-170/kg — dosis 0.5 g/L (selectivo, cuida abejas)', compras:'Para 1 ha (800 L): Confidor 0.24 L = S/13-17', urgencia:'Moderada — actuar en 5 días' },
  'anthracnose':         { nombre:'Antracnosis (Colletotrichum gloeosporioides)', tratamiento:'Paso 1: Poda sanitaria de ramas con necrosis, desinfectar tijeras en lejía 5% entre árbol.\nPaso 2: Aplicar Azoxystrobin 0.5 ml/L + Cobre hidróxido 2 g/L.\nPaso 3: Volumen: 800-1200 L/ha. Aplicar preventivamente en floración.', productos:'• Amistar 50 WG (Azoxystrobin) — S/180-220/kg — dosis 0.5 g/L\n• Kocide 2000 (Hidróxido de cobre) — S/35-45/kg — dosis 2 g/L\n• Cabrio Top (Piraclostrobin+Metiram) — S/160-200/kg — dosis 1.5 g/L', compras:'Para 1 ha palto (1000 L): Amistar 0.5 kg = S/90-110, Kocide 2 kg = S/70-90', urgencia:'Alta — actuar en 3 días' },
  'phytophthora':        { nombre:'Phytophthora (Pudrición radicular / Tristeza del palto)', tratamiento:'Paso 1: Mejorar drenaje del suelo, evitar encharcamiento, reducir riego 30%.\nPaso 2: Drench al suelo con Fosetil aluminio 3 g/L, aplicar 3-4 L por árbol adulto.\nPaso 3: Complementar con Metalaxil-M (Ridomil Gold) 1.5 g/L drench mensual.\nAplicar también foliar con Fosetil 3 g/L.', productos:'• Aliette 80 WG (Fosetil aluminio) — S/120-150/kg — dosis 3 g/L\n• Ridomil Gold MZ (Metalaxil-M) — S/140-180/kg — dosis 1.5 g/L\n• Agri-Fos 400 — S/90-120/L — dosis 5 ml/L', compras:'Para 100 árboles (drench 3L/árbol = 300L): Aliette 0.9 kg = S/108-135', urgencia:'CRÍTICA — actuar HOY' },
  'iron deficiency':     { nombre:'Deficiencia de Hierro (Fe) — Clorosis férrica', tratamiento:'Paso 1: Revisar pH suelo (ideal 5.5-6.5 para paltos). Si pH >7, aplicar Azufre al suelo.\nPaso 2: Aplicar Quelato de Fe foliar (EDDHA) 3-5 g/L cada 15 días, 3 aplicaciones.\nPaso 3: Incorporar Sulfato ferroso al suelo 50-80 g/árbol adulto.', productos:'• Fetrilon Combi (Quelato Fe EDDHA) — S/90-120/kg — dosis 3-5 g/L\n• Quelatop Fe 13% — S/85-110/kg — dosis 3 g/L\n• Sulfato ferroso — S/15-20/kg — al suelo', compras:'Para 1 ha (1000 L foliar): Fetrilon 4 kg = S/360-480', urgencia:'Moderada — aplicar en 7 días' },
  'nitrogen deficiency': { nombre:'Deficiencia de Nitrógeno (N) — Amarillamiento generalizado', tratamiento:'Paso 1: Análisis foliar para confirmar (N <1.8% en palto = deficiencia).\nPaso 2: Aplicar Urea foliar 5 g/L + Nitrato de calcio 3 g/L, 2 aplicaciones cada 15 días.\nPaso 3: Fertigación con Nitrato de amonio 80-100 kg/ha, fraccionar en 3 aplicaciones.', productos:'• Urea agrícola 46% — S/85-100/saco 50kg — dosis foliar 5 g/L\n• Nitrato de calcio — S/95-120/saco 25kg — dosis 3 g/L\n• Ultrasol N (Nitrato de amonio) — S/85-95/saco 25kg', compras:'Para 1 ha (1000 L foliar): Urea 5 kg = S/8-10', urgencia:'Moderada — aplicar en 10 días' },
  'leaf miner':          { nombre:'Minador de hoja (Phyllocnistis citrella)', tratamiento:'Paso 1: Aplicar en brotaciones nuevas (brotes <2 cm), no en hojas maduras.\nPaso 2: Aplicar Spinosad 0.5 ml/L en brotes tiernos. Alternar con Abamectina 0.5 ml/L.\nPaso 3: Volumen: 600-800 L/ha. Aplicar cada 7-10 días durante brotación activa.', productos:'• Success 480 SC (Spinosad) — S/140-180/L — dosis 0.5 ml/L\n• Vertimec 1.8% EC (Abamectina) — S/45-60/L — dosis 0.5 ml/L\n• Tracer 120 SC (Spinosad) — S/130-160/L — dosis 0.4 ml/L', compras:'Para 1 ha cítrico (700 L): Success 0.35 L = S/49-63', urgencia:'Moderada — actuar en 5 días' },
  'scale insect':        { nombre:'Queresa / Cochinilla (Saissetia oleae, Aspidiotus nerii)', tratamiento:'Paso 1: Aplicar en estado de ninfa (escamas pequeñas, mayor vulnerabilidad).\nPaso 2: Aceite mineral emulsionable 1.5% + Clorpirifos 1.5 ml/L. Mojar bien ramas.\nPaso 3: Volumen: 1000-1200 L/ha. Repetir a los 21 días.', productos:'• Aceite mineral emulsionable — S/18-25/L — dosis 15 ml/L (1.5%)\n• Lorsban 48% EC (Clorpirifos) — S/35-45/L — dosis 1.5 ml/L\n• Movento 150 OD (Spirotetramat) — S/280-320/L — dosis 0.75 ml/L (sistémico)', compras:'Para 1 ha (1200 L): Aceite 18 L = S/324-450, Lorsban 1.8 L = S/63-81', urgencia:'Moderada — actuar en 7 días' },
  'botrytis':            { nombre:'Botrytis / Moho gris (Botrytis cinerea)', tratamiento:'Paso 1: Mejorar ventilación (poda de formación para abrir la copa).\nPaso 2: Aplicar Iprodione 1.5 g/L o Fludioxonil 0.5 ml/L en floración y cuajado.\nPaso 3: Volumen: 600-800 L/ha en uvas. Evitar mojar en horas de alta humedad.', productos:'• Rovral 50 SC (Iprodione) — S/95-120/L — dosis 1.5 ml/L\n• Switch 62.5 WG (Fludioxonil+Ciprodinil) — S/180-220/kg — dosis 0.8 g/L\n• Scala 40 SC (Pirimetanil) — S/140-175/L — dosis 1.5 ml/L', compras:'Para 1 ha uva (500 L): Switch 0.4 kg = S/72-88', urgencia:'Alta en floración — actuar en 3 días' },
  'rust':                { nombre:'Roya (Puccinia sp., Phakopsora sp.)', tratamiento:'Paso 1: Aplicar fungicida sistémico al primer síntoma (pústulas en envés).\nPaso 2: Tebuconazol 0.5 ml/L + Mancozeb 2 g/L. Volumen 800-1000 L/ha.\nPaso 3: Repetir cada 14 días. Máximo 3 aplicaciones por campaña.', productos:'• Folicur 250 EW (Tebuconazol) — S/75-95/L — dosis 0.5 ml/L\n• Dithane M-45 (Mancozeb) — S/25-35/kg — dosis 2 g/L\n• Headline (Piraclostrobin) — S/180-220/L — dosis 0.5 ml/L', compras:'Para 1 ha (1000 L): Folicur 0.5 L = S/38-48, Dithane 2 kg = S/50-70', urgencia:'Alta — actuar en 3 días' },
  'alternaria':          { nombre:'Alternaria / Mancha foliar (Alternaria alternata)', tratamiento:'Paso 1: Poda sanitaria de ramas afectadas, desinfectar tijeras en lejía 5%.\nPaso 2: Aplicar Difenoconazol 0.3 ml/L + Cobre oxicloruro 2.5 g/L.\nPaso 3: Volumen: 800-1000 L/ha. Aplicar preventivo en épocas de lluvia.', productos:'• Score 250 EC (Difenoconazol) — S/95-120/L — dosis 0.3 ml/L\n• Kocide 2000 (Cobre) — S/35-45/kg — dosis 2.5 g/L\n• Bravo 500 SC (Clorotalonil) — S/45-60/L — dosis 2 ml/L', compras:'Para 1 ha (1000 L): Score 0.3 L = S/29-36, Kocide 2.5 kg = S/88-113', urgencia:'Moderada — actuar en 7 días' },
  'healthy':             { nombre:'Planta aparentemente sana', tratamiento:'No se detectan problemas fitosanitarios graves.\nMantenimiento preventivo: Cobre 2 g/L + Zinc foliar 1 g/L mensual.\nRevisar nuevamente en 15 días.', productos:'• Kocide 2000 (Cobre) — S/35-45/kg — dosis 2 g/L (preventivo)\n• Quelato de Zinc — S/70-90/kg — dosis 1 g/L', compras:'Aplicación preventiva mensual: Kocide 2 kg = S/70-90', urgencia:'Baja — monitoreo rutinario' },
  'default':             { nombre:'Problema fitosanitario detectado', tratamiento:'Paso 1: Tomar muestras y enviar a laboratorio fitopatológico para diagnóstico exacto.\nPaso 2: Aplicar Cobre hidróxido 2 g/L como medida preventiva inmediata.\nPaso 3: Mejorar condiciones de riego y nutrición para reducir estrés.', productos:'• Kocide 2000 (Cobre hidróxido) — S/35-45/kg — dosis 2 g/L\n• Trichoderma (Biofungicida) — S/45-65/kg — dosis 3 g/L (preventivo)', compras:'Para 1 ha (1000 L): Kocide 2 kg = S/70-90', urgencia:'Consultar agrónomo en 5 días' }
};

function buscarTratamiento(nombre) {
  const n = (nombre||'').toLowerCase();
  const mapeo = {
    'powdery mildew':'powdery mildew','cenicilla':'powdery mildew','oidio':'powdery mildew',
    'spider mite':'spider mite','araña':'spider mite','aranita':'spider mite','tetranychus':'spider mite','mite':'spider mite',
    'whitefly':'whitefly','mosca blanca':'whitefly','bemisia':'whitefly','aleurotrachelus':'whitefly','aleuro':'whitefly',
    'aphid':'aphid','pulgon':'aphid','afido':'aphid','aphis':'aphid','toxoptera':'aphid',
    'anthracnose':'anthracnose','antracnosis':'anthracnose','colletotrichum':'anthracnose',
    'phytophthora':'phytophthora','pudricion':'phytophthora','tristeza':'phytophthora',
    'iron deficiency':'iron deficiency','iron':'iron deficiency','clorosis':'iron deficiency',
    'nitrogen deficiency':'nitrogen deficiency','nitrogen':'nitrogen deficiency','amarillamiento':'nitrogen deficiency',
    'leaf miner':'leaf miner','minador':'leaf miner','phyllocnistis':'leaf miner','miner':'leaf miner',
    'scale insect':'scale insect','queresa':'scale insect','cochinilla':'scale insect','saissetia':'scale insect','aspidiotus':'scale insect',
    'botrytis':'botrytis','moho gris':'botrytis','gray mold':'botrytis',
    'rust':'rust','roya':'rust','puccinia':'rust',
    'alternaria':'alternaria','mancha':'alternaria',
    'healthy':'healthy','sana':'healthy','no disease':'healthy'
  };
  for(const [key, val] of Object.entries(mapeo)) {
    if(n.includes(key)) return TRATAMIENTOS[val];
  }
  return TRATAMIENTOS['default'];
}

function estadoFenologico(cultivo) {
  const mes = new Date().getMonth() + 1;
  const c = (cultivo||'').toLowerCase();
  if(c.includes('palt')||c.includes('avocado')||c.includes('persea')) {
    if(mes>=1&&mes<=3) return 'Floración/Cuajado de fruto (Ene-Mar) — etapa MUY CRÍTICA: máximo cuidado con Phytophthora y hongos de flor. No exceder humedad.';
    if(mes>=4&&mes<=7) return 'Desarrollo de fruto (Abr-Jul) — crítico: K, Ca y riego. Controlar mosca blanca y queresa.';
    if(mes>=8&&mes<=10) return 'Maduración/Pre-cosecha (Ago-Oct) — reducir N, aumentar K. Controlar antracnosis post-cosecha.';
    return 'Reposo/Brotación vegetativa (Nov-Dic) — preparar árbol para próxima floración. Nutrición de base.';
  }
  if(c.includes('mandarin')||c.includes('citrus')||c.includes('naranjo')||c.includes('toronja')||c.includes('limon')||c.includes('citro')) {
    if(mes>=2&&mes<=4) return 'Floración y cuajado (Feb-Abr) — crítico: Zn, B y Ca foliar. Proteger con fungicidas cúpricos.';
    if(mes>=5&&mes<=8) return 'Engrosamiento de fruto (May-Ago) — controlar minador, pulgón y ácaro tostado.';
    if(mes>=9&&mes<=11) return 'Maduración (Set-Nov) — reducir N, aumentar K y Ca. Vigilar gomosis.';
    return 'Post-cosecha/Mantenimiento (Dic-Ene) — poda sanitaria y abonamiento de fondo.';
  }
  if(c.includes('grape')||c.includes('uva')||c.includes('vid')||c.includes('vitis')) {
    if(mes>=12||mes<=2) return 'Envero y cosecha (Dic-Feb) — crítico K y Ca. Máximo control de Botrytis y oidio en racimos.';
    if(mes>=3&&mes<=5) return 'Post-cosecha y poda (Mar-May) — aplicar fungicidas de poda, Trichoderma en cortes.';
    return 'Brotación y desarrollo vegetativo (Jun-Nov) — controlar trips, oidio y arañita en hojas.';
  }
  if(c.includes('lucuma')||c.includes('lúcuma')||c.includes('pouteria')) {
    return 'Lúcuma (floración escalonada todo el año) — controlar Saissetia (queresa) y Oidium. Aplicar cobre preventivo mensual.';
  }
  return 'Verificar etapa fenológica con el técnico de campo. Aplicar monitoreo semanal.';
}

function identificarCultivo(nombre) {
  const n = (nombre||'').toLowerCase();
  if(n.includes('avocado')||n.includes('palt')||n.includes('persea')) return 'Palto (Persea americana)';
  if(n.includes('mandarin')||n.includes('citrus reticulata')) return 'Mandarina';
  if(n.includes('grape')||n.includes('vitis')||n.includes('vid')) return 'Vid / Uva';
  if(n.includes('lucuma')||n.includes('pouteria')) return 'Lúcuma';
  if(n.includes('lemon')||n.includes('limon')||n.includes('citrus limon')) return 'Limón';
  if(n.includes('grapefruit')||n.includes('toronja')||n.includes('pomelo')) return 'Toronja';
  if(n.includes('persimmon')||n.includes('caqui')||n.includes('diospyros')) return 'Caqui';
  if(n.includes('apple')||n.includes('manzana')||n.includes('malus')) return 'Manzana de Caña';
  return nombre || 'Cultivo no determinado';
}

app.post('/analyze', async (req, res) => {
  try {
    const {image, mediaType} = req.body;
    const imageDataUrl = 'data:' + mediaType + ';base64,' + image;

    let cultivoRaw = '';
    let cropResults = [];
    let plantResults = [];
    let insultsResults = [];
    let climaInfo = '';
    let geminiInfo = '';
    let plantnetInfo = '';
    let inatInfo = '';
    let agrioInfo = '';
    let analisisNutricional = '';

    // --- Clima actual (Open-Meteo - gratis, sin API key) ---
    try {
      const wRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${FUNDO_LAT}&longitude=${FUNDO_LON}` +
        `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code` +
        `&forecast_days=1`
      );
      const w = await wRes.json();
      if (w.current) {
        const temp = w.current.temperature_2m;
        const hum  = w.current.relative_humidity_2m;
        const viento = w.current.wind_speed_10m;
        const lluvia = w.current.precipitation;
        const riesgoHongos = hum > 85 ? '⚠️ ALTO riesgo de hongos (humedad >85%) — postergar aplicaciones foliares' :
                             hum > 70 ? 'Riesgo moderado de hongos (humedad 70-85%)' :
                             'Riesgo bajo de hongos — condiciones favorables para aplicar';
        const riesgoAcaros = temp > 28 ? '⚠️ Temperatura alta (>28°C) — condiciones favorables para arañita roja' : '';
        climaInfo = `Clima actual Fundo Ishizawa (Huayán, Huaral): ${temp}°C, humedad ${hum}%, viento ${viento} km/h, lluvia ${lluvia}mm. ${riesgoHongos}${riesgoAcaros ? '. ' + riesgoAcaros : ''}.`;
        console.log('Clima OK:', climaInfo);
      }
    } catch(e) { console.log('Clima error:', e.message); }

    // --- crop.health (enfermedades de cultivos) ---
    try {
      const cropRes = await fetch('https://crop.kindwise.com/api/v1/identification', {
        method:'POST',
        headers:{'Api-Key':CROPHEALTH_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({images:[imageDataUrl],similar_images:false})
      });
      const d = await cropRes.json();
      if(d?.result?.crop?.suggestions?.length) cultivoRaw = d.result.crop.suggestions[0].name;
      if(d?.result?.disease?.suggestions?.length) cropResults = d.result.disease.suggestions.slice(0,6);
      console.log('crop.health OK — cultivo:', cultivoRaw, '— enf:', cropResults.map(e=>e.name+' '+Math.round(e.probability*100)+'%').join(', '));
    } catch(e) { console.log('crop.health error:', e.message); }

    // --- plant.id (identificación + salud) ---
    try {
      const pidRes = await fetch('https://plant.id/api/v3/health_assessment', {
        method:'POST',
        headers:{'Api-Key':PLANTID_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({images:[imageDataUrl],health:'all',similar_images:false})
      });
      const d = await pidRes.json();
      if(d?.result?.classification?.suggestions?.length && !cultivoRaw) {
        cultivoRaw = d.result.classification.suggestions[0].name;
      }
      if(d?.result?.disease?.suggestions?.length) plantResults = d.result.disease.suggestions.slice(0,6);
      console.log('plant.id OK — cultivo:', cultivoRaw, '— enf:', plantResults.map(e=>e.name+' '+Math.round(e.probability*100)+'%').join(', '));
    } catch(e) { console.log('plant.id error:', e.message); }

    // --- insect.id (Kindwise) ---
    try {
      const insRes = await fetch('https://insect.kindwise.com/api/v1/identification', {
        method:'POST',
        headers:{'Api-Key':CROPHEALTH_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({images:[imageDataUrl],similar_images:false})
      });
      const d = await insRes.json();
      if(d?.result?.classification?.suggestions?.length) {
        insultsResults = d.result.classification.suggestions.slice(0,3).filter(s=>s.probability>0.1);
        if(insultsResults.length) console.log('insect.id OK:', insultsResults.map(e=>e.name+' '+Math.round(e.probability*100)+'%').join(', '));
      }
    } catch(e) { console.log('insect.id error:', e.message); }

    // --- [4] Pl@ntNet — identificación botánica de alta precisión ---
    if(PLANTNET_KEY) {
      try {
        const imgBuffer = Buffer.from(image, 'base64');
        const fd = new FormData();
        fd.append('images', imgBuffer, {filename:'leaf.jpg', contentType: mediaType});
        fd.append('organs', 'leaf');
        const pnRes = await fetch(
          `https://my-api.plantnet.org/v2/identify/all?api-key=${PLANTNET_KEY}&lang=es&nb-results=3`,
          {method:'POST', body:fd, headers:fd.getHeaders()}
        );
        const pnData = await pnRes.json();
        if(pnData?.results?.length) {
          const top = pnData.results.slice(0,3);
          plantnetInfo = `Pl@ntNet identificó: ${top.map(r=>`${r.species?.commonNames?.[0]||r.species?.scientificNameWithoutAuthor} (${(r.score*100).toFixed(0)}%)`).join(', ')}.`;
          console.log('Pl@ntNet OK:', plantnetInfo);
        }
      } catch(e) { console.log('Pl@ntNet error:', e.message); }
    }

    // --- [5] iNaturalist — identificación de organismos/plagas ---
    if(INAT_TOKEN) {
      try {
        const imgBuffer = Buffer.from(image, 'base64');
        const fd2 = new FormData();
        fd2.append('image', imgBuffer, {filename:'photo.jpg', contentType: mediaType});
        const inatRes = await fetch('https://api.inaturalist.org/v1/computervision/score_image', {
          method:'POST',
          headers:{...fd2.getHeaders(), 'Authorization': `Bearer ${INAT_TOKEN}`},
          body: fd2
        });
        const inatData = await inatRes.json();
        if(inatData?.results?.length) {
          const top = inatData.results.slice(0,3);
          inatInfo = `iNaturalist detectó: ${top.map(r=>`${r.taxon?.preferred_common_name||r.taxon?.name} (${(r.combined_score*100).toFixed(0)}%)`).join(', ')}.`;
          console.log('iNaturalist OK:', inatInfo);
        }
      } catch(e) { console.log('iNaturalist error:', e.message); }
    }

    // --- [6] Agrio — enfermedades tropicales ---
    if(AGRIO_KEY) {
      try {
        const imgBuffer = Buffer.from(image, 'base64');
        const fd3 = new FormData();
        fd3.append('image', imgBuffer, {filename:'plant.jpg', contentType: mediaType});
        const agrioRes = await fetch('https://api.agrio.ag/v2/diagnose', {
          method:'POST',
          headers:{...fd3.getHeaders(), 'x-api-key': AGRIO_KEY},
          body: fd3
        });
        const agrioData = await agrioRes.json();
        if(agrioData?.diagnoses?.length) {
          agrioInfo = `Agrio detectó: ${agrioData.diagnoses.slice(0,3).map(d=>`${d.name} (${(d.confidence*100).toFixed(0)}%)`).join(', ')}.`;
          console.log('Agrio OK:', agrioInfo);
        }
      } catch(e) { console.log('Agrio error:', e.message); }
    }

    // --- [NUTRICIONAL] Análisis de píxeles con Sharp (NDVI + clorosis + necrosis) ---
    try {
      const imgBuffer = Buffer.from(image, 'base64');
      const {data, info} = await sharp(imgBuffer)
        .resize(300, 300, {fit:'inside'})
        .removeAlpha()
        .raw()
        .toBuffer({resolveWithObject:true});

      let sumR=0, sumG=0, sumB=0;
      let pixAmarillo=0, pixMarron=0, pixVerde=0, pixVerdOscuro=0, pixTotal=0;

      for(let i=0; i<data.length; i+=3) {
        const r=data[i], g=data[i+1], b=data[i+2];
        sumR+=r; sumG+=g; sumB+=b; pixTotal++;
        // Amarillo-verde pálido → déficit N, Fe, Mg
        if(r>160 && g>160 && b<110 && Math.abs(r-g)<60) pixAmarillo++;
        // Marrón/necrótico → déficit K, Ca o enfermedad
        else if(r>110 && g<90 && b<80) pixMarron++;
        // Verde oscuro saludable
        else if(g>r && g>b && g>100) { if(g>140) pixVerdOscuro++; else pixVerde++; }
      }

      const avgR = sumR/pixTotal, avgG = sumG/pixTotal, avgB = sumB/pixTotal;
      // NDVI aproximado desde RGB: (G-R)/(G+R)
      const ndvi = ((avgG-avgR)/(avgG+avgR+0.001)).toFixed(3);
      // Índice de clorofila: G/(R+B)
      const iClorofila = (avgG/(avgR+avgB+0.001)).toFixed(2);
      const pctAmarillo = (pixAmarillo/pixTotal*100).toFixed(1);
      const pctMarron   = (pixMarron/pixTotal*100).toFixed(1);
      const pctVerde    = ((pixVerde+pixVerdOscuro)/pixTotal*100).toFixed(1);

      // Diagnóstico nutricional automático
      const alertas = [];
      if(parseFloat(pctAmarillo)>25) alertas.push(`⚠️ ${pctAmarillo}% área amarilla — posible déficit N, Fe o Mg`);
      else if(parseFloat(pctAmarillo)>12) alertas.push(`⚠️ ${pctAmarillo}% área amarillenta — vigilar déficit N`);
      if(parseFloat(pctMarron)>15) alertas.push(`⚠️ ${pctMarron}% necrosis — posible déficit K, Ca o enfermedad`);
      if(parseFloat(ndvi)<0.05) alertas.push('⚠️ NDVI muy bajo — planta con estrés severo');
      else if(parseFloat(ndvi)<0.15) alertas.push('⚠️ NDVI bajo — estrés moderado');
      if(parseFloat(iClorofila)<0.5) alertas.push('⚠️ Clorofila baja — probable deficiencia nutricional');
      if(!alertas.length) alertas.push('✓ Colorimetría normal — sin señales de deficiencia grave');

      analisisNutricional = `ANÁLISIS NUTRICIONAL AUTOMÁTICO (Sharp/NDVI):
NDVI≈${ndvi} (saludable>0.2, estrés<0.1) | Clorofila≈${iClorofila}
Píxeles: verde ${pctVerde}% | amarillo ${pctAmarillo}% | necrótico ${pctMarron}%
${alertas.join('\n')}`;
      console.log('Análisis nutricional OK:', analisisNutricional.split('\n')[0]);
    } catch(e) { console.log('Sharp error:', e.message); }

    // Combinar y priorizar resultados
    const todasEnf = [...cropResults, ...plantResults]
      .sort((a,b) => b.probability - a.probability)
      .filter((e,i,arr) => arr.findIndex(x=>x.name===e.name)===i)
      .slice(0,6);

    // Si el usuario seleccionó el lote, ese cultivo es DEFINITIVO — no adivinar
    const {loteId, loteCultivo} = req.body;
    const cultivoConfirmado = loteCultivo || null;
    const cultivoNombre = cultivoConfirmado || identificarCultivo(cultivoRaw) || 'Cultivo del Fundo Ishizawa';
    const fenologia = estadoFenologico(cultivoConfirmado || cultivoRaw);

    const contextoLote = cultivoConfirmado
      ? `CULTIVO CONFIRMADO POR EL USUARIO (lote ${loteId}): ${cultivoConfirmado}. NO intentes identificar el cultivo — ya se sabe que es ${cultivoConfirmado}. Enfócate SOLO en diagnosticar el problema fitosanitario o nutricional visible.`
      : `El usuario no seleccionó lote. Identifica el cultivo visualmente usando las características descritas abajo.`;

    const apiBio = [
      todasEnf.length
        ? `crop.health + plant.id: ${todasEnf.map(e=>`${e.name} (${(e.probability*100).toFixed(0)}%)`).join(', ')}.`
        : `crop.health + plant.id: sin enfermedades con alta certeza — analiza visualmente.`,
      insultsResults.length ? `insect.id: ${insultsResults.map(e=>`${e.name} (${(e.probability*100).toFixed(0)}%)`).join(', ')}.` : '',
      plantnetInfo,
      inatInfo,
      agrioInfo,
      geminiInfo,
      analisisNutricional,
      climaInfo
    ].filter(Boolean).join('\n');

    // --- [GEMINI] Google Gemini Vision — segunda opinión IA ---
    let geminiInfo = '';
    if(GEMINI_KEY) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
          {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({
              contents:[{parts:[
                {inline_data:{mime_type: mediaType, data: image}},
                {text:`Eres experto en fitopatología de cultivos peruanos. Analiza esta foto y responde en 3-4 líneas en español:
1. ¿Qué cultivo es exactamente? (palta, lúcuma, mandarina, uva, etc.)
2. ¿Qué problema fitosanitario o nutricional ves? Nombre científico + síntomas específicos.
3. ¿Qué parte está afectada y qué porcentaje del tejido visible?
4. ¿Qué tan urgente es el tratamiento?
Sé preciso y directo. Si no hay problema, dilo claramente.`}
              ]}],
              generationConfig:{maxOutputTokens:400, temperature:0.2}
            })
          }
        );
        const gd = await geminiRes.json();
        const gText = gd?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if(gText) {
          geminiInfo = `GEMINI VISION (segunda opinión IA):\n${gText.trim()}`;
          console.log('Gemini OK:', gText.substring(0,100));
        }
      } catch(e) { console.log('Gemini error:', e.message); }
    }

    // --- Claude Vision (modelo actual) ---
    let resultado = '';
    let severidad = 'Moderado';

    if (ANTHROPIC_KEY) {
      try {
        const prompt = `Eres un agrónomo peruano experto con 25 años en fundos de la costa peruana. Analizas el Fundo Ishizawa (29.4 há, Huayán, Huaral, Lima): Palta Hass/Fuerte/Naval/Villacampa, Uva Quebranta/Borgoña, Lúcuma, Mandarina Okitsu/Río, Toronja, Limón, Caqui, Manzana de Caña.

${contextoLote}

GUÍA VISUAL DE CULTIVOS DEL FUNDO (para identificar si no hay lote seleccionado):
• PALTA (Persea americana): hojas ovaladas GRANDES 10-20cm, verde oscuro BRILLANTE, nervadura central gruesa, peciolo rojizo 2-3cm, borde entero liso, aromática al estrujar
• LÚCUMA (Pouteria lucuma): hojas GRANDES 15-25cm, elípticas, verde oscuro MATE (sin brillo), envés pálido grisáceo, nervadura pinnada, textura coriácea, NO confundir con palta — la lúcuma NO tiene brillo
• MANDARINA/CÍTRICOS (Citrus): hojas PEQUEÑAS 5-8cm, elípticas, brillo intenso en el haz, PECIOLO ALADO (característica única), olor cítrico, frutos esféricos pequeños naranja
• VID/UVA (Vitis vinifera): hojas LOBULADAS 5 puntas como mano abierta, venas muy pronunciadas, forma palmada inconfundible, zarcillos en tallos
• CAQUI (Diospyros kaki): hojas ovales 10-15cm, nervadura muy marcada, frutos naranjas esféricos en ramas
• MANZANA DE CAÑA (Malus domestica): hojas 4-8cm, bordes SERRADOS/dentados, verde medio, no brillante
• TORONJA/LIMÓN: similar a mandarina pero hojas más grandes (toronja) o con espinas (limón)

DATOS DE APIs ESPECIALIZADAS:
${apiBio}

Mes actual: Marzo 2026. Fundo en Huayán, Huaral, costa peruana.

Analiza la imagen con VISIÓN EXPERTA y responde EXACTAMENTE en este formato (empieza directo):

🌿 CULTIVO IDENTIFICADO: [${cultivoConfirmado ? cultivoConfirmado + ' — confirmado por lote seleccionado' : 'nombre exacto del cultivo que ves, siendo muy preciso con la guía visual'}]
🔍 PROBLEMA PRINCIPAL: [nombre científico + nombre común peruano]
📍 PARTE AFECTADA: [hoja / tallo / raíz / fruto / planta completa]
🚨 SEVERIDAD: [Leve / Moderado / Grave] — [% área afectada estimado]

📊 DIAGNÓSTICO TÉCNICO:
[Describe los síntomas exactos que ves: color, forma, distribución de manchas/lesiones. Mecanismo de daño, cómo se propaga, condiciones que lo favorecen (temperatura/humedad/época)]

🌱 ESTADO FENOLÓGICO (Costa Peruana — Marzo):
[Etapa actual y su importancia crítica para el manejo]

🧬 ANÁLISIS NUTRICIONAL VISUAL:
[Evalúa el estado nutricional observando: color de hojas (verde oscuro=N ok, amarillo=N defic, verde pálido=Mg/Fe defic), necrosis de bordes (K/Ca defic), manchas internervales (Mg defic), hojas pequeñas (Zn/B defic). Indica deficiencias o excesos con valores de referencia en palto: N 1.8-2.5%, P 0.1-0.3%, K 0.75-2%, Ca 1-2%, Mg 0.3-0.8%, Fe 60-200ppm, Zn 30-100ppm, B 20-60ppm, Mn 50-200ppm. Si la nutrición parece normal, dilo claramente.]

💊 TRATAMIENTO PARA FUNDO COMERCIAL (cientos de árboles):
Paso 1: [acción inmediata]
Paso 2: [producto principal + dosis exacta ml/L o g/L]
Paso 3: [volumen caldo: paltos 800-1200 L/ha, cítricos 600-800 L/ha, uvas 400-600 L/ha]
[Poda sanitaria: desinfectar tijeras en lejía 5% entre árbol y árbol]

🧪 PRODUCTOS DISPONIBLES EN PERÚ:
- [Nombre comercial] — [ingrediente activo] — [dosis] — S/[precio]/litro o kg
- [Alternativa 1] — [dosis]
- [Alternativa 2] — [dosis]

🛒 INSUMOS PARA 1 HECTÁREA:
[lista con cantidades exactas y costo total estimado en soles]

⏰ MOMENTO DE APLICACIÓN:
[hora del día, temperatura máxima, humedad relativa ideal, frecuencia, días antes/después de lluvia]

🛡️ PREVENCIÓN PRÓXIMAS 4 SEMANAS:
• [medida 1 específica para este cultivo y problema]
• [medida 2]
• [medida 3]

⚡ URGENCIA: [Crítica — actuar HOY / Alta — 3 días / Moderada — 7 días / Baja — puede esperar] — [razón concreta]`;

        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method:'POST',
          headers:{'x-api-key':ANTHROPIC_KEY,'anthropic-version':'2023-06-01','content-type':'application/json'},
          body:JSON.stringify({
            model:'claude-haiku-4-5-20251001',
            max_tokens:1500,
            messages:[{role:'user',content:[
              {type:'image',source:{type:'base64',media_type:mediaType,data:image}},
              {type:'text',text:prompt}
            ]}]
          })
        });
        const raw = await claudeRes.text();
        console.log('Claude HTTP', claudeRes.status, raw.substring(0,200));
        const cd = JSON.parse(raw);
        if(cd.error) throw new Error('Claude ' + claudeRes.status + ': ' + cd.error.message);
        resultado = cd.content?.[0]?.text || '';
        const sm = resultado.match(/🚨 SEVERIDAD:\s*(Leve|Moderado|Grave)/i);
        if(sm) severidad = sm[1];
      } catch(e) {
        console.log('Claude error:', e.message);
        resultado = '';
      }
    }

    // Fallback: diagnóstico desde base de conocimiento si Claude falla
    if (!resultado) {
      const principal = todasEnf[0];
      const trat = buscarTratamiento(principal?.name || '');
      const prob = principal?.probability || 0;
      severidad = prob > 0.55 ? 'Grave' : prob > 0.25 ? 'Moderado' : prob > 0 ? 'Leve' : 'Moderado';
      resultado = `🌿 CULTIVO IDENTIFICADO: ${cultivoNombre}
🔍 PROBLEMA PRINCIPAL: ${trat.nombre}
🚨 SEVERIDAD: ${severidad}${principal ? ' — ' + (prob*100).toFixed(0) + '% probabilidad' : ''}

📊 PROBLEMAS DETECTADOS (plant.id + crop.health):
${todasEnf.length ? todasEnf.map(e=>`• ${e.name}: ${(e.probability*100).toFixed(0)}%`).join('\n') : '• Enviar foto más clara con buena iluminación para mejor diagnóstico'}

🌱 ESTADO FENOLÓGICO (Costa Peruana — Marzo):
${fenologia}

💊 TRATAMIENTO PARA FUNDO COMERCIAL:
${trat.tratamiento}

🧪 PRODUCTOS DISPONIBLES EN PERÚ:
${trat.productos}

🛒 INSUMOS PARA 1 HECTÁREA:
${trat.compras}

⏰ MOMENTO DE APLICACIÓN:
Aplicar en horas frescas: 6:00-9:00 AM o después de las 5:00 PM.
Temperatura ideal: menor a 28°C. No aplicar con viento fuerte (>15 km/h).

🛡️ PREVENCIÓN PRÓXIMAS 4 SEMANAS:
• Monitoreo semanal: revisar 10 plantas por lote, registrar incidencia.
• Rotar grupos químicos para evitar resistencia.
• Aplicar solo si hay diagnóstico confirmado.

⚡ URGENCIA: ${trat.urgencia}`;
    }

    const cultivoMatch = resultado.match(/🌿 CULTIVO IDENTIFICADO:\s*(.+)/);
    const cultivoFinal = cultivoMatch?.[1]?.trim() || cultivoNombre;

    // Confianza en la identificación del cultivo (1.0 si lote confirmado, si no basada en APIs)
    const cultivoConfianza = cultivoConfirmado ? 1.0 :
      (cropResults[0]?.probability || plantResults[0]?.probability || 0);

    res.json({resultado, cultivo:cultivoFinal, enfermedades:todasEnf, severidad, saludable:false, cultivoConfianza});

  } catch(err) {
    console.error('Error /analyze:', err.message);
    res.status(500).json({error: err.message});
  }
});

app.get('/', (req,res) => res.json({
  status:'ok', service:'Fundo Ishizawa API', version:'2.5',
  actualizado:'28/03/2026',
  apis_activas: {
    'plant.id':    !!PLANTID_KEY,
    'crop.health': !!CROPHEALTH_KEY,
    'insect.id':   !!CROPHEALTH_KEY,
    'Claude Vision': !!ANTHROPIC_KEY,
    'Gemini Vision': !!GEMINI_KEY,
    'Pl@ntNet':      !!PLANTNET_KEY,
    'iNaturalist':   !!INAT_TOKEN,
    'Agrio':         !!AGRIO_KEY,
    'Sharp/NDVI':    true,
    'Open-Meteo':    true
  }
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Fundo Ishizawa API v2.5 corriendo en puerto', PORT));
