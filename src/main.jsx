import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Plus, Search, MoreHorizontal, Paperclip, ArrowUp, Image as ImageIcon,
  Brain, Trash2, Pencil, X, Menu, Sparkles, Check, Copy
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip
} from "recharts";
import "./styles.css";

const STORAGE = "minimal-ai-web-v1";

const initialChats = [
  {
    id: "welcome",
    title: "Новый разговор",
    messages: [
      {
        role: "assistant",
        content: "Привет! Я интерфейс будущего AI‑ассистента. Сейчас работаю в demo‑режиме, но все основные элементы уже интерактивны.",
      }
    ]
  }
];

const demoChart = [
  { name: "Янв", value: 12 },
  { name: "Фев", value: 18 },
  { name: "Мар", value: 10 },
  { name: "Апр", value: 24 },
  { name: "Май", value: 20 },
];

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE));
    return saved || { chats: initialChats, memory: [], memoryEnabled: true };
  } catch {
    return { chats: initialChats, memory: [], memoryEnabled: true };
  }
}

function solveLinear(text) {
  const s = text.replace(/\s+/g, "").replace("−", "-");
  if (!s.includes("=") || !s.toLowerCase().includes("x")) return null;
  const [l, r] = s.toLowerCase().split("=");
  const parse = (expr, x) => {
    const safe = expr.replace(/(\d)x/g, "$1*x").replace(/x/g, `(${x})`);
    if (!/^[0-9+*/().\-]+$/.test(safe)) throw new Error();
    return Function(`"use strict"; return (${safe})`)();
  };
  try {
    const l0=parse(l,0), l1=parse(l,1);
    const r0=parse(r,0), r1=parse(r,1);
    const a=(l1-l0)-(r1-r0), b=r0-l0;
    if (!Number.isFinite(a) || Math.abs(a)<1e-10) return null;
    const x=b/a;
    return `Решение\n\n1. Раскрываем скобки и приводим подобные.\n2. Получаем ${a.toFixed(2).replace(".00","")}x = ${b.toFixed(2).replace(".00","")}.\n3. Делим обе части на ${a.toFixed(2).replace(".00","")}.\n\nОтвет: x = ${Number.isInteger(x) ? x : Number(x.toFixed(5))}`;
  } catch { return null; }
}

function mockReply(text, attachments) {
  const t = text.toLowerCase();
  const equation = solveLinear(text);
  if (equation) return { type:"text", content: equation };
  if (t.includes("график") || t.includes("диаграмм")) return { type:"chart", content:"Демо-график" };
  if (t.includes("таблиц")) return {
    type:"table", content:"Пример таблицы",
    rows:[["Параметр","Значение","Статус"],["AI","Mock","Готов"],["Память","Локальная","Включена"],["Фото","Поддержка UI","Готово"]]
  };
  if (t.startsWith("запомни") || t.startsWith("помни")) {
    return { type:"memory", content:text.replace(/^(запомни|помни)\s*:?\s*/i,"") };
  }
  if (attachments?.length) return { type:"text", content:"Фото прикреплено. В demo‑режиме я пока не анализирую изображение, но компонент вложений уже готов для подключения vision‑модели." };
  return {
    type:"text",
    content:"Это demo‑ответ без настоящего AI.\n\nПопробуйте написать:\n• «реши 2x + 6 = 18»\n• «построй график»\n• «сделай таблицу»\n• «запомни: мне нравится минимализм»"
  };
}

function Message({ msg }) {
  const [copied,setCopied]=useState(false);
  const copy=async()=>{ await navigator.clipboard?.writeText(msg.content || ""); setCopied(true); setTimeout(()=>setCopied(false),1000); };
  return (
    <div className={`message-row ${msg.role}`}>
      <div className={`avatar ${msg.role}`}>{msg.role==="assistant" ? <Sparkles size={15}/> : "Вы"}</div>
      <div className="message-content">
        {msg.type==="chart" ? (
          <div className="artifact">
            <div className="artifact-title">Демо-график</div>
            <div className="chart"><ResponsiveContainer width="100%" height={240}>
              <BarChart data={demoChart}>
                <CartesianGrid vertical={false} stroke="#ededf0"/>
                <XAxis dataKey="name" tickLine={false} axisLine={false}/>
                <YAxis tickLine={false} axisLine={false}/>
                <Tooltip/>
                <Bar dataKey="value" radius={[6,6,0,0]} fill="#171719"/>
              </BarChart>
            </ResponsiveContainer></div>
          </div>
        ) : msg.type==="table" ? (
          <div className="artifact">
            <div className="artifact-title">{msg.content}</div>
            <table><tbody>{msg.rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td className={i===0?"head":""} key={j}>{c}</td>)}</tr>)}</tbody></table>
          </div>
        ) : (
          <div className="text-content">{msg.content}</div>
        )}
        {msg.attachments?.length>0 && <div className="attachments">{msg.attachments.map((a,i)=><span key={i}><ImageIcon size={14}/>{a.name}</span>)}</div>}
        {msg.role==="assistant" && <button className="copy" onClick={copy}>{copied?<Check size={14}/>:<Copy size={14}/>} {copied?"Скопировано":"Копировать"}</button>}
      </div>
    </div>
  );
}

