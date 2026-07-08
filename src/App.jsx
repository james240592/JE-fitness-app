import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Users, User, Utensils, Scale, Dumbbell, ClipboardList, LogOut, Plus,
  Plane, TrendingUp, TrendingDown, Minus, ChevronRight, X, Check,
  ArrowLeft, Loader2, ImagePlus, Home, Ruler, Mail, Lock,
} from "lucide-react";
import { supabase } from "./supabaseClient";

/* ---------------- 视觉设定 ---------------- */
const C = {
  bg: "#12171B", panel: "#1B2228", panelAlt: "#212A31", border: "#2B353D",
  text: "#EDF1F1", muted: "#8A969D", jade: "#3FA372", jadeDim: "#274A3A",
  gold: "#C9A15A", coral: "#D9765F",
};
const cardSt = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 };
const inputSt = {
  background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 10,
  padding: "10px 12px", color: C.text, width: "100%", fontSize: 14, outline: "none", boxSizing: "border-box",
};
const btnPrimary = { background: C.jade, color: "#0C1210", fontWeight: 700, border: "none", borderRadius: 10, padding: "11px 16px", cursor: "pointer", fontSize: 14 };
const btnGhost = { background: "transparent", color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 16px", cursor: "pointer", fontSize: 14 };
const labelSt = { fontSize: 12, color: C.muted, marginBottom: 6, display: "block" };

const uid = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => { if (!d) return ""; const [, m, day] = d.split("-"); return `${m}/${day}`; };

function resizeImageToBlob(file, maxW = 700, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------------- 小组件 ---------------- */
function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <line x1="20" y1="3" x2="20" y2="37" stroke={C.gold} strokeWidth="1.5" />
      <circle cx="20" cy="8" r="3" fill={C.gold} />
      <circle cx="20" cy="19" r="2.2" fill={C.jade} stroke={C.gold} strokeWidth="1" />
      <circle cx="20" cy="32" r="3" fill={C.jade} />
    </svg>
  );
}
function Brand({ subtitle }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Logo />
      <div>
        <div style={{ fontFamily: "'Noto Serif SC', serif", fontSize: 19, fontWeight: 700, letterSpacing: 1 }}>
          正位 <span style={{ color: C.gold, fontSize: 13, fontWeight: 400, letterSpacing: 2 }}>ALIGN</span>
        </div>
        {subtitle && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{subtitle}</div>}
      </div>
    </div>
  );
}
function TrendArrow({ delta }) {
  if (delta === null || delta === undefined || Number.isNaN(delta)) return <Minus size={14} color={C.muted} />;
  if (delta > 0) return <span style={{ color: C.coral, display: "flex", alignItems: "center", gap: 2, fontSize: 12 }}><TrendingUp size={14} />+{delta}</span>;
  if (delta < 0) return <span style={{ color: C.jade, display: "flex", alignItems: "center", gap: 2, fontSize: 12 }}><TrendingDown size={14} />{delta}</span>;
  return <span style={{ color: C.muted, fontSize: 12 }}>持平</span>;
}
function EmptyState({ text }) { return <div style={{ textAlign: "center", padding: "28px 10px", color: C.muted, fontSize: 13 }}>{text}</div>; }
function TripBadge() {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: C.jadeDim, color: C.jade, fontSize: 11, padding: "2px 8px", borderRadius: 20 }}><Plane size={11} /> 出差</span>;
}

