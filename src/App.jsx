import { useState, useEffect, useMemo } from "react";

const STATUS_CONFIG = {
  ativo: { label: "Ativo", color: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0" },
  em_atraso: { label: "Em Atraso", color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
  contemplado: { label: "Contemplado", color: "#8b5cf6", bg: "#faf5ff", border: "#e9d5ff" },
  cancelado: { label: "Cancelado", color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
  aguardando_docs: { label: "Aguard. Docs", color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
};

const TIPO_CARTA = ["Imóvel", "Veículo", "Moto", "Caminhão", "Outro"];
const PRAZO_OPCOES = ["200", "220"];

const emptyForm = {
  nome: "", tipo_documento: "cpf", cpf: "", cnpj: "",
  telefone: "", email: "",
  consultor: "", codigo_consorciado: "",
  tipo_carta: "Imóvel", valor_carta: "",
  data_contrato: "",
  grupo: "", cota: "", grupo_cota_preenchido: false,
  parcela_mensal: "", total_parcelas: "200", parcelas_pagas: "",
  data_adesao: "", vencimento_parcela: "",
  contrato_recebido: false, data_recebimento_contrato: "",
  pos_venda_serello: false, data_pos_venda_serello: "",
  status: "ativo", observacoes: "", historico: [],
};

function formatBRL(val) {
  const n = parseFloat(String(val).replace(/\D/g, "")) / 100;
  if (isNaN(n)) return "";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function cpfMask(v) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function cnpjMask(v) {
  return v.replace(/\D/g, "").slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}
function phoneMask(v) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{4})$/, "$1-$2");
}

const STORAGE_KEY = "consorcio_crm_v4";
function loadData() { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; } }
function saveData(d) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} }
function isPeriodoLance() { const d = new Date().getDate(); return d >= 1 && d <= 10; }