function App(){
  const [state,setState]=useState(load);
  const [active,setActive]=useState("welcome");
  const [input,setInput]=useState("");
  const [files,setFiles]=useState([]);
  const [search,setSearch]=useState("");
  const [memoryOpen,setMemoryOpen]=useState(false);
  const [mobile,setMobile]=useState(false);
  const fileRef=useRef();

  useEffect(()=>localStorage.setItem(STORAGE,JSON.stringify(state)),[state]);
  const chat=state.chats.find(c=>c.id===active) || state.chats[0];
  const filtered=state.chats.filter(c=>c.title.toLowerCase().includes(search.toLowerCase()));

  const updateChat=(fn)=>setState(s=>({...s,chats:s.chats.map(c=>c.id===chat.id?fn(c):c)}));

  const newChat=()=>{
    const id=crypto.randomUUID();
    setState(s=>({...s,chats:[{id,title:"Новый чат",messages:[]},...s.chats]}));
    setActive(id); setMobile(false);
  };

  const send=()=>{
    if(!input.trim() && !files.length)return;
    const userText=input.trim() || "Изображение";
    const attachments=files.map(f=>({name:f.name,url:URL.createObjectURL(f)}));
    const user={role:"user",content:userText,attachments};
    const reply=mockReply(input,files);
    if(reply.type==="memory" && state.memoryEnabled){
      setState(s=>({...s,memory:[...s.memory,reply.content]}));
      reply.type="text"; reply.content=`Запомнил: «${reply.content}»`;
    }
    updateChat(c=>({
      ...c,
      title:c.messages.length===0 ? (userText.length>30?userText.slice(0,30)+"…":userText):c.title,
      messages:[...c.messages,user,reply]
    }));
    setInput("");setFiles([]);
  };

  const removeChat=()=>{
    if(state.chats.length===1)return;
    const rest=state.chats.filter(c=>c.id!==active);
    setState(s=>({...s,chats:rest}));
    setActive(rest[0].id);
  };

  const rename=()=>{
    const name=prompt("Название чата",chat.title);
    if(name?.trim())updateChat(c=>({...c,title:name.trim()}));
  };

  const attach=(e)=>setFiles([...files,...Array.from(e.target.files||[])]);
  const onKey=(e)=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}};

  return <div className="app">
    <aside className={`sidebar ${mobile?"mobile-open":""}`}>
      <div className="brand"><div className="brand-mark"><Sparkles size={17}/></div><span>Minimal AI</span></div>
      <button className="new-chat" onClick={newChat}><Plus size={18}/> Новый чат</button>
      <div className="search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск чатов"/></div>
      <div className="section-label">Чаты</div>
      <div className="chat-list">{filtered.map(c=>
        <button key={c.id} className={`chat-item ${c.id===active?"active":""}`} onClick={()=>{setActive(c.id);setMobile(false)}}><span>{c.title}</span><MoreHorizontal size={15}/></button>
      )}</div>
      <div className="sidebar-bottom">
        <button onClick={()=>setMemoryOpen(true)}><Brain size={17}/> Память</button>
        <div className="status"><span className="dot"></span> Demo mode</div>
      </div>
    </aside>

    {mobile && <div className="overlay" onClick={()=>setMobile(false)}/>}

    <main className="main">
      <header className="topbar">
        <button className="mobile-menu" onClick={()=>setMobile(true)}><Menu/></button>
        <div className="chat-heading"><span>{chat.title}</span><button onClick={rename}><Pencil size={14}/></button></div>
        <button className="icon-button" onClick={removeChat}><Trash2 size={17}/></button>
      </header>

      <section className="conversation">
        {chat.messages.length===0 ? <div className="empty">
          <div className="hero-icon"><Sparkles size={25}/></div>
          <h1>Чем займёмся?</h1>
          <p>Минималистичный AI‑интерфейс без лишнего.</p>
          <div className="suggestions">
            {["Реши 2x + 6 = 18","Построй график","Сделай таблицу","Запомни: я люблю минимализм"].map(x=><button key={x} onClick={()=>setInput(x)}>{x}</button>)}
          </div>
        </div> : chat.messages.map((m,i)=><Message msg={m} key={i}/>)}
      </section>

      <div className="composer-wrap">
        {files.length>0 && <div className="file-strip">{files.map((f,i)=><div key={i} className="file-chip"><ImageIcon size={14}/>{f.name}<button onClick={()=>setFiles(files.filter((_,j)=>j!==i))}><X size={13}/></button></div>)}</div>}
        <div className="composer">
          <input type="file" accept="image/*" multiple hidden ref={fileRef} onChange={attach}/>
          <button className="attach" onClick={()=>fileRef.current?.click()} title="Прикрепить фото"><Paperclip size={19}/></button>
          <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKey} placeholder="Напишите сообщение..." rows="1"/>
          <button className={`send ${input.trim()||files.length?"ready":""}`} onClick={send}><ArrowUp size={19}/></button>
        </div>
        <div className="composer-note">Enter — отправить · Shift + Enter — новая строка · AI пока в demo‑режиме</div>
      </div>
    </main>

    {memoryOpen && <div className="modal-backdrop" onClick={()=>setMemoryOpen(false)}>
      <div className="memory-modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-head"><div><h2>Память</h2><p>Локальные факты, которые можно передать будущему AI.</p></div><button onClick={()=>setMemoryOpen(false)}><X/></button></div>
        <label className="switch-row"><span>Использовать память</span><input type="checkbox" checked={state.memoryEnabled} onChange={e=>setState(s=>({...s,memoryEnabled:e.target.checked}))}/></label>
        <div className="memory-list">{state.memory.length?state.memory.map((m,i)=><div className="memory-item" key={i}><span>{m}</span><button onClick={()=>setState(s=>({...s,memory:s.memory.filter((_,j)=>j!==i)}))}><X size={14}/></button></div>):<div className="muted">Память пока пуста.</div>}</div>
      </div>
    </div>}
  </div>
}

createRoot(document.getElementById("root")).render(<App/>);