/* ---------------- 顶层 App：登录状态管理 ---------------- */
export default function App() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authErr, setAuthErr] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setBooting(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    (async () => {
      for (let i = 0; i < 5; i++) {
        const { data, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
        if (data) { setProfile(data); return; }
        await new Promise((r) => setTimeout(r, 600));
      }
      setAuthErr("无法读取账号资料，请刷新重试或联系管理员");
    })();
  }, [session]);

  if (booting) {
    return (
      <Shell>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Loader2 className="spin" size={22} />
        </div>
      </Shell>
    );
  }

  if (!session) return <Shell><AuthScreen /></Shell>;
  if (!profile) {
    return (
      <Shell>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 24 }}>
          <Loader2 className="spin" size={22} />
          <div style={{ fontSize: 13, color: C.muted }}>加载账号资料中…</div>
          {authErr && <div style={{ fontSize: 12, color: C.coral }}>{authErr}</div>}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {profile.role === "coach" ? <CoachApp profile={profile} /> : <ClientApp profile={profile} />}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{
      background: C.bg, color: C.text, minHeight: "100vh", maxWidth: 480, margin: "0 auto",
      fontFamily: "'Noto Sans SC','PingFang SC',sans-serif", position: "relative",
      display: "flex", flexDirection: "column",
    }}>
      <style>{`
        ::-webkit-scrollbar{width:0;height:0}
        input::placeholder,textarea::placeholder{color:${C.muted}}
        .spin{animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
      `}</style>
      {children}
    </div>
  );
}

