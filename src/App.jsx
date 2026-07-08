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
