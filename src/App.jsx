import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Users, User, Utensils, Scale, Dumbbell, ClipboardList, LogOut, Plus,
  Plane, TrendingUp, TrendingDown, Minus, ChevronRight, X, Check,
  ArrowLeft, Loader2, ImagePlus, Home, Ruler, Mail, Lock, Flame, Sparkles, Trophy,
  MessageCircle, Send, CalendarDays, Ticket, Undo2,
} from "lucide-react";
import { supabase } from "./supabaseClient";

/* ---------------- 视觉设定 ---------------- */
const C = {
  bg: "#12171B", panel: "#1B2228", panelAlt: "#212A31", border: "#2B353D",
  text: "#EDF1F1", muted: "#8A969D", jade: "#3FA372", jadeDim: "#274A3A",
  jadeBright: "#4FD08C", gold: "#C9A15A", goldBright: "#E4C486", coral: "#D9765F",
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

/* ---------------- 动力小工具：连续打卡 / 本周活跃 / 数字滚动 ---------------- */
function computeStreak(dateStrs) {
  const days = new Set(dateStrs.filter(Boolean));
  if (days.size === 0) return 0;
  const oneDay = 86400000;
  let cursor = new Date(`${todayStr()}T00:00:00`);
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor = new Date(cursor.getTime() - oneDay);
    if (!days.has(cursor.toISOString().slice(0, 10))) return 0;
  }
  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - oneDay);
  }
  return streak;
}
function activeDaysThisWeek(dateStrs) {
  const days = new Set(dateStrs.filter(Boolean));
  const now = new Date(`${todayStr()}T00:00:00`);
  const dow = (now.getDay() + 6) % 7; // 周一=0
  let count = 0;
  for (let i = 0; i <= dow; i++) {
    const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
    if (days.has(d)) count += 1;
  }
  return count;
}
const MOTIVATIONAL_LINES = [
  "今天也要成为更强的自己 💪",
  "每一次记录，都是进步的证据",
  "身体是最诚实的语言，继续对话吧",
  "坚持，是为了配得上更好的自己",
  "强壮不是终点，是每天的选择",
  "微小的积累，正在改变你的身体",
  "汗水不会说谎，继续前进",
];
function motivationalLine() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const diff = new Date() - start;
  const dayOfYear = Math.floor(diff / 86400000);
  return MOTIVATIONAL_LINES[dayOfYear % MOTIVATIONAL_LINES.length];
}
function greetingWord() {
  const h = new Date().getHours();
  if (h < 5) return "夜深了";
  if (h < 11) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}
function AnimatedNumber({ value, decimals = 1, suffix = "" }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const target = typeof value === "number" ? value : 0;
    const from = fromRef.current;
    const start = performance.now();
    const dur = 700;
    let raf;
    function tick(now) {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  if (typeof value !== "number") return <>--</>;
  return <>{display.toFixed(decimals)}{suffix}</>;
}
function ActivityRing({ value, total = 7, size = 54, color = C.jadeBright }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke={C.border} strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.22,1,.36,1)" }}
      />
    </svg>
  );
}
function StreakBadge({ days }) {
  if (!days) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700,
      color: C.goldBright, background: "linear-gradient(135deg, rgba(201,161,90,0.22), rgba(217,118,95,0.16))",
      border: `1px solid rgba(201,161,90,0.4)`, borderRadius: 20, padding: "3px 10px",
    }}>
      <Flame size={13} color={C.goldBright} /> 连续打卡 {days} 天
    </span>
  );
}

