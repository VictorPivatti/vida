// constants.js — pure value constants extracted from the original script block
// NOTE: These are duplicated here intentionally (also exist in the original <script>)
// The original script block will be removed in Tasks 7–9.

export const MES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
export const DOW = ["Dom","Seg","Ter","Qua","Qui","Sex","Sab"];
export const DOWO = [1,2,3,4,5,6,0];

export const RISK_ORDER = ["VERMELHO","LARANJA","AMARELO","VERDE","AZUL","BRANCO","SEM CLASSIFICACAO"];
export const RISK_COLOR = {
  VERMELHO:"#c8493e",
  LARANJA:"#e07a35",
  AMARELO:"#e8a93b",
  VERDE:"#2f9e7e",
  AZUL:"#3a7ca5",
  BRANCO:"#94a3b8",
  "SEM CLASSIFICACAO":"#64748b"
};

export const CAP = {
  A:"Infecciosas",B:"Infecciosas",C:"Neoplasias",D:"Sangue/Imune",E:"Endocrinas",
  F:"Mentais",G:"Nervoso",H:"Olho/Ouvido",I:"Circulatorio",J:"Respiratorio",
  K:"Digestivo",L:"Pele",M:"Osteomuscular",N:"Geniturinario",O:"Gravidez/Parto",
  P:"Perinatal",Q:"Malformacoes",R:"Sintomas/Sinais",S:"Traumas",T:"Envenenamentos",
  V:"Causas externas",W:"Causas externas",X:"Causas externas",Y:"Causas externas",
  Z:"Fatores de saude"
};

export const CAP_COLOR = {
  J:"#1357a6",R:"#f59e0b",M:"#8b5cf6",S:"#f97316",A:"#c8493e",B:"#f87171",
  Z:"#94a3b8",N:"#06b6d4",K:"#a78bfa",H:"#84cc16",L:"#34d399",F:"#e879f9",
  I:"#60a5fa",G:"#fbbf24",O:"#f472b6",E:"#4ade80",C:"#fca5a5",D:"#7dd3fc",T:"#fb923c"
};

export const EXEC_SCORE = {
  base: 100,
  penalties: {
    criticalAlert: 24,
    warningAlert: 9,
    retornoPerPoint: 1.4,
    medicoPerMinute: 0.35,
    triagemPerMinute: 0.45,
    totalPerMinute: 0.18,
    graveShareOver35PerPoint: 0.35
  },
  floors: { excellent: 82, attention: 62 }
};

export const CONFIG = {
  MAX_MINUTES: 720,         // máximo de minutos aceito para tempos (safeMinutes) — alinhado com tTotal
  RETURN_HOURS: 72,         // janela de retorno precoce em horas
  DEFAULT_META_VOL: 3750,   // volume mensal padrão
  DEFAULT_META_TRI: 15,     // espera triagem padrão (min)
  DEFAULT_META_MED: 60,     // espera médico padrão (min)
  DEFAULT_META_TOTAL: 120,  // tempo total padrão (min)
  DEFAULT_META_RET: 10,     // taxa de retorno padrão (%)
  DEFAULT_CAP_MED: 3,       // capacidade médico/hora padrão
  DEFAULT_CAP_TRI: 6,       // capacidade triador/hora padrão
};

export const ALIAS = {
  hist: {
    pront:    ["numprontuario","prontuario","prontuário","cod paciente","codigo paciente"],
    paciente: ["nompaciente","paciente","nome paciente","nome"],
    cor:      ["classificacao","classificação","cor","risco","classificacao risco"],
    prof:     ["nomprofissional","medico","médico","profissional","profissional atendimento"],
    tipo:     ["tipo_entrada","ipo_entrada","tipo entrada","entrada","procedencia","procedência"],
    idade:    ["tidade","idade"],
    dh:       ["dh_recepcao","data hora","data atendimento","dt atendimento","recepcao","recepção","data abertura"],
    dhAcol:   ["dh_acolhimento","data acolhimento","dt acolhimento","inicio triagem","início triagem"],
    dhAtend:  ["dh_atendimento","data atendimento medico","data atendimento médico","inicio atendimento","início atendimento","atendimento medico"],
    tEspTri:  ["recepcao_triagem","espera triagem","tempo espera triagem","t espera triagem"],
    tDurTri:  ["triagem_duracao","triagem duracao","duracao triagem","duração triagem","tempo triagem","media_duracao_triagem"],
    tEspMed:  ["triagem_atendimento","espera medico","espera médico","t espera medico","t espera médico"],
    tTotal:   ["recepcao_alta","tempo total","total recepcao alta","recepcao alta","recepção alta"],
    tConsulta:["tempo_consulta","media_tempo_atendimento","tempo consulta","duracao consulta","duração consulta"]
  },
  tri: {
    pront:   ["numprontuario","prontuario","prontuário","cod paciente","codigo paciente"],
    cor:     ["classificacao","classificação","cor","risco","nomunidade"],
    triador: ["nomprofissional","triador","enfermeiro","profissional","profissional triagem"],
    dh:      ["dh_recepcao","data hora","data recepcao","recepção","data abertura"],
    dhTri:   ["dh_atendimento","data triagem","inicio triagem","início triagem"],
    tDur:    ["recepcao_alta","triagem_duracao","duracao triagem","duração triagem","tempo triagem"]
  },
  cid: {
    cid:     ["cid","codigo cid","código cid","codcid","array_dados"],
    desc:    ["descid","descricao","descrição","diagnostico","diagnóstico"],
    medico:  ["medico","médico","profissional","nomprofissional"],
    data:    ["data","data atendimento","dt atendimento","dh_atendimento"],
    idAtend: ["numprontuario","prontuario","prontuário","atendimento","id atendimento","total_linha"],
    paciente:["nompaciente","nome_paciente","paciente","nome paciente"]
  }
};

export const FALLBACK = {
  // Posições baseadas no formato real das planilhas do sistema (29 campos semicolon-separated):
  // [0]cod_classif [1]classificacao [2]cor_rgb [3]cor [4]nom_unidade [5]numprontuario
  // [6]nompaciente [7]idade [8]tipo_entrada [9]dh_recepcao [10]dh_acolhimento
  // [11]dh_atendimento [12]codespecialidade [13]nomespecialidade [14]codprofissional
  // [15]nomprofissional [16]recepcao_triagem [17]triagem_duracao [18]triagem_atendimento
  // [19]tempo_consulta [20]recepcao_alta [21]dados [22..26]médias [27]total_pacientes
  hist: {cor:3,pront:5,paciente:6,idade:7,tipo:8,dh:9,dhAcol:10,dhAtend:11,prof:15,tEspTri:16,tDurTri:17,tEspMed:18,tTotal:20,tConsulta:19},
  // Triagem: [9]=id_recepcao(num) [10]=dh_recepcao [11]=vazio [12]=dh_atendimento_triagem
  // [15]=codprofissional [16]=nomprofissional [17]=vazio [18]=vazio [19]=tDur
  tri: {cor:3,dh:10,dhTri:12,triador:16,tDur:19},
  // CID arquivo real: [0]codmun [1..3]extras [4]numprontuario [5]codcid [6]data [7]idpaciente [8]nome_paciente [9]desccid [14]nome_medico
  cid: {idAtend:4,cid:5,data:6,paciente:8,desc:9,medico:14}
};
