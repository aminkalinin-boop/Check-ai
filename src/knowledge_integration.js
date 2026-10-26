/* Verifiable, bundled source registry and single-author reference comparison.
   The JSON is embedded by build.py so the shared core makes ZERO network calls.
   It is not a trained classifier or a database of manuscript texts. */
'use strict';
function knowledgeSourceEntry(signalId) {
  if (typeof CHECK_AI_MARKER_KB === 'undefined') return null;
  return CHECK_AI_MARKER_KB.entries.find(x => x.signal_id === signalId) || null;
}
function knowledgeSourceNames(ids) {
  if (typeof CHECK_AI_MARKER_KB === 'undefined') return [];
  return (ids || []).map(id => CHECK_AI_MARKER_KB.sources.find(s => s.id === id))
    .filter(Boolean).map(s => ({ id:s.id, name:s.title, path:s.path || null,
      url:s.url || null, verifiedPrimary:!!s.verifiedPrimary, type:s.type }));
}
function knowledgeBaselineComparison(res) {
  const base = typeof HUMAN_BASELINE === 'undefined' ? null : HUMAN_BASELINE;
  const rows = res.stats && res.stats.stylometry && Array.isArray(res.stats.stylometry.rows)
    ? res.stats.stylometry.rows : [];
  if (!base || !rows.length) return { status:'not_applicable',
    description:'Данных для сравнения с историческим эталоном недостаточно: необходим полный профиль связного русскоязычного текста (обычно от 600 слов).',
    source:'62 статьи одного автора-экономиста 2016–2022 годов; не репрезентативный корпус всех научных работ.',
    features:[], scope:'single-author' };
  const features=[];
  for (const row of rows) {
    const ref = base.features[row.id];
    if (!ref || !Number.isFinite(row.value) || !Number.isFinite(ref.p10) || !Number.isFinite(ref.p90))continue;
    const status = row.value < ref.p10 ? 'below_p10' : row.value > ref.p90 ? 'above_p90' : 'within_p10_p90';
    features.push({id:row.id,label:row.label,
      observed:+row.value.toFixed(3),p10:ref.p10,p50:ref.p50,p90:ref.p90,
      status,unit:row.id==='commas'?'запятых/предложение':
        row.id==='sentcv'?'коэффициент вариации':row.id==='constart'?'% предложений':'на 1000 слов',
      interpretation:'Сравнение с индивидуальным историческим авторским профилем, не вероятность ИИ-авторства.'});
  }
  return {status:'computed',source:'62 опубликованные статьи одного экономиста (2016–2022), лишь агрегированные процентили.',
    sampleSize:base.n_human,comparatorLater:base.n_post,scope:'single-author',
    above:features.filter(f=>f.status==='above_p90').length,
    below:features.filter(f=>f.status==='below_p10').length,
    features,
    description:'Положение показателей относительно P10–P90 одного автора. У других авторов, научных жанров и эпох распределение может отличаться. При сопоставлении с поздними статьями участие ИИ не установлено независимо.'};
}
function knowledgeAudit(res) {
  if (!res.stats)res.stats={};
  if (typeof CHECK_AI_MARKER_KB === 'undefined')return null;
  const rules=CHECK_AI_MARKER_KB.entries;
  const levels=Object.create(null), byRule=Object.create(null);
  const eligible=(res.paras || []).filter(p=>p && !p.heading && !p.toc && !p.bib && !p.inBox &&
    p.words>=12 && p.text).slice(0,5000);
  let reviewed=0;
  for(const p of eligible) {
    const d=scientificParagraphDiagnosis(p.text,'',p);
    const ids=[...new Set(d.signals.map(x=>x.id).filter(id=>id!=='not-identified'))];
    const matched=[];
    for(const id of ids) {
      const marker=knowledgeSourceEntry(id);
      if(!marker)continue;
      byRule[marker.id]=(byRule[marker.id]||0)+1;
      matched.push(marker.id);
    }
    if(matched.length)reviewed++;
    // Individual paragraph evidence is generated from its original text by
    // scientificParagraphDiagnosis on demand; store only IDs here.
    p.knowledgeIds=matched.slice(0,8);
  }
  for(const item of rules)levels[item.evidence_status]=(levels[item.evidence_status]||0)+1;
  const compared=knowledgeBaselineComparison(res);
  const report={
    version:CHECK_AI_MARKER_KB.version,
    definitions:rules.length,
    sources:CHECK_AI_MARKER_KB.sources.length,
    peerReviewedSources:CHECK_AI_MARKER_KB.sources.filter(s=>s.verifiedPrimary).length,
    evidenceStatusCounts:levels,
    paragraphsReviewed:eligible.length,paragraphsWithMappedMarkers:reviewed,
    byRule:Object.entries(byRule).map(([id,count])=>({id,count})).sort((a,b)=>b.count-a.count),
    historicalReference:compared,
    validation:'Карта источников и правил, а не обученная модель. Частоты слов и ритма — неспецифичные признаки. Нет доказанного процента ИИ.',
    permissions:'В публичную базу входят только определения и сводные числа; исходные рукописи не импортируются.'
  };
  res.stats.knowledgeAudit=report;
  return report;
}
function exportKnowledgeProfile(res, groundTruth) {
  const allowed=['unknown','human','machine','mixed'];
  const truth=allowed.includes(groundTruth)?groundTruth:'unknown';
  const k=res.stats?.knowledgeAudit;
  const hist=k?.historicalReference;
  const st=res.stats?.stylometry;
  const short=res.stats?.shortTextProfile;
  const rawRows=st && st.rows || [];
  return {
    schema:'check-ai-aggregate-profile/v1',
    known_origin:truth,origin_basis:'user_reported_not_verified',
    label_warning:'Программная подсветка или вердикт другого детектора не является подтверждением происхождения.',
    knowledge_version:k?.version||null,
    document_kind:res.kind==='docx'?'docx': 'plain_text',
    text_word_count:Number(res.stats?.bodyWords||st?.words||short?.words||0),
    counts:{
      strong:Number(res.stats?.counts?.strong||0),medium:Number(res.stats?.counts?.medium||0),
      weak:Number(res.stats?.counts?.weak||0),info:Number(res.stats?.counts?.info||0)
    },
    stylometry:rawRows.filter(row=>Number.isFinite(row.value))
      .map(row=>({id:row.id,value:+row.value.toFixed(4)})),
    reference_comparison:hist?.status==='computed'?
      hist.features.map(x=>({id:x.id,status:x.status})):[],
    knowledge_marker_counts:k?.byRule||[],
    short_text:short?{
      words:short.words,paragraphs:short.paragraphs,methodologicalParagraphs:short.methodologicalParagraphs,
      caveatParagraphs:short.caveatParagraphs,quantitativePhrases:short.quantitativePhrases
    }:null,
    disclaimers:[
      'Нет имени, названия, текста, цитат, файлового хэша, DOI или пути к исходному файлу.',
      'Перед публичным размещением даже агрегаты необходимо проверить на приватность и достаточность размера выборки.',
      'Этот профиль пригоден для статистической апробации, но не для вывода об авторстве по одному примеру.'
    ]
  };
}