/* ---------------- 庆祝提示 Toast ---------------- */
const SUCCESS_LINES = [
  "记录成功，继续加油！", "太棒了，又前进一步！", "干得漂亮，坚持就是胜利！",
  "已保存，你正在变得更强！", "这一步，值得为自己鼓掌！",
];
function useCelebration() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);
  const fire = useCallback((opts = {}) => {
    const { big = false, message } = opts;
    clearTimeout(timerRef.current);
    setToast({
      id: uid(), big,
      message: message || SUCCESS_LINES[Math.floor(Math.random() * SUCCESS_LINES.length)],
    });
    timerRef.current = setTimeout(() => setToast(null), big ? 2600 : 1800);
  }, []);
  return [toast, fire];
}
function CelebrationToast({ toast }) {
  if (!toast) return null;
  return (
    <div key={toast.id} style={{
      position: "fixed", left: "50%", bottom: toast.big ? "50%" : 96, transform: toast.big ? "translate(-50%,50%)" : "translateX(-50%)",
      zIndex: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      animation: toast.big ? "popIn 420ms cubic-bezier(.22,1.4,.36,1)" : "toastUp 320ms cubic-bezier(.22,1,.36,1)",
      pointerEvents: "none",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: toast.big ? `linear-gradient(135deg, ${C.jade}, ${C.jadeDim})` : C.panelAlt,
        border: `1px solid ${toast.big ? C.jadeBright : C.border}`,
        color: C.text, borderRadius: 999, padding: toast.big ? "14px 22px" : "9px 16px",
        fontSize: toast.big ? 15 : 13, fontWeight: 700, boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        whiteSpace: "nowrap",
      }}>
        {toast.big ? <Trophy size={18} color={C.goldBright} /> : <Check size={15} color={C.jadeBright} />}
        {toast.message}
      </div>
    </div>
  );
}

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
          律动 <span style={{ color: C.gold, fontSize: 13, fontWeight: 400, letterSpacing: 2 }}>PULSE</span>
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
function EmptyState({ text, icon: Icon }) {
  return (
    <div style={{ textAlign: "center", padding: "34px 10px", color: C.muted, fontSize: 13 }}>
      {Icon && (
        <div style={{
          width: 44, height: 44, margin: "0 auto 10px", borderRadius: "50%", background: C.panelAlt,
          border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center",
        }}><Icon size={20} color={C.muted} /></div>
      )}
      {text}
    </div>
  );
}
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
        @keyframes fadeInUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes popIn{0%{opacity:0;transform:translate(-50%,50%) scale(.75)}60%{opacity:1;transform:translate(-50%,50%) scale(1.05)}100%{opacity:1;transform:translate(-50%,50%) scale(1)}}
        @keyframes toastUp{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translateX(-50%)}}
        @keyframes glowPulse{0%,100%{box-shadow:0 0 0 0 rgba(63,163,114,0.35)}50%{box-shadow:0 0 0 6px rgba(63,163,114,0)}}
        .fade-up{animation:fadeInUp 420ms cubic-bezier(.22,1,.36,1) both}
        .press-fx{transition:transform 120ms ease}
        .press-fx:active{transform:scale(0.96)}
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
        <div style={{ fontFamily: "'Noto Serif SC', serif", fontSize: 30, fontWeight: 700, letterSpacing: 2 }}>律动</div>
        <div style={{ fontSize: 12, color: C.gold, letterSpacing: 4, marginTop: 4 }}>PULSE · 私教客户管理</div>
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
      <button className="press-fx" style={btnPrimary} onClick={submit} disabled={busy}>
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
    const [{ data: cl }, { data: unread }, { data: pending }] = await Promise.all([
      supabase.from("profiles").select("*").eq("role", "client").order("name"),
      supabase.from("messages").select("client_id").eq("read_by_coach", false),
      supabase.from("appointments").select("client_id").eq("status", "pending"),
    ]);
    setClients(cl || []);
    const unreadCounts = {};
    (unread || []).forEach((m) => { unreadCounts[m.client_id] = (unreadCounts[m.client_id] || 0) + 1; });
    const pendingCounts = {};
    (pending || []).forEach((a) => { pendingCounts[a.client_id] = (pendingCounts[a.client_id] || 0) + 1; });
    const sums = await Promise.all((cl || []).map(async (c) => {
      const { data: body } = await supabase.from("body_logs").select("date,weight,bodyfat").eq("user_id", c.id).order("date", { ascending: false }).limit(2);
      const last = body?.[0], prev = body?.[1];
      return {
        id: c.id, name: c.name,
        weight: last?.weight ?? null, bodyfat: last?.bodyfat ?? null,
        delta: last && prev ? +(last.weight - prev.weight).toFixed(1) : null,
        lastDate: last?.date ?? null,
        unread: unreadCounts[c.id] || 0,
        pendingAppointments: pendingCounts[c.id] || 0,
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
        {!loading && clients.length === 0 && <EmptyState text="还没有客户注册。把 App 链接发给客户，请他们自行注册即可。" icon={Users} />}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {clients.map((c, i) => {
            const s = map[c.id];
            return (
              <button key={c.id} onClick={() => onOpen(c)} className="fade-up press-fx" style={{ ...cardSt, textAlign: "left", cursor: "pointer", color: C.text, animationDelay: `${Math.min(i * 40, 280)}ms` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 36, height: 36, borderRadius: "50%", background: C.jadeDim, color: C.jade, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>{c.name.slice(0, 1)}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                        {c.name}
                        {!!s?.unread && <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: C.coral, borderRadius: 20, padding: "1px 6px" }}>{s.unread} 条新消息</span>}
                        {!!s?.pendingAppointments && <span style={{ fontSize: 10, fontWeight: 700, color: C.goldBright, background: "rgba(201,161,90,0.18)", borderRadius: 20, padding: "1px 6px" }}>{s.pendingAppointments} 个待确认</span>}
                      </div>
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
    { k: "booking", label: "预约", icon: CalendarDays },
    { k: "sessions", label: "课时", icon: Ticket },
    { k: "chat", label: "聊天", icon: MessageCircle },
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
          <button key={t.k} onClick={() => setTab(t.k)} className="press-fx" style={{
            background: "none", border: "none", cursor: "pointer", padding: "10px 12px",
            color: tab === t.k ? C.jadeBright : C.muted, borderBottom: tab === t.k ? `2px solid ${C.jadeBright}` : "2px solid transparent",
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
        {tab === "booking" && <CoachAppointmentsPanel client={client} />}
        {tab === "sessions" && <SessionPackagePanel client={client} />}
        {tab === "chat" && <ChatScreen clientId={client.id} myRole="coach" embedded />}
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
        {chartData.length === 0 ? <EmptyState text="客户还没有体测记录" icon={TrendingUp} /> : (
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
        ) : <EmptyState text="还未布置训练计划" icon={ClipboardList} />}
      </div>
    </div>
  );
}

function DietListReadOnly({ log }) {
  if (log.length === 0) return <EmptyState text="客户还没有记录饮食" icon={Utensils} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {log.map((e, i) => (
        <div key={e.id} className="fade-up" style={{ ...cardSt, animationDelay: `${Math.min(i * 40, 280)}ms` }}>
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
  if (log.length === 0) return <EmptyState text="还没有训练记录" icon={Dumbbell} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {log.map((e, i) => (
        <div key={e.id} className="fade-up" style={{ ...cardSt, animationDelay: `${Math.min(i * 40, 280)}ms` }}>
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
        <button onClick={() => setShowForm((v) => !v)} className="press-fx" style={{ ...btnPrimary, width: "100%", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Plus size={16} /> 布置新的训练计划
        </button>
      )}
      {showForm && (
        <div style={{ ...cardSt, marginBottom: 14 }}>
          <label style={labelSt}>计划标题</label>
          <input style={{ ...inputSt, marginBottom: 10 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：下肢力量 + 体态激活" />
          <label style={labelSt}>内容 / 动作安排</label>
          <textarea style={{ ...inputSt, minHeight: 90, marginBottom: 10, resize: "vertical" }} value={content} onChange={(e) => setContent(e.target.value)} placeholder="例如：&#10;1. 臀桥 3x15&#10;2. 靠墙天使式 3x10（改善圆肩）&#10;3. 农夫行走 4x30m" />
          <button className="press-fx" style={btnPrimary} onClick={submit}>保存计划</button>
        </div>
      )}
      {plans.length === 0 ? <EmptyState text="还没有训练计划记录" icon={ClipboardList} /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {plans.map((p, i) => (
            <div key={p.id} className="fade-up" style={{ ...cardSt, animationDelay: `${Math.min(i * 40, 280)}ms` }}>
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
          <button className="press-fx" style={{ ...btnPrimary, marginTop: 10, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }} onClick={handleSave}>
            {saved ? <><Check size={15} /> 已保存</> : "保存评估与建议"}
          </button>
        )}
      </div>
      <PostureCompareCard photos={photos} />
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
        {photos.length === 0 ? <EmptyState text="还没有体态照片" icon={ImagePlus} /> : (
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

/* ---------------- 体态变化滑动对比 ---------------- */
function PostureCompareCard({ photos }) {
  const [label, setLabel] = useState("正面");
  const [beforeId, setBeforeId] = useState("");
  const [afterId, setAfterId] = useState("");
  const [pct, setPct] = useState(50);
  const draggingRef = useRef(false);
  const boxRef = useRef(null);

  const group = photos.filter((p) => p.label === label).slice().sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));

  useEffect(() => {
    if (group.length >= 2) {
      setBeforeId((id) => (group.some((p) => p.id === id) ? id : group[0].id));
      setAfterId((id) => (group.some((p) => p.id === id) ? id : group[group.length - 1].id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, photos.length]);

  const before = group.find((p) => p.id === beforeId);
  const after = group.find((p) => p.id === afterId);

  function updatePct(clientX) {
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    setPct(Math.round((x / rect.width) * 100));
  }
  function onDown(e) { draggingRef.current = true; updatePct(e.touches ? e.touches[0].clientX : e.clientX); }
  function onMove(e) { if (draggingRef.current) updatePct(e.touches ? e.touches[0].clientX : e.clientX); }
  function onUp() { draggingRef.current = false; }

  return (
    <div style={{ ...cardSt, marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>体态变化对比</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        {["正面", "侧面", "背面"].map((l) => (
          <button key={l} onClick={() => setLabel(l)} style={{ background: label === l ? C.jadeDim : "transparent", color: label === l ? C.jade : C.muted, border: `1px solid ${C.border}`, borderRadius: 20, padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>{l}</button>
        ))}
      </div>
      {group.length < 2 ? (
        <EmptyState text={`${label}角度还没有两张以上照片，先多拍几次再来对比吧`} icon={Ruler} />
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>之前</label>
              <select style={inputSt} value={beforeId} onChange={(e) => setBeforeId(e.target.value)}>
                {group.map((p) => <option key={p.id} value={p.id}>{fmtDate(p.created_at?.slice(0, 10))}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>之后</label>
              <select style={inputSt} value={afterId} onChange={(e) => setAfterId(e.target.value)}>
                {group.map((p) => <option key={p.id} value={p.id}>{fmtDate(p.created_at?.slice(0, 10))}</option>)}
              </select>
            </div>
          </div>
          <div
            ref={boxRef}
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
            onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
            style={{ position: "relative", height: 260, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.border}`, cursor: "ew-resize", userSelect: "none", touchAction: "none" }}
          >
            {after?.url && <img src={after.url} alt="之后" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
            {before?.url && (
              <img src={before.url} alt="之前" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", clipPath: `inset(0 ${100 - pct}% 0 0)` }} />
            )}
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pct}%`, width: 2, background: C.goldBright, transform: "translateX(-1px)" }} />
            <div style={{ position: "absolute", top: "50%", left: `${pct}%`, transform: "translate(-50%,-50%)", width: 28, height: 28, borderRadius: "50%", background: C.goldBright, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
              <div style={{ width: 10, height: 10, borderLeft: "2px solid #12171B", borderRight: "2px solid #12171B" }} />
            </div>
            <span style={{ position: "absolute", left: 8, bottom: 8, fontSize: 10, background: "rgba(0,0,0,0.5)", color: "#fff", padding: "2px 6px", borderRadius: 6 }}>之前</span>
            <span style={{ position: "absolute", right: 8, bottom: 8, fontSize: 10, background: "rgba(0,0,0,0.5)", color: "#fff", padding: "2px 6px", borderRadius: 6 }}>之后</span>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- 聊天 ---------------- */
function ChatScreen({ clientId, myRole, onBack, embedded = false }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [myId, setMyId] = useState(null);
  const listRef = useRef(null);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null)); }, []);

  const markRead = useCallback(async () => {
    const field = myRole === "coach" ? "read_by_coach" : "read_by_client";
    await supabase.from("messages").update({ [field]: true }).eq("client_id", clientId).eq(field, false);
  }, [clientId, myRole]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("messages").select("*").eq("client_id", clientId).order("created_at", { ascending: true });
    setMessages(data || []);
    setLoading(false);
    markRead();
  }, [clientId, markRead]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`messages-${clientId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `client_id=eq.${clientId}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
        if (payload.new.sender_role !== myRole) markRead();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clientId, myRole, markRead]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const body = text.trim();
    if (!body || !myId) return;
    setSending(true);
    setText("");
    const field = myRole === "coach" ? "read_by_coach" : "read_by_client";
    const otherField = myRole === "coach" ? "read_by_client" : "read_by_coach";
    await supabase.from("messages").insert({
      client_id: clientId, sender_id: myId, sender_role: myRole, body,
      [field]: true, [otherField]: false,
    });
    setSending(false);
  }

  return (
    <div style={embedded
      ? { display: "flex", flexDirection: "column", height: 460, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }
      : { flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}
    >
      {!embedded && (
        <div style={{ padding: "16px 20px 10px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", display: "flex" }}><ArrowLeft size={18} /></button>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{myRole === "coach" ? "与客户聊天" : "与教练聊天"}</div>
        </div>
      )}
      <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {loading ? <CenterLoader /> : messages.length === 0 ? (
          <EmptyState text="还没有消息，打个招呼吧" icon={MessageCircle} />
        ) : messages.map((m) => {
          const mine = m.sender_role === myRole;
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "78%", padding: "9px 13px", borderRadius: 14,
                background: mine ? C.jade : C.panelAlt, color: mine ? "#0C1210" : C.text,
                fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                border: mine ? "none" : `1px solid ${C.border}`,
              }}>
                {m.body}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, padding: "10px 14px", borderTop: `1px solid ${C.border}`, paddingBottom: embedded ? 10 : "max(10px, env(safe-area-inset-bottom))" }}>
        <input
          style={{ ...inputSt, flex: 1 }} value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="输入消息…"
        />
        <button className="press-fx" onClick={send} disabled={sending || !text.trim()} style={{ ...btnPrimary, width: 44, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

/* ---------------- 到店预约 ---------------- */
function statusBadge(status) {
  const map = {
    pending: { label: "待确认", bg: "rgba(201,161,90,0.18)", color: C.goldBright },
    confirmed: { label: "已确认", bg: C.jadeDim, color: C.jade },
    declined: { label: "已婉拒", bg: "rgba(217,118,95,0.18)", color: C.coral },
    cancelled: { label: "已取消", bg: "rgba(217,118,95,0.18)", color: C.coral },
    completed: { label: "已完成", bg: C.panelAlt, color: C.muted },
  };
  const s = map[status] || map.pending;
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>{s.label}</span>;
}

function ClientBookingScreen({ profile, onBack }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("appointments").select("*").eq("client_id", profile.id)
      .order("requested_date", { ascending: false }).order("requested_time", { ascending: false });
    setList(data || []);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!date || !time) return;
    setBusy(true);
    await supabase.from("appointments").insert({ client_id: profile.id, requested_date: date, requested_time: time, note: note.trim() || null, status: "pending" });
    setDate(""); setTime(""); setNote("");
    setBusy(false);
    load();
  }
  async function cancel(id) {
    await supabase.from("appointments").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id);
    load();
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ padding: "16px 20px 10px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", display: "flex" }}><ArrowLeft size={18} /></button>
        <div style={{ fontSize: 15, fontWeight: 700 }}>到店预约</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
        <div style={{ ...cardSt, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>申请到店时间</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>日期</label>
              <input type="date" style={inputSt} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>时间</label>
              <input type="time" style={inputSt} value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <label style={labelSt}>备注（可选）</label>
          <textarea style={{ ...inputSt, minHeight: 60, marginBottom: 10, resize: "vertical" }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="想练的部位/特殊情况…" />
          <button className="press-fx" style={btnPrimary} onClick={submit} disabled={busy || !date || !time}>{busy ? "提交中…" : "提交预约申请"}</button>
        </div>
        {loading ? <CenterLoader /> : list.length === 0 ? <EmptyState text="还没有预约记录" icon={CalendarDays} /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {list.map((a) => (
              <div key={a.id} className="fade-up" style={cardSt}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{fmtDate(a.requested_date)} {a.requested_time}</div>
                  {statusBadge(a.status)}
                </div>
                {a.note && <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{a.note}</div>}
                {a.coach_note && <div style={{ fontSize: 12, color: C.gold, marginTop: 4 }}>教练回复：{a.coach_note}</div>}
                {(a.status === "pending" || a.status === "confirmed") && (
                  <button className="press-fx" onClick={() => cancel(a.id)} style={{ ...btnGhost, marginTop: 10, fontSize: 12, padding: "6px 12px" }}>取消预约</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AppointmentCoachRow({ a, onRespond }) {
  const [replyNote, setReplyNote] = useState("");
  const [showDecline, setShowDecline] = useState(false);
  return (
    <div className="fade-up" style={cardSt}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{fmtDate(a.requested_date)} {a.requested_time}</div>
        {statusBadge(a.status)}
      </div>
      {a.note && <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>客户备注：{a.note}</div>}
      {a.coach_note && <div style={{ fontSize: 12, color: C.gold, marginTop: 4 }}>{a.coach_note}</div>}
      {a.status === "pending" && !showDecline && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button className="press-fx" style={{ ...btnPrimary, flex: 1, fontSize: 12, padding: "8px 0" }} onClick={() => onRespond(a.id, "confirmed")}>确认</button>
          <button className="press-fx" style={{ ...btnGhost, flex: 1, fontSize: 12, padding: "8px 0" }} onClick={() => setShowDecline(true)}>婉拒</button>
        </div>
      )}
      {showDecline && (
        <div style={{ marginTop: 10 }}>
          <input style={{ ...inputSt, marginBottom: 8, fontSize: 12 }} value={replyNote} onChange={(e) => setReplyNote(e.target.value)} placeholder="婉拒原因（可选）" />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="press-fx" style={{ ...btnPrimary, flex: 1, fontSize: 12, padding: "8px 0", background: C.coral }} onClick={() => { onRespond(a.id, "declined", replyNote.trim()); setShowDecline(false); }}>确认婉拒</button>
            <button className="press-fx" style={{ ...btnGhost, flex: 1, fontSize: 12, padding: "8px 0" }} onClick={() => setShowDecline(false)}>取消</button>
          </div>
        </div>
      )}
      {a.status === "confirmed" && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button className="press-fx" style={{ ...btnPrimary, flex: 1, fontSize: 12, padding: "8px 0" }} onClick={() => onRespond(a.id, "completed")}>标记已完成</button>
          <button className="press-fx" style={{ ...btnGhost, flex: 1, fontSize: 12, padding: "8px 0" }} onClick={() => onRespond(a.id, "cancelled")}>取消</button>
        </div>
      )}
    </div>
  );
}

function CoachAppointmentsPanel({ client }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("appointments").select("*").eq("client_id", client.id)
      .order("requested_date", { ascending: false }).order("requested_time", { ascending: false });
    setList(data || []);
    setLoading(false);
  }, [client.id]);

  useEffect(() => { load(); }, [load]);

  async function respond(id, status, coach_note) {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("appointments").update({ status, coach_note: coach_note || null, coach_id: user.id, updated_at: new Date().toISOString() }).eq("id", id);
    load();
  }
  async function addDirect() {
    if (!date || !time) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("appointments").insert({ client_id: client.id, coach_id: user.id, requested_date: date, requested_time: time, note: note.trim() || null, status: "confirmed" });
    setDate(""); setTime(""); setNote("");
    load();
  }

  return (
    <div>
      <div style={{ ...cardSt, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>直接安排到店时间</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelSt}>日期</label>
            <input type="date" style={inputSt} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelSt}>时间</label>
            <input type="time" style={inputSt} value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <input style={{ ...inputSt, marginBottom: 10 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="备注（可选）" />
        <button className="press-fx" style={btnPrimary} onClick={addDirect} disabled={!date || !time}>直接确认排期</button>
      </div>
      {loading ? <CenterLoader /> : list.length === 0 ? <EmptyState text="还没有预约记录" icon={CalendarDays} /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map((a) => <AppointmentCoachRow key={a.id} a={a} onRespond={respond} />)}
        </div>
      )}
    </div>
  );
}

/* ---------------- 课时管理 ---------------- */
function SessionPackagePanel({ client }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [total, setTotal] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("session_packages").select("*").eq("client_id", client.id).order("created_at", { ascending: false });
    setList(data || []);
    setLoading(false);
  }, [client.id]);

  useEffect(() => { load(); }, [load]);

  async function addPackage() {
    const t = parseInt(total, 10);
    if (!t || t <= 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("session_packages").insert({
      client_id: client.id, coach_id: user.id, total_sessions: t,
      price: price ? parseFloat(price) : null, purchase_date: todayStr(), note: note.trim() || null,
    });
    setTotal(""); setPrice(""); setNote(""); setShowForm(false);
    load();
  }
  async function bump(pkg, delta) {
    const next = Math.min(pkg.total_sessions, Math.max(0, pkg.used_sessions + delta));
    await supabase.from("session_packages").update({ used_sessions: next }).eq("id", pkg.id);
    load();
  }

  return (
    <div>
      <button onClick={() => setShowForm((v) => !v)} className="press-fx" style={{ ...btnPrimary, width: "100%", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <Plus size={16} /> 购买新课时包
      </button>
      {showForm && (
        <div style={{ ...cardSt, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>总节数</label>
              <input style={inputSt} value={total} inputMode="numeric" onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))} placeholder="10" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelSt}>金额（可选）</label>
              <input style={inputSt} value={price} inputMode="decimal" onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="3000" />
            </div>
          </div>
          <label style={labelSt}>备注（可选）</label>
          <input style={{ ...inputSt, marginBottom: 10 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="例如：私教10次卡" />
          <button className="press-fx" style={btnPrimary} onClick={addPackage}>保存课时包</button>
        </div>
      )}
      {loading ? <CenterLoader /> : list.length === 0 ? <EmptyState text="还没有课时包记录" icon={Ticket} /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map((p) => {
            const remaining = p.total_sessions - p.used_sessions;
            const pct = Math.min(100, (p.used_sessions / p.total_sessions) * 100);
            return (
              <div key={p.id} className="fade-up" style={cardSt}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{p.note || "课时包"}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{fmtDate(p.purchase_date)}</div>
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 8, marginBottom: 4 }}>
                  已用 {p.used_sessions} / {p.total_sessions} 节 · 剩余 <b style={{ color: remaining > 0 ? C.jadeBright : C.coral }}>{remaining}</b>
                  {p.price != null && <span> · ¥{p.price}</span>}
                </div>
                <div style={{ height: 6, borderRadius: 4, background: C.panelAlt, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: C.jade, transition: "width 300ms" }} />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button className="press-fx" style={{ ...btnPrimary, flex: 1, fontSize: 12, padding: "8px 0" }} onClick={() => bump(p, 1)} disabled={remaining <= 0}>记一次消课</button>
                  <button className="press-fx" style={{ ...btnGhost, flex: 1, fontSize: 12, padding: "8px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }} onClick={() => bump(p, -1)} disabled={p.used_sessions <= 0}><Undo2 size={13} /> 撤销上一次</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   客户端
   ================================================================ */
function ClientApp({ profile }) {
  const [screen, setScreen] = useState("tabs");
  const [tab, setTab] = useState("home");
  const [dietLog, setDietLog] = useState([]);
  const [bodyLog, setBodyLog] = useState([]);
  const [trainLog, setTrainLog] = useState([]);
  const [plans, setPlans] = useState([]);
  const [posture, setPosture] = useState({ assessment: "", suggestions: "" });
  const [photos, setPhotos] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [packages, setPackages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data: d }, { data: b }, { data: t }, { data: p }, { data: pos }, { data: ph }, { data: ap }, { data: pk }, { data: unread }] = await Promise.all([
      supabase.from("diet_logs").select("*").eq("user_id", profile.id).order("date", { ascending: false }),
      supabase.from("body_logs").select("*").eq("user_id", profile.id).order("date", { ascending: false }),
      supabase.from("train_logs").select("*").eq("user_id", profile.id).order("date", { ascending: false }),
      supabase.from("plans").select("*").eq("client_id", profile.id).order("date", { ascending: false }),
      supabase.from("posture").select("*").eq("client_id", profile.id).maybeSingle(),
      supabase.from("posture_photos").select("*").eq("client_id", profile.id).order("created_at", { ascending: false }),
      supabase.from("appointments").select("*").eq("client_id", profile.id).order("requested_date", { ascending: true }).order("requested_time", { ascending: true }),
      supabase.from("session_packages").select("*").eq("client_id", profile.id),
      supabase.from("messages").select("id").eq("client_id", profile.id).eq("read_by_client", false),
    ]);
    setDietLog(d || []); setBodyLog(b || []); setTrainLog(t || []); setPlans(p || []);
    setPosture(pos || { assessment: "", suggestions: "" });
    setAppointments(ap || []); setPackages(pk || []); setUnreadCount((unread || []).length);
    const withUrls = await Promise.all((ph || []).map(async (row) => {
      const { data } = await supabase.storage.from("posture-photos").createSignedUrl(row.image_path, 3600);
      return { ...row, url: data?.signedUrl };
    }));
    setPhotos(withUrls);
    setLoading(false);
  }, [profile.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const allDates = [...dietLog.map((e) => e.date), ...bodyLog.map((e) => e.date), ...trainLog.map((e) => e.date)];
  const streak = computeStreak(allDates);
  const activeDays = activeDaysThisWeek(allDates);
  const [toast, fireCelebration] = useCelebration();

  function celebrateAfter(prevStreak) {
    const newStreak = computeStreak([...allDates, todayStr()]);
    if (newStreak > prevStreak && [3, 7, 14, 30, 60, 100].includes(newStreak)) {
      fireCelebration({ big: true, message: `连续打卡 ${newStreak} 天！你比昨天更强壮 🏆` });
    } else {
      fireCelebration();
    }
  }

  async function addDiet(entry) { const s = streak; await supabase.from("diet_logs").insert({ user_id: profile.id, ...entry }); await loadAll(); celebrateAfter(s); }
  async function addBody(entry) { const s = streak; await supabase.from("body_logs").insert({ user_id: profile.id, ...entry }); await loadAll(); celebrateAfter(s); }
  async function addTrain(entry) { const s = streak; await supabase.from("train_logs").insert({ user_id: profile.id, ...entry }); await loadAll(); celebrateAfter(s); }
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

  const nextAppointment = appointments.find((a) => (a.status === "pending" || a.status === "confirmed") && a.requested_date >= todayStr());
  const remainingSessions = packages.reduce((sum, p) => sum + (p.total_sessions - p.used_sessions), 0);

  if (loading) return <CenterLoader />;

  if (screen === "chat") {
    return <ChatScreen clientId={profile.id} myRole="client" onBack={() => { setScreen("tabs"); loadAll(); }} />;
  }
  if (screen === "booking") {
    return <ClientBookingScreen profile={profile} onBack={() => { setScreen("tabs"); loadAll(); }} />;
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ padding: "18px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}` }}>
        <Brand subtitle={`你好，${profile.name}`} />
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => setScreen("chat")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", position: "relative", display: "flex" }}>
            <MessageCircle size={19} />
            {unreadCount > 0 && <span style={{ position: "absolute", top: -3, right: -3, width: 9, height: 9, borderRadius: "50%", background: C.coral, border: `1.5px solid ${C.panel}` }} />}
          </button>
          <button onClick={() => supabase.auth.signOut()} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><LogOut size={19} /></button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 18, paddingBottom: 90 }}>
        {tab === "home" && (
          <ClientHomeTab
            profile={profile} bodyLog={bodyLog} plans={plans} posture={posture} streak={streak} activeDays={activeDays} onGo={setTab}
            nextAppointment={nextAppointment} remainingSessions={remainingSessions} hasPackages={packages.length > 0}
            onOpenBooking={() => setScreen("booking")}
          />
        )}
        {tab === "diet" && <ClientDietTab log={dietLog} onAdd={addDiet} />}
        {tab === "body" && <ClientBodyTab log={bodyLog} onAdd={addBody} />}
        {tab === "train" && <ClientTrainTab log={trainLog} onAdd={addTrain} />}
        {tab === "posture" && <PosturePanel posture={posture} photos={photos} editable={false} onAddPhoto={addPhoto} />}
      </div>
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, display: "flex", background: C.panel, borderTop: `1px solid ${C.border}`, padding: "8px 4px" }}>
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className="press-fx" style={{ flex: 1, background: "none", border: "none", cursor: "pointer", padding: "6px 0", color: tab === t.k ? C.jadeBright : C.muted, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontSize: 10 }}>
            <t.icon size={18} /> {t.label}
          </button>
        ))}
      </div>
      <CelebrationToast toast={toast} />
    </div>
  );
}

function ClientHomeTab({ profile, bodyLog, plans, posture, streak, activeDays, onGo, nextAppointment, remainingSessions, hasPackages, onOpenBooking }) {
  const latestPlan = plans[0];
  const latest = bodyLog[0];
  const prev = bodyLog[1];
  const weightDelta = latest && prev ? +(latest.weight - prev.weight).toFixed(1) : null;
  const bodyfatDelta = latest?.bodyfat != null && prev?.bodyfat != null ? +(latest.bodyfat - prev.bodyfat).toFixed(1) : null;
  const weekMsg = activeDays >= 5 ? "状态火热，保持住！" : activeDays >= 1 ? "已经在路上，继续加油" : "今天就迈出第一步吧";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="fade-up" style={{
        position: "relative", borderRadius: 20, padding: "22px 20px", overflow: "hidden",
        background: `radial-gradient(120% 140% at 100% 0%, rgba(63,163,114,0.28), transparent 60%), radial-gradient(120% 140% at 0% 100%, rgba(201,161,90,0.20), transparent 55%), linear-gradient(160deg, ${C.panel}, ${C.bg})`,
        border: `1px solid ${C.border}`,
      }}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{greetingWord()}，{profile.name}</div>
        <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Noto Serif SC', serif", lineHeight: 1.4 }}>{motivationalLine()}</div>
        {streak > 0 && <div style={{ marginTop: 12 }}><StreakBadge days={streak} /></div>}
      </div>

      <div className="fade-up" style={{ ...cardSt, display: "flex", alignItems: "center", gap: 14, animationDelay: "60ms" }}>
        <ActivityRing value={activeDays} total={7} size={50} color={C.jadeBright} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>本周活跃 {activeDays}/7 天</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{weekMsg}</div>
        </div>
        <Sparkles size={18} color={C.gold} />
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <div className="fade-up" style={{ ...cardSt, flex: 1, animationDelay: "100ms" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 11, color: C.muted }}>最新体重</div>
            <TrendArrow delta={weightDelta} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Roboto Mono', monospace", marginTop: 4, color: C.jadeBright }}>
            {latest?.weight != null ? <AnimatedNumber value={latest.weight} decimals={1} /> : "--"}<span style={{ fontSize: 12, color: C.muted }}>kg</span>
          </div>
        </div>
        <div className="fade-up" style={{ ...cardSt, flex: 1, animationDelay: "140ms" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 11, color: C.muted }}>最新体脂</div>
            <TrendArrow delta={bodyfatDelta} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Roboto Mono', monospace", marginTop: 4, color: C.goldBright }}>
            {latest?.bodyfat != null ? <AnimatedNumber value={latest.bodyfat} decimals={1} /> : "--"}<span style={{ fontSize: 12, color: C.muted }}>%</span>
          </div>
        </div>
      </div>

      <div className="fade-up" style={{ ...cardSt, background: `linear-gradient(135deg, ${C.jadeDim}, ${C.panel})`, animationDelay: "180ms" }}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>本次到店训练计划</div>
        {latestPlan ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{latestPlan.title}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 6, whiteSpace: "pre-wrap" }}>{latestPlan.content}</div>
          </>
        ) : <div style={{ fontSize: 13, color: C.muted }}>教练还未布置计划</div>}
      </div>

      <button onClick={onOpenBooking} className="fade-up press-fx" style={{ ...cardSt, display: "flex", alignItems: "center", gap: 12, animationDelay: "190ms", textAlign: "left", cursor: "pointer", color: C.text, width: "100%" }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: C.jadeDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <CalendarDays size={18} color={C.jade} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>到店预约</div>
          {nextAppointment ? (
            <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              {fmtDate(nextAppointment.requested_date)} {nextAppointment.requested_time}
              {statusBadge(nextAppointment.status)}
            </div>
          ) : <div style={{ fontSize: 13, fontWeight: 600 }}>点击申请下次到店时间</div>}
        </div>
        <ChevronRight size={16} color={C.muted} />
      </button>

      {hasPackages && (
        <div className="fade-up" style={{ ...cardSt, animationDelay: "205ms", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: C.jadeDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Ticket size={18} color={C.gold} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>剩余课时</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: remainingSessions > 0 ? C.jadeBright : C.coral }}>{remainingSessions} 节</div>
          </div>
        </div>
      )}

      {posture.suggestions && (
        <div className="fade-up" style={{ ...cardSt, animationDelay: "220ms" }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>体态调整建议</div>
          <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{posture.suggestions}</div>
        </div>
      )}

      <div className="fade-up" style={{ display: "flex", gap: 10, animationDelay: "260ms" }}>
        <button onClick={() => onGo("diet")} className="press-fx" style={{ ...btnGhost, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 12 }}><Utensils size={18} color={C.jadeBright} /> 记饮食</button>
        <button onClick={() => onGo("body")} className="press-fx" style={{ ...btnGhost, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 12 }}><Scale size={18} color={C.goldBright} /> 记体测</button>
        <button onClick={() => onGo("train")} className="press-fx" style={{ ...btnGhost, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: 12 }}><Dumbbell size={18} color={C.coral} /> 记训练</button>
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
        <button className="press-fx" style={btnPrimary} onClick={submit}>保存记录</button>
      </div>
      {log.length === 0 ? <EmptyState text="还没有饮食记录，记下第一餐吧" icon={Utensils} /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {log.map((e, i) => (
            <div key={e.id} className="fade-up" style={{ ...cardSt, animationDelay: `${Math.min(i * 40, 280)}ms` }}>
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
        <button className="press-fx" style={btnPrimary} onClick={submit}>保存记录</button>
      </div>
      <div style={{ ...cardSt, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>趋势</div>
        {chartData.length === 0 ? <EmptyState text="还没有记录，记下第一次体测吧" icon={Scale} /> : (
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
          {log.map((e, i) => (
            <div key={e.id} className="fade-up" style={{ ...cardSt, padding: 12, display: "flex", justifyContent: "space-between", fontSize: 13, animationDelay: `${Math.min(i * 40, 280)}ms` }}>
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
        <button className="press-fx" style={btnPrimary} onClick={submit}>保存记录</button>
      </div>
      <TrainListReadOnly log={log} />
    </div>
  );
}