export default function App() {
  const [clientes, setClientes] = useState(loadData);
  const [view, setView] = useState("dashboard");
  const [formData, setFormData] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [detalheId, setDetalheId] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [msgInput, setMsgInput] = useState("");
  const [sortBy, setSortBy] = useState("nome");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  useEffect(() => { saveData(clientes); }, [clientes]);

  const periodoLance = isPeriodoLance();
  const diaAtual = new Date().getDate();

  // ── PENDÊNCIAS CALCULADAS ──
  const pendencias = useMemo(() => ({
    semContrato: clientes.filter(c => c.status === "ativo" && !c.contrato_recebido),
    semPosVenda: clientes.filter(c => c.status === "ativo" && !c.pos_venda_serello),
    semGrupoCota: clientes.filter(c => c.status === "ativo" && !c.grupo_cota_preenchido),
    elegiveisLance: clientes.filter(c => c.status === "ativo" && parseInt(c.parcelas_pagas || 0) >= 1),
    emAtraso: clientes.filter(c => c.status === "em_atraso"),
  }), [clientes]);

  const clientesFiltrados = useMemo(() => {
    return clientes.filter(c => {
      const q = busca.toLowerCase();
      const docVal = c.tipo_documento === "cnpj" ? c.cnpj : c.cpf;
      const matchBusca = !busca ||
        c.nome?.toLowerCase().includes(q) || docVal?.includes(q) ||
        c.telefone?.includes(q) || c.grupo?.includes(q) ||
        c.cota?.includes(q) || c.consultor?.toLowerCase().includes(q) ||
        c.codigo_consorciado?.includes(q);
      const matchStatus = filtroStatus === "todos" || c.status === filtroStatus;
      const matchTipo = filtroTipo === "todos" || c.tipo_carta === filtroTipo;
      return matchBusca && matchStatus && matchTipo;
    }).sort((a, b) => {
      if (sortBy === "nome") return (a.nome || "").localeCompare(b.nome || "");
      if (sortBy === "consultor") return (a.consultor || "").localeCompare(b.consultor || "");
      if (sortBy === "status") return (a.status || "").localeCompare(b.status || "");
      return 0;
    });
  }, [clientes, busca, filtroStatus, filtroTipo, sortBy]);

  function openForm(cliente = null) {
    if (cliente) { setFormData({ ...emptyForm, ...cliente }); setEditId(cliente.id); }
    else { setFormData(emptyForm); setEditId(null); }
    setView("form");
  }
  function salvarCliente() {
    if (!formData.nome.trim()) return alert("Informe o nome do cliente.");
    if (editId) { setClientes(cs => cs.map(c => c.id === editId ? { ...formData, id: editId } : c)); }
    else { setClientes(cs => [...cs, { ...formData, id: Date.now().toString(), historico: [] }]); }
    setView("lista");
  }
  function deletarCliente(id) {
    setClientes(cs => cs.filter(c => c.id !== id));
    setShowDeleteConfirm(null);
    if (detalheId === id) setView("lista");
  }
  function abrirDetalhe(id) { setDetalheId(id); setView("detalhe"); }
  function adicionarMensagem(clienteId) {
    if (!msgInput.trim()) return;
    const msg = { data: new Date().toLocaleString("pt-BR"), texto: msgInput.trim() };
    setClientes(cs => cs.map(c => c.id === clienteId ? { ...c, historico: [...(c.historico || []), msg] } : c));
    setMsgInput("");
  }
  function mudarStatus(id, status) { setClientes(cs => cs.map(c => c.id === id ? { ...c, status } : c)); }
  function handleField(key, val) { setFormData(f => ({ ...f, [key]: val })); }

  const clienteDetalhe = clientes.find(c => c.id === detalheId);
  const porcentagem = clienteDetalhe
    ? Math.min(100, Math.round((parseInt(clienteDetalhe.parcelas_pagas || 0) / parseInt(clienteDetalhe.total_parcelas || 1)) * 100)) : 0;

  const S = {
    app: { fontFamily: "'Inter','Segoe UI',sans-serif", background: "#f1f5f9", minHeight: "100vh", color: "#1e293b" },
    header: { background: "linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%)", padding: "0", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" },
    headerTop: { padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" },
    headerTitle: { color: "#fff", fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 },
    nav: { display: "flex", gap: 0, borderTop: "1px solid rgba(255,255,255,0.15)" },
    navBtn: (active) => ({
      padding: "10px 20px", fontWeight: 600, fontSize: 13, cursor: "pointer", border: "none",
      background: active ? "rgba(255,255,255,0.18)" : "transparent",
      color: active ? "#fff" : "rgba(255,255,255,0.7)",
      borderBottom: active ? "2px solid #fff" : "2px solid transparent",
    }),
    btn: { background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 },
    btnOutline: { background: "transparent", color: "#2563eb", border: "1.5px solid #2563eb", borderRadius: 8, padding: "7px 14px", fontWeight: 600, fontSize: 14, cursor: "pointer" },
    btnDanger: { background: "#ef4444", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
    btnGhost: (active) => ({ padding: "7px 18px", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer", border: "1.5px solid #2563eb", background: active ? "#2563eb" : "#fff", color: active ? "#fff" : "#2563eb" }),
    card: { background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0" },
    input: { width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, color: "#1e293b", background: "#f8fafc", outline: "none", boxSizing: "border-box" },
    inputDisabled: { width: "100%", padding: "9px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 14, color: "#94a3b8", background: "#f1f5f9", outline: "none", boxSizing: "border-box", cursor: "not-allowed" },
    label: { fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4, display: "block", textTransform: "uppercase", letterSpacing: "0.5px" },
    badge: (status) => ({ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: STATUS_CONFIG[status]?.bg || "#f1f5f9", color: STATUS_CONFIG[status]?.color || "#64748b", border: `1px solid ${STATUS_CONFIG[status]?.border || "#e2e8f0"}` }),
    section: { maxWidth: 1100, margin: "0 auto", padding: "20px 16px" },
    secTitle: { gridColumn: "1/-1", fontSize: 11, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #e2e8f0", paddingBottom: 6, marginTop: 8 },
    checkRow: (active, ac, ab) => ({ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: active ? ac : "#f8fafc", border: `1.5px solid ${active ? ab : "#e2e8f0"}`, borderRadius: 8, cursor: "pointer" }),
  };

  // ── MINI CARD DE CLIENTE (usado no dashboard) ──
  const MiniCard = ({ c, accentColor }) => {
    const precisaLance = periodoLance && parseInt(c.parcelas_pagas || 0) >= 1;
    return (
      <div onClick={() => abrirDetalhe(c.id)} style={{ background: "#fff", border: `1px solid #e2e8f0`, borderLeft: `3px solid ${accentColor}`, borderRadius: 8, padding: "10px 14px", cursor: "pointer", transition: "box-shadow 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = "0 3px 10px rgba(0,0,0,0.1)"}
        onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{c.nome}</div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {c.consultor && <span>👤 {c.consultor}</span>}
          {c.telefone && <span>📱 {c.telefone}</span>}
          {c.tipo_carta && <span>🏦 {c.tipo_carta}</span>}
          {c.valor_carta && <span>💰 {c.valor_carta}</span>}
          {c.codigo_consorciado && <span>🔑 {c.codigo_consorciado}</span>}
        </div>
      </div>
    );
  };

  // ── PAINEL DE PENDÊNCIAS ──
  const PainelPendencia = ({ titulo, cor, icone, lista, mensagemVazia }) => (
    <div style={{ ...S.card, border: `1px solid ${cor}30`, borderTop: `3px solid ${cor}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 20 }}>{icone}</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>{titulo}</span>
        </div>
        <span style={{ background: lista.length > 0 ? cor : "#e2e8f0", color: lista.length > 0 ? "#fff" : "#94a3b8", borderRadius: 20, padding: "2px 10px", fontSize: 13, fontWeight: 800 }}>{lista.length}</span>
      </div>
      {lista.length === 0 ? (
        <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "12px 0" }}>✅ {mensagemVazia}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
          {lista.map(c => <MiniCard key={c.id} c={c} accentColor={cor} />)}
        </div>
      )}
    </div>
  );

  // ── DASHBOARD ──
  const Dashboard = () => (
    <div style={S.section}>
      {/* Cards de resumo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total Clientes", value: clientes.length, color: "#2563eb", icon: "👥" },
          { label: "Ativos", value: clientes.filter(c => c.status === "ativo").length, color: "#22c55e", icon: "✅" },
          { label: "Em Atraso", value: pendencias.emAtraso.length, color: "#ef4444", icon: "⚠️" },
          { label: "Contemplados", value: clientes.filter(c => c.status === "contemplado").length, color: "#8b5cf6", icon: "🏆" },
          periodoLance && { label: "Período de Lance", value: `Dia ${diaAtual}/10`, color: "#f59e0b", icon: "🔔" },
        ].filter(Boolean).map(s => (
          <div key={s.label} style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: `1px solid #e2e8f0`, borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>{s.icon} {s.label}</div>
            <div style={{ fontSize: s.label === "Período de Lance" ? 16 : 26, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Alerta de lance no período */}
      {periodoLance && pendencias.elegiveisLance.length > 0 && (
        <div style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", borderRadius: 12, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 32 }}>🔔</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>PERÍODO DE LANCE ATIVO — Dias 1 ao 10</div>
            <div style={{ fontSize: 13, opacity: 0.95, marginTop: 2 }}>
              Hoje é dia <b>{diaAtual}</b>. Faltam <b>{10 - diaAtual}</b> dia(s) para encerrar.{" "}
              <b>{pendencias.elegiveisLance.length}</b> cliente(s) elegíveis para lance (com parcela paga). Registre no histórico de cada cliente.
            </div>
          </div>
        </div>
      )}

      {/* Grid de pendências */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 16 }}>
        <PainelPendencia
          titulo="Contrato Não Recebido"
          cor="#ef4444" icone="📋"
          lista={pendencias.semContrato}
          mensagemVazia="Todos os contratos recebidos"
        />
        <PainelPendencia
          titulo="Pós-Venda SERELLO Pendente"
          cor="#0ea5e9" icone="🔍"
          lista={pendencias.semPosVenda}
          mensagemVazia="Todos os pós-vendas realizados"
        />
        <PainelPendencia
          titulo="Grupo / Cota Pendente"
          cor="#f59e0b" icone="⏳"
          lista={pendencias.semGrupoCota}
          mensagemVazia="Todos com grupo e cota preenchidos"
        />
        {periodoLance && (
          <PainelPendencia
            titulo={`Dar Lance — até dia 10`}
            cor="#d97706" icone="🔔"
            lista={pendencias.elegiveisLance}
            mensagemVazia="Nenhum cliente elegível ainda"
          />
        )}
        {pendencias.emAtraso.length > 0 && (
          <PainelPendencia
            titulo="Em Atraso"
            cor="#ef4444" icone="⚠️"
            lista={pendencias.emAtraso}
            mensagemVazia="Nenhum cliente em atraso"
          />
        )}
      </div>
    </div>
  );

  // ── LISTA ──
  const Lista = () => (
    <div style={S.section}>
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <input style={{ ...S.input, maxWidth: 260, flex: 1 }} placeholder="🔍 Buscar nome, CPF, consultor, grupo..." value={busca} onChange={e => setBusca(e.target.value)} />
          <select style={{ ...S.input, maxWidth: 160 }} value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="todos">Todos os status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select style={{ ...S.input, maxWidth: 140 }} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="todos">Todos os tipos</option>
            {TIPO_CARTA.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select style={{ ...S.input, maxWidth: 170 }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="nome">Ordenar: Nome</option>
            <option value="consultor">Ordenar: Consultor</option>
            <option value="status">Ordenar: Status</option>
          </select>
        </div>
      </div>

      {clientesFiltrados.length === 0 ? (
        <div style={{ ...S.card, textAlign: "center", padding: 48, color: "#94a3b8" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Nenhum cliente encontrado</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Clique em "+ Novo Cliente" para começar</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {clientesFiltrados.map(c => {
            const docLabel = c.tipo_documento === "cnpj" ? "CNPJ" : "CPF";
            const docVal = c.tipo_documento === "cnpj" ? c.cnpj : c.cpf;
            const precisaLance = periodoLance && c.status === "ativo" && parseInt(c.parcelas_pagas || 0) >= 1;
            return (
              <div key={c.id} style={{ ...S.card, cursor: "pointer", borderLeft: precisaLance ? "4px solid #f59e0b" : "1px solid #e2e8f0" }}
                onClick={() => abrirDetalhe(c.id)}
                onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 12px rgba(37,99,235,0.12)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.07)"}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{c.nome}</span>
                      <span style={S.badge(c.status)}>{STATUS_CONFIG[c.status]?.label}</span>
                      <span style={{ fontSize: 12, background: "#eff6ff", color: "#2563eb", padding: "2px 8px", borderRadius: 12, fontWeight: 600 }}>{c.tipo_carta}</span>
                      {!c.grupo_cota_preenchido && <span style={{ fontSize: 11, background: "#fef9c3", color: "#a16207", padding: "2px 7px", borderRadius: 12, fontWeight: 600 }}>⏳ Grupo/Cota</span>}
                      {!c.contrato_recebido && <span style={{ fontSize: 11, background: "#fee2e2", color: "#b91c1c", padding: "2px 7px", borderRadius: 12, fontWeight: 600 }}>📋 Contrato</span>}
                      {!c.pos_venda_serello && <span style={{ fontSize: 11, background: "#f0f9ff", color: "#0369a1", padding: "2px 7px", borderRadius: 12, fontWeight: 600 }}>🔍 Pós-venda</span>}
                      {precisaLance && <span style={{ fontSize: 11, background: "#fef3c7", color: "#92400e", padding: "2px 7px", borderRadius: 12, fontWeight: 700 }}>🔔 LANCE</span>}
                    </div>
                    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 14, fontSize: 13, color: "#64748b" }}>
                      {c.consultor && <span>👤 <b>{c.consultor}</b></span>}
                      {c.telefone && <span>📱 {c.telefone}</span>}
                      {docVal && <span>{docLabel}: {docVal}</span>}
                      {c.codigo_consorciado && <span>🔑 {c.codigo_consorciado}</span>}
                      {c.grupo_cota_preenchido && c.grupo && <span>G<b>{c.grupo}</b>·C<b>{c.cota}</b></span>}
                      {c.valor_carta && <span>💰 {c.valor_carta}</span>}
                      {c.total_parcelas && <span>⏱ <b>{c.total_parcelas}</b>m</span>}
                      {c.parcelas_pagas && <span>✔ <b>{c.parcelas_pagas}</b> pagas</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                    <button style={{ ...S.btn, padding: "6px 12px", fontSize: 12 }} onClick={() => openForm(c)}>✏️ Editar</button>
                    <button style={{ ...S.btnDanger, padding: "6px 10px" }} onClick={() => setShowDeleteConfirm(c.id)}>🗑️</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {showDeleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "#00000060", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ ...S.card, maxWidth: 380, width: "90%", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Confirmar exclusão?</div>
            <div style={{ color: "#64748b", fontSize: 13, marginBottom: 20 }}>Esta ação não pode ser desfeita.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button style={S.btnOutline} onClick={() => setShowDeleteConfirm(null)}>Cancelar</button>
              <button style={S.btnDanger} onClick={() => deletarCliente(showDeleteConfirm)}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── KANBAN ──
  const Kanban = () => (
    <div style={S.section}>
      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 12 }}>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const cols = clientes.filter(c => c.status === key);
          return (
            <div key={key} style={{ minWidth: 240, flex: "0 0 240px" }}>
              <div style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}`, borderRadius: 10, padding: "10px 14px", marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, color: cfg.color, fontSize: 13 }}>{cfg.label}</span>
                <span style={{ background: cfg.color, color: "#fff", borderRadius: 12, padding: "1px 8px", fontSize: 12, fontWeight: 700 }}>{cols.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cols.map(c => {
                  const precisaLance = periodoLance && c.status === "ativo" && parseInt(c.parcelas_pagas || 0) >= 1;
                  return (
                    <div key={c.id} style={{ ...S.card, padding: 12, cursor: "pointer", borderLeft: precisaLance ? "3px solid #f59e0b" : undefined }} onClick={() => abrirDetalhe(c.id)}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{c.nome}</div>
                      {c.consultor && <div style={{ fontSize: 11, color: "#2563eb", fontWeight: 600 }}>👤 {c.consultor}</div>}
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{c.tipo_carta} · {c.total_parcelas}m</div>
                      {c.valor_carta && <div style={{ fontSize: 12, color: "#2563eb", fontWeight: 600, marginTop: 4 }}>{c.valor_carta}</div>}
                      {precisaLance && <div style={{ fontSize: 11, color: "#92400e", fontWeight: 700, marginTop: 4 }}>🔔 DAR LANCE</div>}
                      {c.telefone && <a href={`https://wa.me/55${c.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 6, fontSize: 11, color: "#16a34a", fontWeight: 600, textDecoration: "none" }} onClick={e => e.stopPropagation()}>💬 WhatsApp</a>}
                    </div>
                  );
                })}
                {cols.length === 0 && <div style={{ textAlign: "center", color: "#cbd5e1", fontSize: 12, padding: 16 }}>Nenhum cliente</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── FORMULÁRIO ──
  const Formulario = () => {
    const isCNPJ = formData.tipo_documento === "cnpj";
    const grupoCotaBloqueado = !formData.grupo_cota_preenchido;
    return (
      <div style={S.section}>
        <div style={{ ...S.card, maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 18, color: "#1e3a5f" }}>{editId ? "✏️ Editar Cliente" : "➕ Novo Cliente"}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={S.secTitle}>👤 Dados Pessoais</div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={S.label}>Nome Completo *</label>
              <input style={S.input} value={formData.nome} onChange={e => handleField("nome", e.target.value)} placeholder="Nome do cliente ou empresa" />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={S.label}>Tipo de Documento</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button style={S.btnGhost(!isCNPJ)} onClick={() => handleField("tipo_documento", "cpf")}>CPF (Pessoa Física)</button>
                <button style={S.btnGhost(isCNPJ)} onClick={() => handleField("tipo_documento", "cnpj")}>CNPJ (Pessoa Jurídica)</button>
              </div>
              {!isCNPJ
                ? <input style={S.input} value={formData.cpf} onChange={e => handleField("cpf", cpfMask(e.target.value))} placeholder="000.000.000-00" />
                : <input style={S.input} value={formData.cnpj} onChange={e => handleField("cnpj", cnpjMask(e.target.value))} placeholder="00.000.000/0001-00" />}
            </div>
            <div>
              <label style={S.label}>Telefone / WhatsApp</label>
              <input style={S.input} value={formData.telefone} onChange={e => handleField("telefone", phoneMask(e.target.value))} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <label style={S.label}>E-mail</label>
              <input style={S.input} value={formData.email} onChange={e => handleField("email", e.target.value)} placeholder="email@exemplo.com" type="email" />
            </div>
            <div>
              <label style={S.label}>Consultor Responsável</label>
              <input style={S.input} value={formData.consultor} onChange={e => handleField("consultor", e.target.value)} placeholder="Nome do consultor" />
            </div>
            <div>
              <label style={S.label}>Código Consorciado (Serello)</label>
              <input style={S.input} value={formData.codigo_consorciado} onChange={e => handleField("codigo_consorciado", e.target.value)} placeholder="Ex: 5103 1619-0" />
            </div>

            <div style={S.secTitle}>📄 Contrato e Pendências</div>
            <div>
              <label style={S.label}>Data do Contrato</label>
              <input style={S.input} value={formData.data_contrato} onChange={e => handleField("data_contrato", e.target.value)} type="date" />
            </div>
            <div>
              <label style={S.label}>Status</label>
              <select style={S.input} value={formData.status} onChange={e => handleField("status", e.target.value)}>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <div style={S.checkRow(formData.contrato_recebido, "#f0fdf4", "#86efac")} onClick={() => handleField("contrato_recebido", !formData.contrato_recebido)}>
                <input type="checkbox" checked={formData.contrato_recebido} onChange={() => {}} style={{ width: 16, height: 16 }} />
                <span style={{ fontWeight: 600, fontSize: 13, color: formData.contrato_recebido ? "#166534" : "#475569" }}>
                  {formData.contrato_recebido ? "✅ Contrato recebido" : "📋 Contrato ainda não recebido"}
                </span>
              </div>
              {formData.contrato_recebido && (
                <div style={{ marginTop: 8 }}>
                  <label style={S.label}>Data de recebimento</label>
                  <input style={S.input} value={formData.data_recebimento_contrato} onChange={e => handleField("data_recebimento_contrato", e.target.value)} type="date" />
                </div>
              )}
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <div style={S.checkRow(formData.pos_venda_serello, "#eff6ff", "#93c5fd")} onClick={() => handleField("pos_venda_serello", !formData.pos_venda_serello)}>
                <input type="checkbox" checked={formData.pos_venda_serello} onChange={() => {}} style={{ width: 16, height: 16 }} />
                <span style={{ fontWeight: 600, fontSize: 13, color: formData.pos_venda_serello ? "#1e40af" : "#475569" }}>
                  {formData.pos_venda_serello ? "✅ Pós-venda SERELLO realizado" : "🔍 Pós-venda SERELLO pendente"}
                </span>
              </div>
              {formData.pos_venda_serello && (
                <div style={{ marginTop: 8 }}>
                  <label style={S.label}>Data do pós-venda</label>
                  <input style={S.input} value={formData.data_pos_venda_serello} onChange={e => handleField("data_pos_venda_serello", e.target.value)} type="date" />
                </div>
              )}
            </div>

            <div style={S.secTitle}>🏦 Carta de Crédito</div>
            <div>
              <label style={S.label}>Tipo de Carta</label>
              <select style={S.input} value={formData.tipo_carta} onChange={e => handleField("tipo_carta", e.target.value)}>
                {TIPO_CARTA.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Valor da Carta</label>
              <input style={S.input} value={formData.valor_carta} onChange={e => handleField("valor_carta", formatBRL(e.target.value))} placeholder="R$ 0,00" />
            </div>
            <div>
              <label style={S.label}>Data de Adesão</label>
              <input style={S.input} value={formData.data_adesao} onChange={e => handleField("data_adesao", e.target.value)} type="date" />
            </div>

            <div style={S.secTitle}>🔢 Grupo e Cota</div>
            <div style={{ gridColumn: "1/-1" }}>
              <div style={S.checkRow(formData.grupo_cota_preenchido, "#f0fdf4", "#86efac")} onClick={() => handleField("grupo_cota_preenchido", !formData.grupo_cota_preenchido)}>
                <input type="checkbox" checked={formData.grupo_cota_preenchido} onChange={() => {}} style={{ width: 16, height: 16 }} />
                <span style={{ fontWeight: 600, fontSize: 13, color: formData.grupo_cota_preenchido ? "#166534" : "#a16207" }}>
                  {formData.grupo_cota_preenchido ? "✅ Grupo e Cota já disponíveis" : "⏳ Aguardando cadastro na plataforma"}
                </span>
              </div>
            </div>
            <div>
              <label style={S.label}>Grupo</label>
              <input style={grupoCotaBloqueado ? S.inputDisabled : S.input} value={formData.grupo} onChange={e => !grupoCotaBloqueado && handleField("grupo", e.target.value)} placeholder={grupoCotaBloqueado ? "Aguardando plataforma..." : "Ex: 0234"} disabled={grupoCotaBloqueado} />
            </div>
            <div>
              <label style={S.label}>Cota</label>
              <input style={grupoCotaBloqueado ? S.inputDisabled : S.input} value={formData.cota} onChange={e => !grupoCotaBloqueado && handleField("cota", e.target.value)} placeholder={grupoCotaBloqueado ? "Aguardando plataforma..." : "Ex: 015"} disabled={grupoCotaBloqueado} />
            </div>

            <div style={S.secTitle}>💳 Parcelas</div>
            <div>
              <label style={S.label}>Prazo do Contrato</label>
              <div style={{ display: "flex", gap: 8 }}>
                {PRAZO_OPCOES.map(p => <button key={p} style={S.btnGhost(formData.total_parcelas === p)} onClick={() => handleField("total_parcelas", p)}>{p} meses</button>)}
              </div>
            </div>
            <div>
              <label style={S.label}>Parcela Mensal</label>
              <input style={S.input} value={formData.parcela_mensal} onChange={e => handleField("parcela_mensal", formatBRL(e.target.value))} placeholder="R$ 0,00" />
            </div>
            <div>
              <label style={S.label}>Parcelas Pagas</label>
              <input style={S.input} value={formData.parcelas_pagas} onChange={e => handleField("parcelas_pagas", e.target.value)} placeholder="Ex: 12" type="number" min="0" />
            </div>
            <div>
              <label style={S.label}>Dia de Vencimento</label>
              <input style={S.input} value={formData.vencimento_parcela} onChange={e => handleField("vencimento_parcela", e.target.value)} placeholder="Ex: 10" type="number" min="1" max="31" />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={S.label}>Observações</label>
              <textarea style={{ ...S.input, minHeight: 80, resize: "vertical" }} value={formData.observacoes} onChange={e => handleField("observacoes", e.target.value)} placeholder="Notas internas..." />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
            <button style={S.btnOutline} onClick={() => setView("lista")}>Cancelar</button>
            <button style={S.btn} onClick={salvarCliente}>💾 Salvar Cliente</button>
          </div>
        </div>
      </div>
    );
  };

  // ── DETALHE ──
  const Detalhe = () => {
    if (!clienteDetalhe) return null;
    const c = clienteDetalhe;
    const waLink = `https://wa.me/55${c.telefone?.replace(/\D/g, "")}`;
    const docLabel = c.tipo_documento === "cnpj" ? "CNPJ" : "CPF";
    const docVal = c.tipo_documento === "cnpj" ? c.cnpj : c.cpf;
    const precisaLance = periodoLance && c.status === "ativo" && parseInt(c.parcelas_pagas || 0) >= 1;
    return (
      <div style={S.section}>
        {precisaLance && (
          <div style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#fff", borderRadius: 12, padding: "14px 20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 28 }}>🔔</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Período de Lance ativo!</div>
              <div style={{ fontSize: 13 }}>Registre o lance no histórico abaixo até dia 10.</div>
            </div>
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          <div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22 }}>{c.nome}</h2>
                  {c.consultor && <div style={{ fontSize: 13, color: "#2563eb", fontWeight: 600, marginTop: 4 }}>👤 Consultor: {c.consultor}</div>}
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={S.badge(c.status)}>{STATUS_CONFIG[c.status]?.label}</span>
                    <span style={{ background: "#eff6ff", color: "#2563eb", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{c.tipo_carta}</span>
                    {!c.grupo_cota_preenchido && <span style={{ background: "#fef9c3", color: "#a16207", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>⏳ Grupo/Cota pendente</span>}
                    {!c.contrato_recebido && <span style={{ background: "#fee2e2", color: "#b91c1c", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>📋 Contrato não recebido</span>}
                    {!c.pos_venda_serello && <span style={{ background: "#f0f9ff", color: "#0369a1", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>🔍 Pós-venda pend.</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={S.btn} onClick={() => openForm(c)}>✏️ Editar</button>
                  {c.telefone && <a href={waLink} target="_blank" rel="noreferrer" style={{ ...S.btn, background: "#16a34a", textDecoration: "none" }}>💬 WhatsApp</a>}
                </div>
              </div>
              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Cód. Consorciado", value: c.codigo_consorciado },
                  { label: docLabel, value: docVal },
                  { label: "Telefone", value: c.telefone },
                  { label: "E-mail", value: c.email },
                  { label: "Data do Contrato", value: c.data_contrato ? new Date(c.data_contrato + "T12:00:00").toLocaleDateString("pt-BR") : "" },
                  { label: "Data de Adesão", value: c.data_adesao ? new Date(c.data_adesao + "T12:00:00").toLocaleDateString("pt-BR") : "" },
                  { label: "Contrato Recebido", value: c.contrato_recebido ? (c.data_recebimento_contrato ? "✅ " + new Date(c.data_recebimento_contrato + "T12:00:00").toLocaleDateString("pt-BR") : "✅ Recebido") : "❌ Pendente" },
                  { label: "Pós-venda SERELLO", value: c.pos_venda_serello ? (c.data_pos_venda_serello ? "✅ " + new Date(c.data_pos_venda_serello + "T12:00:00").toLocaleDateString("pt-BR") : "✅ Realizado") : "❌ Pendente" },
                  { label: "Prazo", value: c.total_parcelas ? `${c.total_parcelas} meses` : "" },
                  { label: "Valor da Carta", value: c.valor_carta },
                  { label: "Parcela Mensal", value: c.parcela_mensal },
                  { label: "Vencimento", value: c.vencimento_parcela ? `Todo dia ${c.vencimento_parcela}` : "" },
                  { label: "Grupo", value: c.grupo_cota_preenchido ? c.grupo : "⏳ Pendente" },
                  { label: "Cota", value: c.grupo_cota_preenchido ? c.cota : "⏳ Pendente" },
                ].filter(i => i.value).map(i => (
                  <div key={i.label}>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>{i.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>{i.value}</div>
                  </div>
                ))}
              </div>
            </div>
            {c.total_parcelas && c.parcelas_pagas && (
              <div style={S.card}>
                <div style={{ fontWeight: 700, marginBottom: 10, color: "#1e3a5f" }}>📊 Progresso</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <span>{c.parcelas_pagas} de {c.total_parcelas} meses pagos</span>
                  <span style={{ fontWeight: 700, color: "#2563eb" }}>{porcentagem}%</span>
                </div>
                <div style={{ background: "#e2e8f0", borderRadius: 8, height: 10, overflow: "hidden" }}>
                  <div style={{ width: `${porcentagem}%`, height: "100%", background: "linear-gradient(90deg,#2563eb,#8b5cf6)", borderRadius: 8 }} />
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>{parseInt(c.total_parcelas) - parseInt(c.parcelas_pagas)} meses restantes</div>
              </div>
            )}
            <div style={S.card}>
              <div style={{ fontWeight: 700, marginBottom: 10, color: "#1e3a5f" }}>🔄 Alterar Status</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <button key={key} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", background: c.status === key ? cfg.color : cfg.bg, color: c.status === key ? "#fff" : cfg.color, border: `1.5px solid ${cfg.border}` }} onClick={() => mudarStatus(c.id, key)}>{cfg.label}</button>
                ))}
              </div>
            </div>
            {c.observacoes && (
              <div style={S.card}>
                <div style={{ fontWeight: 700, marginBottom: 8, color: "#1e3a5f" }}>📝 Observações</div>
                <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.6 }}>{c.observacoes}</div>
              </div>
            )}
          </div>
          <div style={{ flex: "1 1 300px" }}>
            <div style={S.card}>
              <div style={{ fontWeight: 700, marginBottom: 14, color: "#1e3a5f", fontSize: 15 }}>💬 Histórico de Acompanhamento</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input style={{ ...S.input, flex: 1 }} placeholder="Registrar cobrança, lance, contato..." value={msgInput} onChange={e => setMsgInput(e.target.value)} onKeyDown={e => e.key === "Enter" && adicionarMensagem(c.id)} />
                <button style={S.btn} onClick={() => adicionarMensagem(c.id)}>Salvar</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 440, overflowY: "auto" }}>
                {(c.historico || []).length === 0 ? (
                  <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: 20 }}>Nenhum registro ainda.</div>
                ) : (
                  [...(c.historico || [])].reverse().map((h, i) => (
                    <div key={i} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>🕐 {h.data}</div>
                      <div style={{ fontSize: 13, color: "#334155" }}>{h.texto}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const VIEWS = [
    { id: "dashboard", label: "📊 Painel", title: "Painel Geral" },
    { id: "lista", label: "🗂️ Clientes", title: "Lista de Clientes" },
    { id: "kanban", label: "📋 Quadro", title: "Quadro de Clientes" },
  ];

  return (
    <div style={S.app}>
      <div style={S.header}>
        <div style={S.headerTop}>
          <div style={S.headerTitle}>
            <span style={{ fontSize: 24 }}>🏦</span>
            <div>
              <div>CRM Consórcio</div>
              <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.8 }}>Gestão de Cartas de Crédito</div>
            </div>
          </div>
          <button style={S.btn} onClick={() => openForm()}>+ Novo Cliente</button>
        </div>
        <nav style={S.nav}>
          {VIEWS.map(v => (
            <button key={v.id} style={S.navBtn(view === v.id || (view === "form" && v.id === "lista") || (view === "detalhe" && v.id === "lista"))} onClick={() => setView(v.id)}>{v.label}</button>
          ))}
          {(view === "detalhe" || view === "form") && (
            <button style={{ ...S.navBtn(false), marginLeft: "auto" }} onClick={() => setView("lista")}>← Voltar</button>
          )}
        </nav>
      </div>
      {view === "dashboard" && <Dashboard />}
      {view === "lista" && <Lista />}
      {view === "kanban" && <Kanban />}
      {view === "form" && <Formulario />}
      {view === "detalhe" && <Detalhe />}
    </div>
  );
}