/* ---------------- 登录 / 注册 ---------------- */
function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function submit() {
    setErr(""); setNotice(""); setBusy(true);
    try {
      if (mode === "signup") {
        if (!name.trim()) { setErr("请填写姓名"); setBusy(false); return; }
        const { error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { name: name.trim() } },
        });
        if (error) throw error;
        setNotice("注册成功。如果 Supabase 开启了邮箱验证，请先去邮箱点击验证链接，再回来登录。");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (e) {
      setErr(e.message === "Invalid login credentials" ? "邮箱或密码不正确" : e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: 32, minHeight: "100vh" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}><Logo size={44} /></div>
        <div style={{ fontFamily: "'Noto Serif SC', serif", fontSize: 30, fontWeight: 700, letterSpacing: 2 }}>正位</div>
        <div style={{ fontSize: 12, color: C.gold, letterSpacing: 4, marginTop: 4 }}>ALIGN · 私教客户管理</div>
      </div>
      <div style={{ display: "flex", marginBottom: 20, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        {["login", "signup"].map((m) => (
          <button key={m} onClick={() => { setMode(m); setErr(""); setNotice(""); }} style={{
            flex: 1, padding: "10px 0", background: mode === m ? C.jadeDim : "transparent",
            color: mode === m ? C.jade : C.muted, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13,
          }}>{m === "login" ? "登录" : "注册新账号"}</button>
        ))}
      </div>
      {mode === "signup" && (
        <>
          <label style={labelSt}>姓名</label>
          <input style={{ ...inputSt, marginBottom: 12 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="你的姓名" />
        </>
      )}
      <label style={labelSt}>邮箱</label>
      <div style={{ position: "relative", marginBottom: 12 }}>
        <Mail size={15} color={C.muted} style={{ position: "absolute", left: 12, top: 12 }} />
        <input style={{ ...inputSt, paddingLeft: 34 }} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <label style={labelSt}>密码</label>
      <div style={{ position: "relative", marginBottom: 16 }}>
        <Lock size={15} color={C.muted} style={{ position: "absolute", left: 12, top: 12 }} />
        <input style={{ ...inputSt, paddingLeft: 34 }} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="至少 6 位" />
      </div>
      {err && <div style={{ color: C.coral, fontSize: 13, marginBottom: 12 }}>{err}</div>}
      {notice && <div style={{ color: C.jade, fontSize: 13, marginBottom: 12 }}>{notice}</div>}
      <button style={btnPrimary} onClick={submit} disabled={busy}>
        {busy ? "处理中…" : mode === "login" ? "登录" : "注册"}
      </button>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 18, textAlign: "center", lineHeight: 1.6 }}>
        新客户请选择"注册新账号"自行设置密码。<br />
        教练账号：第一次也用"注册"，之后由管理员在数据库里把角色改为教练。
      </div>
    </div>
  );
}

/* ================================================================
   教练端
   ================================================================ */
function CoachApp({ profile }) {
  const [screen, setScreen] = useState("home");
  const [clients, setClients] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const loadClients = useCallback(async () => {
    setLoading(true);
    const { data: cl } = await supabase.from("profiles").select("*").eq("role", "client").order("name");
    setClients(cl || []);
    const sums = await Promise.all((cl || []).map(async (c) => {
      const { data: body } = await supabase.from("body_logs").select("date,weight,bodyfat").eq("user_id", c.id).order("date", { ascending: false }).limit(2);
      const last = body?.[0], prev = body?.[1];
      return {
        id: c.id, name: c.name,
        weight: last?.weight ?? null, bodyfat: last?.bodyfat ?? null,
        delta: last && prev ? +(last.weight - prev.weight).toFixed(1) : null,
        lastDate: last?.date ?? null,
      };
    }));
    setSummaries(sums);
    setLoading(false);
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  return (
    <>
      {screen === "home" && (
        <CoachHome
          clients={clients} summaries={summaries} loading={loading}
          onOpen={(c) => { setSelected(c); setScreen("client"); }}
          onLogout={() => supabase.auth.signOut()}
        />
      )}
      {screen === "client" && (
        <CoachClientDetail client={selected} onBack={() => { setScreen("home"); loadClients(); }} />
      )}
    </>
  );
}

function CoachHome({ clients, summaries, loading, onOpen, onLogout }) {
  const map = Object.fromEntries(summaries.map((s) => [s.id, s]));
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ padding: "18px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}` }}>
        <Brand subtitle="教练端" />
        <button onClick={onLogout} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><LogOut size={19} /></button>
      </div>
      <div style={{ padding: "16px 20px", flex: 1, overflowY: "auto" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>我的客户 <span style={{ color: C.muted, fontWeight: 400 }}>({clients.length})</span></div>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>新客户请让他们自行在登录页"注册新账号"，注册后会自动出现在这里</div>
        {loading && <div style={{ color: C.muted, fontSize: 13 }}>加载中…</div>}
        {!loading && clients.length === 0 && <EmptyState text="还没有客户注册。把 App 链接发给客户，请他们自行注册即可。" />}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {clients.map((c) => {
            const s = map[c.id];
            return (
              <button key={c.id} onClick={() => onOpen(c)} style={{ ...cardSt, textAlign: "left", cursor: "pointer", color: C.text }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 36, height: 36, borderRadius: "50%", background: C.jadeDim, color: C.jade, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>{c.name.slice(0, 1)}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{s?.lastDate ? `最近记录 ${fmtDate(s.lastDate)}` : "暂无体测记录"}</div>
                    </div>
                  </div>
                  <ChevronRight size={18} color={C.muted} />
                </div>
                {s?.weight != null && (
                  <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: C.muted, fontFamily: "'Roboto Mono', monospace" }}>
                    <span>体重 <b style={{ color: C.text }}>{s.weight}kg</b></span>
                    {s.bodyfat != null && <span>体脂 <b style={{ color: C.text }}>{s.bodyfat}%</b></span>}
                    <TrendArrow delta={s.delta} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CoachClientDetail({ client, onBack }) {
  const [tab, setTab] = useState("overview");
  const [dietLog, setDietLog] = useState([]);
  const [bodyLog, setBodyLog] = useState([]);
  const [trainLog, setTrainLog] = useState([]);
  const [plans, setPlans] = useState([]);
  const [posture, setPosture] = useState({ assessment: "", suggestions: "" });
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data: d }, { data: b }, { data: t }, { data: p }, { data: pos }, { data: ph }] = await Promise.all([
      supabase.from("diet_logs").select("*").eq("user_id", client.id).order("date", { ascending: false }),
      supabase.from("body_logs").select("*").eq("user_id", client.id).order("date", { ascending: false }),
      supabase.from("train_logs").select("*").eq("user_id", client.id).order("date", { ascending: false }),
      supabase.from("plans").select("*").eq("client_id", client.id).order("date", { ascending: false }),
      supabase.from("posture").select("*").eq("client_id", client.id).maybeSingle(),
      supabase.from("posture_photos").select("*").eq("client_id", client.id).order("created_at", { ascending: false }),
    ]);
    setDietLog(d || []); setBodyLog(b || []); setTrainLog(t || []); setPlans(p || []);
    setPosture(pos || { assessment: "", suggestions: "" });
    const withUrls = await Promise.all((ph || []).map(async (row) => {
      const { data } = await supabase.storage.from("posture-photos").createSignedUrl(row.image_path, 3600);
      return { ...row, url: data?.signedUrl };
    }));
    setPhotos(withUrls);
    setLoading(false);
  }, [client.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function addPlan(entry) {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("plans").insert({ client_id: client.id, coach_id: user.id, date: todayStr(), ...entry });
    loadAll();
  }
  async function savePosture(next) {
    await supabase.from("posture").upsert({ client_id: client.id, assessment: next.assessment, suggestions: next.suggestions, updated_at: new Date().toISOString() });
    setPosture(next);
  }
  async function addPhoto({ label, blob }) {
    const path = `${client.id}/${uid()}.jpg`;
    await supabase.storage.from("posture-photos").upload(path, blob, { contentType: "image/jpeg" });
    await supabase.from("posture_photos").insert({ client_id: client.id, label, image_path: path, uploaded_by: "coach" });
    loadAll();
  }

  const tabs = [
    { k: "overview", label: "概览", icon: TrendingUp },
    { k: "diet", label: "饮食", icon: Utensils },
    { k: "train", label: "训练日志", icon: Dumbbell },
    { k: "plan", label: "训练计划", icon: ClipboardList },
    { k: "posture", label: "体态", icon: Ruler },
  ];

  if (loading) return <CenterLoader />;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ padding: "16px 20px 10px", borderBottom: `1px solid ${C.border}` }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, display: "flex", alignItems: "center", gap: 4, cursor: "pointer", marginBottom: 8 }}><ArrowLeft size={16} /> 返回客户列表</button>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{client.name}</div>
      </div>
      <div style={{ display: "flex", overflowX: "auto", borderBottom: `1px solid ${C.border}`, padding: "0 12px" }}>
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            background: "none", border: "none", cursor: "pointer", padding: "10px 12px",
            color: tab === t.k ? C.jade : C.muted, borderBottom: tab === t.k ? `2px solid ${C.jade}` : "2px solid transparent",
            fontSize: 13, fontWeight: tab === t.k ? 700 : 400, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5,
          }}><t.icon size={14} /> {t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
        {tab === "overview" && <OverviewPanel bodyLog={bodyLog} plans={plans} />}
        {tab === "diet" && <DietListReadOnly log={dietLog} />}
        {tab === "train" && <TrainListReadOnly log={trainLog} />}
        {tab === "plan" && <PlanPanel plans={plans} onAdd={addPlan} editable />}
        {tab === "posture" && <PosturePanel posture={posture} photos={photos} editable onSave={savePosture} onAddPhoto={addPhoto} />}
      </div>
    </div>
  );
}

function CenterLoader() {
  return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}><Loader2 className="spin" size={20} /></div>;
}

function OverviewPanel({ bodyLog, plans }) {
  const chartData = [...bodyLog].sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({ date: fmtDate(d.date), 体重: d.weight, 体脂: d.bodyfat }));
  const latestPlan = plans[0];
  return (
    <div>
      <div style={{ ...cardSt, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>体重 / 体脂趋势</div>
        {chartData.length === 0 ? <EmptyState text="客户还没有体测记录" /> : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 5, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke={C.muted} fontSize={11} />
              <YAxis yAxisId="left" stroke={C.jade} fontSize={11} domain={["auto", "auto"]} />
              <YAxis yAxisId="right" orientation="right" stroke={C.gold} fontSize={11} domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="left" type="monotone" dataKey="体重" stroke={C.jade} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line yAxisId="right" type="monotone" dataKey="体脂" stroke={C.gold} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <div style={cardSt}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>当前训练计划</div>
        {latestPlan ? (
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{latestPlan.title}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4, whiteSpace: "pre-wrap" }}>{latestPlan.content}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{fmtDate(latestPlan.date)}</div>
          </div>
        ) : <EmptyState text="还未布置训练计划" />}
      </div>
    </div>
  );
}

function DietListReadOnly({ log }) {
  if (log.length === 0) return <EmptyState text="客户还没有记录饮食" />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {log.map((e) => (
        <div key={e.id} style={cardSt}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.muted }}>{fmtDate(e.date)} · {e.meal_type}</span>
            {e.is_trip && <TripBadge />}
          </div>
          <div style={{ fontSize: 13, marginTop: 6 }}>{e.description}</div>
          {e.is_trip && e.trip_location && <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>📍 {e.trip_location}</div>}
        </div>
      ))}
    </div>
  );
}
function TrainListReadOnly({ log }) {
  if (log.length === 0) return <EmptyState text="客户还没有记录训练" />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {log.map((e) => (
        <div key={e.id} style={cardSt}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.muted }}>{fmtDate(e.date)}</span>
            {e.is_trip && <TripBadge />}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{e.type} · {e.duration} 分钟</div>
          {e.notes && <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{e.notes}</div>}
          {e.is_trip && e.location && <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>📍 {e.location}</div>}
        </div>
      ))}
    </div>
  );
}

function PlanPanel({ plans, onAdd, editable }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  function submit() {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), content: content.trim() });
    setTitle(""); setContent(""); setShowForm(false);
  }
  return (
    <div>
      {editable && (
        <button onClick={() => setShowForm((v) => !v)} style={{ ...btnPrimary, width: "100%", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Plus size={16} /> 布置新的训练计划
        </button>
      )}
      {showForm && (
        <div style={{ ...cardSt, marginBottom: 14 }}>
          <label style={labelSt}>计划标题</label>
          <input style={{ ...inputSt, marginBottom: 10 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：下肢力量 + 体态激活" />
          <label style={labelSt}>内容 / 动作安排</label>
          <textarea style={{ ...inputSt, minHeight: 90, marginBottom: 10, resize: "vertical" }} value={content} onChange={(e) => setContent(e.target.value)} placeholder="例如：&#10;1. 臀桥 3x15&#10;2. 靠墙天使式 3x10（改善圆肩）&#10;3. 农夫行走 4x30m" />
          <button style={btnPrimary} onClick={submit}>保存计划</button>
        </div>
      )}
      {plans.length === 0 ? <EmptyState text="还没有训练计划记录" /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {plans.map((p) => (
            <div key={p.id} style={cardSt}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{p.title}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{fmtDate(p.date)}</div>
              </div>
              {p.content && <div style={{ fontSize: 12, color: C.muted, marginTop: 6, whiteSpace: "pre-wrap" }}>{p.content}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PosturePanel({ posture, photos, editable, onSave, onAddPhoto }) {
  const [assessment, setAssessment] = useState(posture.assessment || "");
  const [suggestions, setSuggestions] = useState(posture.suggestions || "");
  const [saved, setSaved] = useState(false);
  const [label, setLabel] = useState("正面");
  const [uploading, setUploading] = useState(false);

  useEffect(() => { setAssessment(posture.assessment || ""); setSuggestions(posture.suggestions || ""); }, [posture.assessment, posture.suggestions]);

  async function handleSave() {
    await onSave({ assessment, suggestions });
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  }
  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const blob = await resizeImageToBlob(file);
    await onAddPhoto({ label, blob });
    setUploading(false);
    e.target.value = "";
  }
  return (
    <div>
      <div style={{ ...cardSt, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>体态评估</div>
        {editable ? (
          <textarea style={{ ...inputSt, minHeight: 80, resize: "vertical" }} value={assessment} onChange={(e) => setAssessment(e.target.value)} placeholder="例如：轻度骨盆前倾，右肩略高于左肩，头前引…" />
        ) : (assessment ? <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{assessment}</div> : <EmptyState text="教练还未填写评估" />)}
      </div>
      <div style={{ ...cardSt, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>调整建议</div>
        {editable ? (
          <textarea style={{ ...inputSt, minHeight: 80, resize: "vertical" }} value={suggestions} onChange={(e) => setSuggestions(e.target.value)} placeholder="例如：加强臀中肌激活，日常提醒收下巴、沉肩，办公室每小时起身活动…" />
        ) : (suggestions ? <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{suggestions}</div> : <EmptyState text="教练还未填写建议" />)}
        {editable && (
          <button style={{ ...btnPrimary, marginTop: 10, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }} onClick={handleSave}>
            {saved ? <><Check size={15} /> 已保存</> : "保存评估与建议"}
          </button>
        )}
      </div>
      <div style={cardSt}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>体态照片对比</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          {["正面", "侧面", "背面"].map((l) => (
            <button key={l} onClick={() => setLabel(l)} style={{ background: label === l ? C.jadeDim : "transparent", color: label === l ? C.jade : C.muted, border: `1px solid ${C.border}`, borderRadius: 20, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>{l}</button>
          ))}
          <label style={{ ...btnGhost, padding: "5px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
            <ImagePlus size={14} /> {uploading ? "上传中…" : `上传${label}照片`}
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} disabled={uploading} />
          </label>
        </div>
        {photos.length === 0 ? <EmptyState text="还没有体态照片" /> : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {photos.map((p) => (
              <div key={p.id} style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}` }}>
                {p.url && <img src={p.url} alt={p.label} style={{ width: "100%", height: 130, objectFit: "cover", display: "block" }} />}
                <div style={{ padding: "5px 8px", fontSize: 11, color: C.muted, display: "flex", justifyContent: "space-between" }}>
                  <span>{p.label} · {p.uploaded_by === "coach" ? "教练" : "客户"}</span>
                  <span>{fmtDate(p.created_at?.slice(0, 10))}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   客户端
   ================================================================ */
function ClientApp({ profile }) {
  const [tab, setTab] = useState("home");
  const [dietLog, setDietLog] = useState([]);
  const [bodyLog, setBodyLog] = useState([]);
  const [trainLog, setTrainLog] = useState([]);
  const [plans, setPlans] = useState([]);
  const [posture, setPosture] = useState({ assessment: "", suggestions: "" });
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data: d }, { data: b }, { data: t }, { data: p }, { data: pos }, { data: ph }] = await Promise.all([
      supabase.from("diet_logs").select("*").eq("user_id", profile.id).order("date", { ascending: false }),
      supabase.from("body_logs").select("*").eq("user_id", profile.id).order("date", { ascending: false }),
      supabase.from("train_logs").select("*").eq("user_id", profile.id).order("date", { ascending: false }),
      supabase.from("plans").select("*").eq("client_id", profile.id).order("date", { ascending: false }),
      supabase.from("posture").select("*").eq("client_id", profile.id).maybeSingle(),
      supabase.from("posture_photos").select("*").eq("client_id", profile.id).order("created_at", { ascending: false }),
    ]);
    setDietLog(d || []); setBodyLog(b || []); setTrainLog(t || []); setPlans(p || []);
    setPosture(pos || { assessment: "", suggestions: "" });
    const withUrls = await Promise.all((ph || []).map(async (row) => {
      const { data } = await supabase.storage.from("posture-photos").createSignedUrl(row.image_path, 3600);
      return { ...row, url: data?.signedUrl };
    }));
    setPhotos(withUrls);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function addDiet(entry) { await supabase.from("diet_logs").insert({ user_id: profile.id, ...entry }); loadAll(); }
  async function addBody(entry) { await supabase.from("body_logs").insert({ user_id: profile.id, ...entry }); loadAll(); }
  async function addTrain(entry) { await supabase.from("train_logs").insert({ user_id: profile.id, ...entry }); loadAll(); }
  async function addPhoto({ label, blob }) {
    const path = `${profile.id}/${uid()}.jpg`;
    await supabase.storage.from("posture-photos").upload(path, blob, { contentType: "image/jpeg" });
    await supabase.from("posture_photos").insert({ client_id: profile.id, label, image_path: path, uploaded_by: "client" });
    loadAll();
  }

  const tabs = [
    { k: "home", label: "首页", icon: Home },
    { k: "diet", label: "饮食", icon: Utensils },
    { k: "body", label: "体测", icon: Scale },
    { k: "train", label: "训练", icon: Dumbbell },
    { k: "posture", label: "体态", icon: Ruler },
  ];

  if (loading) return <CenterLoader />;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ padding: "18px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}` }}>
        <Brand subtitle={`你好，${profile.name}`} />
        <button onClick={() => supabase.auth.signOut()} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><LogOut size={19} /></button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 18, paddingBottom: 90 }}>
        {tab === "home" && <ClientHomeTab bodyLog={bodyLog} plans={plans} posture={posture} onGo={setTab} />}
        {tab === "diet" && <ClientDietTab log={dietLog} onAdd={addDiet} />}
        {tab === "body" && <ClientBodyTab log={bodyLog} onAdd={addBody} />}
        {tab === "train" && <ClientTrainTab log={trainLog} onAdd={addTrain} />}
        {tab === "posture" && <PosturePanel posture={posture} photos={photos} editable={false} onAddPhoto={addPhoto} />}
      </div>
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, display: "flex", background: C.panel, borderTop: `1px solid ${C.border}`, padding: "8px 4px" }}>
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", padding: "6px 0", color: tab === t.k ? C.jade : C.muted, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontSize: 10 }}>
            <t.icon size={18} /> {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ClientHomeTab({ bodyLog, plans, posture, onGo }) {
  const latestPlan = plans[0];
  const latest = bodyLog[0];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ ...cardSt, background: `linear-gradient(135deg, ${C.jadeDim}, ${C.panel})` }}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>本次到店训练计划</div>
        {latestPlan ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{latestPlan.title}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 6, whiteSpace: "pre-wrap" }}>{latestPlan.content}</div>
          </>
        ) : <div style={{ fontSize: 13, color: C.muted }}>教练还未布置计划</div>}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ ...cardSt, flex: 1 }}>
          <div style={{ fontSize: 11, color: C.muted }}>最新体重</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Roboto Mono', monospace" }}>{latest?.weight ?? "--"}<span style={{ fontSize: 12 }}>kg</span></div>
        </div>
        <div style={{ ...cardSt, flex: 1 }}>
          <div style={{ fontSize: 11, color: C.muted }}>最新体脂</div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Roboto Mono', monospace" }}>{latest?.bodyfat ?? "--"}<span style={{ fontSize: 12 }}>%</span></div>
        </div>
      </div>
      {posture.suggestions && (
        <div style={cardSt}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>体态调整建议</div>
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{posture.suggestions}</div>
        </div>
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => onGo("diet")} style={{ ...btnGhost, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 12 }}><Utensils size={18} color={C.jade} /> 记饮食</button>
        <button onClick={() => onGo("body")} style={{ ...btnGhost, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 12 }}><Scale size={18} color={C.gold} /> 记体测</button>
        <button onClick={() => onGo("train")} style={{ ...btnGhost, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 12 }}><Dumbbell size={18} color={C.coral} /> 记训练</button>
      </div>
    </div>
  );
}

function ClientDietTab({ log, onAdd }) {
  const [mealType, setMealType] = useState("早餐");
  const [desc, setDesc] = useState("");
  const [isTrip, setIsTrip] = useState(false);
  const [tripLocation, setTripLocation] = useState("");
  function submit() {
    if (!desc.trim()) return;
    onAdd({ date: todayStr(), meal_type: mealType, description: desc.trim(), is_trip: isTrip, trip_location: isTrip ? tripLocation.trim() : null });
    setDesc(""); setTripLocation("");
  }
  return (
    <div>
      <div style={{ ...cardSt, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>记录今日饮食</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {["早餐", "午餐", "晚餐", "加餐"].map((m) => (
            <button key={m} onClick={() => setMealType(m)} style={{ background: mealType === m ? C.jadeDim : "transparent", color: mealType === m ? C.jade : C.muted, border: `1px solid ${C.border}`, borderRadius: 20, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>{m}</button>
          ))}
        </div>
        <textarea style={{ ...inputSt, minHeight: 70, marginBottom: 10, resize: "vertical" }} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="吃了什么？大致分量？例如：鸡胸肉150g+糙米一碗+西兰花" />
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.muted, marginBottom: 10 }}>
          <input type="checkbox" checked={isTrip} onChange={(e) => setIsTrip(e.target.checked)} /> <Plane size={13} /> 出差/在外地
        </label>
        {isTrip && <input style={{ ...inputSt, marginBottom: 10 }} value={tripLocation} onChange={(e) => setTripLocation(e.target.value)} placeholder="所在城市/地点" />}
        <button style={btnPrimary} onClick={submit}>保存记录</button>
      </div>
      {log.length === 0 ? <EmptyState text="还没有饮食记录" /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {log.map((e) => (
            <div key={e.id} style={cardSt}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: C.muted }}>{fmtDate(e.date)} · {e.meal_type}</span>
                {e.is_trip && <TripBadge />}
              </div>
              <div style={{ fontSize: 13, marginTop: 6 }}>{e.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClientBodyTab({ log, onAdd }) {
  const [weight, setWeight] = useState("");
  const [bodyfat, setBodyfat] = useState("");
  function submit() {
    const w = parseFloat(weight);
    if (!w) return;
    onAdd({ date: todayStr(), weight: w, bodyfat: bodyfat ? parseFloat(bodyfat) : null });
    setWeight(""); setBodyfat("");
  }
  const chartData = [...log].sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({ date: fmtDate(d.date), 体重: d.weight, 体脂: d.bodyfat }));
  return (
    <div>
      <div style={{ ...cardSt, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>记录体重 / 体脂</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelSt}>体重 (kg)</label>
            <input style={inputSt} value={weight} inputMode="decimal" onChange={(e) => setWeight(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="70.5" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelSt}>体脂 % (可选)</label>
            <input style={inputSt} value={bodyfat} inputMode="decimal" onChange={(e) => setBodyfat(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="18.5" />
          </div>
        </div>
        <button style={btnPrimary} onClick={submit}>保存记录</button>
      </div>
      <div style={{ ...cardSt, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>趋势</div>
        {chartData.length === 0 ? <EmptyState text="还没有记录" /> : (
          <ResponsiveContainer width="100%" height={190}>
            <LineChart data={chartData} margin={{ top: 5, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke={C.muted} fontSize={11} />
              <YAxis yAxisId="left" stroke={C.jade} fontSize={11} domain={["auto", "auto"]} />
              <YAxis yAxisId="right" orientation="right" stroke={C.gold} fontSize={11} domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="left" type="monotone" dataKey="体重" stroke={C.jade} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line yAxisId="right" type="monotone" dataKey="体脂" stroke={C.gold} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      {log.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {log.map((e) => (
            <div key={e.id} style={{ ...cardSt, padding: 12, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: C.muted }}>{fmtDate(e.date)}</span>
              <span style={{ fontFamily: "'Roboto Mono', monospace" }}>{e.weight}kg{e.bodyfat != null ? ` · ${e.bodyfat}%` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClientTrainTab({ log, onAdd }) {
  const [type, setType] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [isTrip, setIsTrip] = useState(false);
  const [location, setLocation] = useState("");
  function submit() {
    if (!type.trim() || !duration) return;
    onAdd({ date: todayStr(), type: type.trim(), duration: parseInt(duration, 10), notes: notes.trim(), is_trip: isTrip, location: isTrip ? location.trim() : null });
    setType(""); setDuration(""); setNotes(""); setLocation("");
  }
  return (
    <div>
      <div style={{ ...cardSt, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>记录本次训练</div>
        <label style={labelSt}>训练类型</label>
        <input style={{ ...inputSt, marginBottom: 10 }} value={type} onChange={(e) => setType(e.target.value)} placeholder="例如：酒店房间自重训练 / 跑步 / 力量" />
        <label style={labelSt}>时长（分钟）</label>
        <input style={{ ...inputSt, marginBottom: 10 }} value={duration} inputMode="numeric" onChange={(e) => setDuration(e.target.value.replace(/\D/g, ""))} placeholder="30" />
        <label style={labelSt}>备注</label>
        <textarea style={{ ...inputSt, minHeight: 60, marginBottom: 10, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="动作/感受/强度" />
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.muted, marginBottom: 10 }}>
          <input type="checkbox" checked={isTrip} onChange={(e) => setIsTrip(e.target.checked)} /> <Plane size={13} /> 出差期间训练
        </label>
        {isTrip && <input style={{ ...inputSt, marginBottom: 10 }} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="所在城市/地点" />}
        <button style={btnPrimary} onClick={submit}>保存记录</button>
      </div>
      <TrainListReadOnly log={log} />
    </div>
  );
}
