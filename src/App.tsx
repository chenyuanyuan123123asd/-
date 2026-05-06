/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { 
  Settings, 
  Database, 
  Sparkles, 
  Search, 
  Trash2, 
  Plus, 
  ChevronDown, 
  AlertCircle,
  CheckCircle2,
  Send,
  Loader2,
  ArrowRight,
  ClipboardList,
  Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

interface ApiConfig {
  url: string;
  key: string;
  model: string;
}

interface Property {
  id: string;
  name: string;
  area: string;
  address?: string;
  totalPrice: string;
  totalPriceValue?: number; // Normalized price for sorting/matching
  downPayment: string;
  layout: string;
  status: string;
  sellingPoints: string;
  nearbyFacilities?: string;
  imageUrl?: string;
  videoUrl?: string;
  createdAt: number;
}

interface MatchMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ExtractionResult {
  项目名: string;
  区域: string;
  地址?: string;
  总价: string;
  总价数值?: number; 
  首付: string;
  面积与户型: string;
  交房状态: string;
  核心卖点: string;
  附近配套?: string;
}

type ThemeMode = 'pink' | 'purple' | 'blue' | 'yellow' | 'green' | 'orange' | 'teal' | 'indigo';

interface ThemeConfig {
  primary: string;
  secondary: string;
  bg: string;
  accent: string;
  gradient: string;
  label: string;
}

const THEMES: Record<ThemeMode, ThemeConfig> = {
  pink: { primary: 'text-rose-400', secondary: 'bg-rose-300', bg: 'bg-rose-50', accent: 'bg-rose-100/50', gradient: 'bg-theme-pink', label: '草莓圣代' },
  purple: { primary: 'text-purple-400', secondary: 'bg-purple-300', bg: 'bg-purple-50', accent: 'bg-purple-100/50', gradient: 'bg-theme-purple', label: '香芋奶冻' },
  blue: { primary: 'text-sky-400', secondary: 'bg-sky-300', bg: 'bg-sky-50', accent: 'bg-sky-100/50', gradient: 'bg-theme-blue', label: '晴空冰沙' },
  yellow: { primary: 'text-amber-400', secondary: 'bg-amber-300', bg: 'bg-amber-50', accent: 'bg-amber-100/50', gradient: 'bg-theme-yellow', label: '芝士布丁' },
  green: { primary: 'text-emerald-400', secondary: 'bg-emerald-300', bg: 'bg-emerald-50', accent: 'bg-emerald-100/50', gradient: 'bg-theme-green', label: '青提软糖' },
  orange: { primary: 'text-orange-400', secondary: 'bg-orange-300', bg: 'bg-orange-50', accent: 'bg-orange-100/50', gradient: 'bg-theme-orange', label: '西柚多多' },
  teal: { primary: 'text-teal-400', secondary: 'bg-teal-300', bg: 'bg-teal-50', accent: 'bg-teal-100/50', gradient: 'bg-theme-teal', label: '薄荷苏打' },
  indigo: { primary: 'text-indigo-400', secondary: 'bg-indigo-300', bg: 'bg-indigo-50', accent: 'bg-indigo-100/50', gradient: 'bg-theme-indigo', label: '盐系苏蓝' }
};

// --- Utils ---

const STORAGE_KEYS = {
  CONFIG: 'sh_apt_helper_config',
  PROPERTIES: 'sh_apt_helper_properties',
  THEME: 'sh_apt_helper_theme'
};

const DEFAULT_CONFIG: ApiConfig = {
  url: 'https://api.openai.com/v1/chat/completions',
  key: '',
  model: 'gemini-1.5-flash'
};

export default function App() {
  // --- State ---
  const [activeTab, setActiveTab] = useState<'config' | 'input' | 'database' | 'match' | 'broadcast'>('database');
  const [theme, setTheme] = useState<ThemeMode>('pink');
  const [config, setConfig] = useState<ApiConfig>(DEFAULT_CONFIG);
  const [properties, setProperties] = useState<Property[]>([]);
  const [models, setModels] = useState<string[]>(['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp', 'claude-3.5-sonnet', 'claude-3.5-haiku', 'gpt-4o', 'gpt-4o-mini']);
  const [isConfigSaved, setIsConfigSaved] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extractText, setExtractText] = useState('');
  const [extractImage, setExtractImage] = useState<string | null>(null);
  const [filterArea, setFilterArea] = useState<string>('全部');
  const [matchRequest, setMatchRequest] = useState('');
  const [matchMode, setMatchMode] = useState<'concise' | 'professional'>('concise');
  const [matchHistory, setMatchHistory] = useState<MatchMessage[]>([]);
  const [broadcastResult, setBroadcastResult] = useState('');
  const [broadcastMode, setBroadcastMode] = useState<'short' | 'detailed' | 'template'>('short');
  const [broadcastTemplate, setBroadcastTemplate] = useState('');
  const [selectedPropIds, setSelectedPropIds] = useState<string[]>([]);
  const [editingProp, setEditingProp] = useState<Property | null>(null);

  const t = THEMES[theme];

  // --- Effects ---
  useEffect(() => {
    const savedConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (savedConfig) setConfig(JSON.parse(savedConfig));

    const savedProps = localStorage.getItem(STORAGE_KEYS.PROPERTIES);
    if (savedProps) setProperties(JSON.parse(savedProps));

    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) as ThemeMode;
    if (savedTheme && THEMES[savedTheme]) setTheme(savedTheme);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(properties));
  }, [properties]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }, [theme]);

  // --- Actions ---

  const handleSaveConfig = () => {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    setIsConfigSaved(true);
    setTimeout(() => setIsConfigSaved(false), 2000);
    setError(null);
  };

  const fetchModels = async () => {
    setError(null);
    try {
      const modelsUrl = config.url.replace('/chat/completions', '/models');
      const response = await fetch(modelsUrl, {
        headers: {
          'Authorization': `Bearer ${config.key}`
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: 获取模型失败`);
      const data = await response.json();
      const modelList = data.data.map((m: any) => m.id);
      setModels(modelList);
      if (modelList.length > 0 && !modelList.includes(config.model)) {
        setConfig(prev => ({ ...prev, model: modelList[0] }));
      }
    } catch (err: any) {
      setError(`拉取模型失败: ${err.message}. 请手动输入。`);
    }
  };

  const cleanJson = (text: string) => {
    return text
      .replace(/```json/gi, '')
      .replace(/```/gi, '')
      .trim();
  };

  const ensureString = (val: any): string => {
    if (typeof val === 'string') return val;
    if (val === null || val === undefined) return '';
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'object') {
      return Object.entries(val)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join('; ');
    }
    return String(val);
  };

  const aiExtract = async () => {
    if (!extractText.trim() && !extractImage) return;
    setIsExtracting(true);
    setError(null);

    try {
      const userContent: any[] = [];
      if (extractText.trim()) {
        userContent.push({ type: 'text', text: extractText });
      }
      if (extractImage) {
        // Extract base64 and mime type
        const matches = extractImage.match(/^data:(image\/[a-z]+);base64,(.+)$/);
        if (matches) {
           userContent.push({
             type: 'image_url',
             image_url: { url: extractImage }
           });
        }
      }

      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.key}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { 
              role: 'system', 
              content: '你是一个数据提取专家。请从用户输入的房地产销售笔记或图片中提取关键信息。必须输出纯 JSON 格式，不要包裹 Markdown 代码块。字段包含：项目名、区域、地址、总价（如“300万”）、总价数值（纯数字，取区间均值）、首付、面积与户型、交房状态、核心卖点、附近配套（如交通、商场，如果没有则留空）。请尽量将价格标准化为单一数值以便匹配。' 
            },
            { role: 'user', content: userContent }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      const jsonStr = cleanJson(content);
      const extracted: ExtractionResult = JSON.parse(jsonStr);

      const newProperty: Property = {
        id: Date.now().toString(),
        name: ensureString(extracted.项目名),
        area: ensureString(extracted.区域),
        address: ensureString(extracted.地址),
        totalPrice: ensureString(extracted.总价),
        totalPriceValue: extracted.总价数值,
        downPayment: ensureString(extracted.首付),
        layout: ensureString(extracted.面积与户型),
        status: ensureString(extracted.交房状态),
        sellingPoints: ensureString(extracted.核心卖点),
        nearbyFacilities: ensureString(extracted.附近配套),
        createdAt: Date.now()
      };

      setProperties(prev => [newProperty, ...prev]);
      setExtractText('');
      setExtractImage(null);
      setActiveTab('database');
    } catch (err: any) {
      setError(`AI 解析失败: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const aiMatch = async (isContinue = false) => {
    if (!matchRequest.trim() || properties.length === 0) return;
    setIsMatching(true);
    setError(null);

    try {
      const modePrompt = matchMode === 'concise' 
        ? '请输出精简的项目对比方案（1.项目A：卖点；2.项目B：卖点...），字数控制在200字以内，禁止使用Markdown符号。'
        : '请生成一份专业的电销推荐话术，包含开场白、核心优势分析及邀约建议，禁止使用Markdown符号。';

      const systemPrompt = `你是一个专业的房地产金牌顾问。请根据房源库提供匹配方案。
      要求：
      1. 一次筛选 2-3 个最符合的项目。
      2. 严禁使用 **、###、-、* 等 Markdown 符号。
      3. 结构清爽，使用纯换行组织。
      4. 当前回复模式：${modePrompt}
      
      房源库：${JSON.stringify(properties)}`;

      const currentMessages: MatchMessage[] = isContinue 
        ? [...matchHistory, { role: 'user', content: matchRequest }]
        : [{ role: 'user', content: matchRequest }];

      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.key}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...currentMessages
          ]
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const content = data.choices[0].message.content.replace(/[#*`]/g, '').trim();
      
      const newHistory: MatchMessage[] = isContinue 
        ? [...currentMessages, { role: 'assistant', content }]
        : [{ role: 'user', content: matchRequest }, { role: 'assistant', content }];

      setMatchHistory(newHistory);
      setMatchRequest('');
    } catch (err: any) {
      setError(`方案生成失败: ${err.message}`);
    } finally {
      setIsMatching(false);
    }
  };

  const handleExtractImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      setError('图片超过 2MB，请压缩后再试');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setExtractImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>, field: 'imageUrl' | 'videoUrl') => {
    const file = e.target.files?.[0];
    if (!file || !editingProp) return;
    
    if (file.size > 2 * 1024 * 1024) {
      setError('文件超过 2MB，请压缩后再试');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setEditingProp({ ...editingProp, [field]: event.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const aiBroadcast = async () => {
    if (selectedPropIds.length === 0) return;
    setIsBroadcasting(true);
    setError(null);

    try {
      if (broadcastMode === 'template' && !broadcastTemplate.trim()) {
        setError('请先输入模版格式再生成');
        setIsBroadcasting(false);
        return;
      }
      const selectedProps = properties.filter(p => selectedPropIds.includes(p.id));
      
      let systemPrompt = '';
      if (broadcastMode === 'short') {
        systemPrompt = `你是一个房地产自媒体运营专家。请为选中的房源生成一段极具诱惑力的【短消息】群发文案。
        规则：
        1. 字数精简，每条房源 2-3 行。
        2. 使用爆款 Emoji（🔥, 🏠, 💰）。
        3. 严禁使用 Markdown 符号（如 ** 等）。
        4. 包含“随时看房，专车接送”。`;
      } else if (broadcastMode === 'detailed') {
        systemPrompt = `你是一个房地产自媒体运营专家。请为选中的房源生成一段极具诱惑力的【长文案】群发文案。
        规则：
        1. 详细描述核心卖点、价格特惠。
        2. 使用丰富的 Emoji，分段清晰。
        3. 包含仪式感标题（如“今日爆款项目推荐”）。
        4. 严禁使用 Markdown 符号（如 ** 等）。`;
      } else if (broadcastMode === 'template') {
        systemPrompt = `你是一个房地产自媒体运营专家。请根据用户提供的【模版】，将其中占位符（如 {项目名}, {总价}, {区域} 等）替换为选中房源的实际信息。
        用户模版：${broadcastTemplate}
        规则：
        1. 严格遵守模版格式。
        2. 如果有多个房源，请按模版格式重复生成。
        3. 严禁使用 Markdown 符号。`;
      }

      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.key}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { 
              role: 'system', 
              content: systemPrompt
            },
            {
              role: 'user',
              content: `选中的房源数据：${JSON.stringify(selectedProps)}`
            }
          ]
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setBroadcastResult(data.choices[0].message.content.replace(/[#*`]/g, '').trim());
    } catch (err: any) {
      setError(`群发生成失败: ${err.message}`);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const togglePropSelection = (id: string) => {
    setSelectedPropIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const deleteProperty = (id: string) => {
    setProperties(prev => prev.filter(p => p.id !== id));
  };

  const updateProperty = (updated: Property) => {
    setProperties(prev => prev.map(p => p.id === updated.id ? updated : p));
    setEditingProp(null);
  };

  const suggestAmenities = async (prop: Property) => {
    if (!prop.address && !prop.name) return;
    setIsSuggesting(prop.id);
    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.key}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { 
              role: 'system', 
              content: '你是一个上海房地产专家。根据给出的项目名和地址，列举其周边的配套设施（交通、教育、医疗、商业）。回复请简洁，总共不超过100字。' 
            },
            { role: 'user', content: `项目名：${prop.name}, 地址：${prop.address || '上海'}` }
          ]
        })
      });
      const data = await response.json();
      const amenities = data.choices[0].message.content;
      updateProperty({ ...prop, nearbyFacilities: amenities });
    } catch (err: any) {
      setError(`建议配套失败: ${err.message}`);
    } finally {
      setIsSuggesting(null);
    }
  };

  // --- Render Helpers ---

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('热') || s.includes('好') || s.includes('在售')) return 'bg-emerald-500';
    if (s.includes('紧') || s.includes('不多')) return 'bg-amber-500';
    if (s.includes('清') || s.includes('售罄')) return 'bg-rose-500';
    return 'bg-slate-400';
  };

  return (
    <div className={`min-h-screen ${t.gradient} text-slate-800 font-sans selection:bg-black/5 selection:text-slate-900 transition-colors duration-700`}>
      {/* Header */}
      <header className="bg-white/60 backdrop-blur-3xl sticky top-0 z-50 border-b border-white/40 px-6 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 ${t.secondary} rounded-[1.5rem] flex items-center justify-center shadow-xl shadow-${theme}-200/40 transform hover:rotate-12 transition-all duration-500 cursor-pointer group`}>
              <Sparkles className="text-white w-6 h-6 group-hover:scale-125 transition-transform" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 font-serif leading-none italic uppercase">沪公寓助手</h1>
              <p className={`text-[10px] ${t.primary} font-black tracking-[0.2em] mt-1`}>APARTMENT ASSISTANT</p>
            </div>
          </div>
          
          <nav className="hidden md:flex bg-white/50 backdrop-blur-md p-1.5 rounded-full border border-white/60 shadow-lg">
            {[
              { id: 'database', label: '房源管理', icon: Database },
              { id: 'input', label: 'AI 录入', icon: Plus },
              { id: 'match', label: '客户匹配', icon: Search },
              { id: 'broadcast', label: '群发助手', icon: Send },
              { id: 'config', label: '系统设置', icon: Settings }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`
                  flex items-center gap-2 px-6 py-2.5 rounded-2xl transition-all text-xs font-black uppercase tracking-widest
                  ${activeTab === tab.id 
                    ? `bg-white ${t.primary} shadow-xl scale-110 ring-4 ring-white/50` 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/20'}
                `}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-10 relative overflow-hidden">
        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -40, scale: 0.9 }}
              className="mb-8 p-6 bg-white/80 backdrop-blur-xl border-4 border-rose-100 rounded-[2.5rem] flex items-start gap-4 text-rose-500 shadow-2xl z-40 relative"
            >
              <AlertCircle className="w-6 h-6 mt-0.5 flex-shrink-0" />
              <div className="flex-grow">
                <h4 className="font-bold mb-1">操作遇到了点问题</h4>
                <p className="text-sm opacity-80 leading-relaxed">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="p-2 hover:bg-rose-100 rounded-xl transition-all">
                <Trash2 className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- Content Modules --- */}
        <div className="space-y-12">
          
          {/* Module 1: Config Panel */}
          {activeTab === 'config' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/80 backdrop-blur-sm rounded-[3rem] p-10 border border-white/50 shadow-2xl shadow-slate-200/50 overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                 <Settings className="w-64 h-64 rotate-12" />
              </div>
              
              <div className="flex items-center gap-2 mb-10 relative">
                <Settings className={`${t.primary} w-7 h-7`} />
                <h2 className="text-3xl font-bold text-slate-900 font-serif">界面与设置</h2>
              </div>
              
              <div className="grid gap-10 relative">
                {/* Theme Selector */}
                <div className="space-y-5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] ml-1">界面整体色相</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    {(Object.keys(THEMES) as ThemeMode[]).map(key => (
                      <button
                        key={key}
                        onClick={() => setTheme(key)}
                        className={`
                          p-5 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 relative group
                          ${theme === key ? `border-slate-800 bg-white shadow-xl scale-105` : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'}
                        `}
                      >
                        <div className={`w-12 h-12 rounded-2xl ${THEMES[key].secondary} shadow-lg shadow-${key}-200/50 transform group-hover:rotate-6 transition-transform`} />
                        <span className={`text-xs font-bold ${theme === key ? 'text-slate-900' : 'text-slate-400'}`}>{THEMES[key].label}</span>
                        {theme === key && <div className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-1"><CheckCircle2 className="w-3 h-3" /></div>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-slate-100/60" />

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">API 终端</label>
                    <input 
                      type="text" 
                      value={config.url}
                      onChange={e => setConfig(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="OpenAI 兼容接口地址"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-theme-primary/10 transition-all font-mono text-sm leading-relaxed"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Access Key</label>
                    <input 
                      type="password" 
                      value={config.key}
                      onChange={e => setConfig(prev => ({ ...prev, key: e.target.value }))}
                      placeholder="sk-xxxxxxxxxxxxxxxx"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-theme-primary/10 transition-all font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">大语言模型</label>
                    <div className="flex gap-3">
                      <div className="relative flex-grow">
                        <input 
                          type="text" 
                          list="models-list"
                          value={config.model}
                          onChange={e => setConfig(prev => ({ ...prev, model: e.target.value }))}
                          placeholder="选择或手动指定模型"
                          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-theme-primary/10 transition-all font-mono text-sm shadow-inner"
                        />
                        <datalist id="models-list">
                          {models.map(m => <option key={m} value={m} />)}
                        </datalist>
                      </div>
                      <button 
                        onClick={fetchModels}
                        className={`px-6 bg-white border border-slate-200 ${t.primary} rounded-2xl hover:bg-slate-50 active:scale-95 transition-all text-xs font-black flex items-center gap-2 whitespace-nowrap shadow-sm`}
                      >
                        <ChevronDown className="w-4 h-4" />
                        同步源
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-6 flex items-center justify-between border-t border-slate-50">
                  <p className="text-xs text-slate-400 font-medium italic">所有的 API 数据仅保存在您的当前浏览器 localStorage 中。</p>
                  <button 
                    onClick={handleSaveConfig}
                    className={`
                      px-12 py-5 rounded-3xl font-black text-lg flex items-center gap-3 transition-all shadow-2xl
                      ${isConfigSaved 
                        ? 'bg-emerald-500 text-white shadow-emerald-200' 
                        : `${t.secondary} text-white shadow-slate-200 hover:-translate-y-1 active:translate-y-0`}
                    `}
                  >
                    {isConfigSaved ? (
                      <><CheckCircle2 className="w-6 h-6" /> 设置已更新</>
                    ) : (
                      '保存偏好设置'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Module 2: AI Input */}
          {activeTab === 'input' && (
            <motion.div 
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-white/90 backdrop-blur-sm rounded-[3.5rem] p-12 border border-white shadow-2xl shadow-slate-200/50 relative overflow-hidden"
            >
              <div className="absolute -bottom-20 -left-20 p-12 opacity-5 pointer-events-none">
                 <Sparkles className="w-96 h-96" />
              </div>

                <div className="flex flex-col items-center text-center gap-3 mb-10 relative">
                <div className={`w-16 h-16 ${t.secondary} rounded-full flex items-center justify-center text-white shadow-xl mb-2 ring-8 ring-white/50`}>
                   <Sparkles className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-black text-slate-800 font-serif tracking-tight">智能数据录入</h2>
                <p className="text-slate-400 text-sm max-w-md font-medium leading-relaxed">
                   粘贴销售笔记或群消息，AI 将自动分析并录入房源库。
                </p>
              </div>

              <div className="space-y-8 relative">
                <div className="group relative">
                  <textarea 
                    value={extractText}
                    onChange={e => setExtractText(e.target.value)}
                    placeholder="例如：\n【项目名】xx公馆，外环外，500w起，精装交付\n配套有地铁11号线，自带2w方商业...\n本月还有特价房..."
                    className="w-full h-80 px-8 py-8 bg-slate-50/70 border-2 border-slate-100 rounded-[2.5rem] focus:outline-none focus:border-slate-800 transition-all text-slate-800 resize-none font-medium text-xl leading-relaxed shadow-inner placeholder:text-slate-300"
                  />
                  {!extractText && !extractImage && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-20 hidden md:block group-hover:scale-110 transition-transform">
                      <ClipboardList className={`w-32 h-32 ${t.primary}`} />
                    </div>
                  )}
                  {extractImage && (
                    <div className="absolute top-8 right-10 z-10 w-48 h-48 rounded-3xl overflow-hidden shadow-2xl border-4 border-white rotate-3">
                      <img src={extractImage} className="w-full h-full object-cover" />
                      <button 
                         onClick={() => setExtractImage(null)}
                         className="absolute top-2 right-2 bg-rose-500 text-white p-1.5 rounded-full shadow-lg"
                      >
                         <Plus className="w-4 h-4 rotate-45" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-6">
                  <label className={`cursor-pointer flex items-center gap-3 px-8 py-6 bg-white border-2 border-slate-100 rounded-[2rem] text-slate-800 font-black shadow-xl hover:-translate-y-1 transition-all active:scale-95`}>
                     <Camera className="w-6 h-6" />
                     {extractImage ? '重新拍摄/上传' : '图片/截图识房'}
                     <input type="file" accept="image/*" className="hidden" onChange={handleExtractImage} />
                  </label>

                  <button 
                    onClick={aiExtract}
                    disabled={isExtracting || (!extractText.trim() && !extractImage)}
                    className={`group px-16 py-6 ${t.secondary} disabled:bg-slate-200 text-white rounded-[2rem] font-black text-xl flex items-center gap-4 transition-all shadow-2xl shadow-slate-300 hover:-translate-y-1 active:translate-y-0`}
                  >
                    {isExtracting ? (
                      <Loader2 className="w-7 h-7 animate-spin" />
                    ) : (
                      <Send className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                    )}
                    {isExtracting ? '分析中...' : '提交录入'}
                  </button>
                  <div className="flex items-center gap-3 text-slate-400">
                     <CheckCircle2 className="w-4 h-4" />
                     <span className="text-xs font-bold uppercase tracking-widest text-[#FFB7C5]">支持自动提取配套与卖点</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Module 3: Database */}
          {activeTab === 'database' && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="space-y-8"
            >
              <div className="flex items-center justify-between px-6 bg-white py-6 rounded-[2rem] border border-slate-100 z-10 shadow-sm mb-10">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 ${t.secondary} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 font-serif leading-none">房源库房源</h2>
                    <p className="text-[10px] font-black text-slate-400 tracking-widest mt-2 opacity-70 uppercase">PROJECT REPOSITORY</p>
                  </div>
                  <span className="bg-slate-900 text-white text-[12px] px-4 py-1 rounded-full font-black ml-4 shadow-xl">
                    {properties.length}
                  </span>
                </div>
                <button 
                  onClick={() => setActiveTab('input')}
                  className={`flex items-center gap-2 text-sm font-black ${t.primary} bg-white px-5 py-2.5 rounded-2xl shadow-sm hover:shadow-md transition-all border border-slate-50`}
                >
                  <Plus className="w-4 h-4" /> 录入房源
                </button>
              </div>

              {/* District Filter Slider */}
              <div className="flex items-center gap-3 overflow-x-auto pb-4 px-2 scrollbar-hide">
                {['全部', ...Array.from(new Set(properties.map(p => p.area.split(/[,，/ \s]/)[0] || '未知')))].map(area => (
                  <button
                    key={area}
                    onClick={() => setFilterArea(area)}
                    className={`
                      px-8 py-3 rounded-2xl text-xs font-black transition-all whitespace-nowrap border-2
                      ${filterArea === area 
                        ? `${t.secondary} border-transparent text-white shadow-xl scale-105` 
                        : 'bg-white border-slate-50 text-slate-400 hover:border-slate-200'}
                    `}
                  >
                    {area}
                  </button>
                ))}
              </div>

              {properties.filter(p => filterArea === '全部' || p.area.includes(filterArea)).length === 0 ? (
                <div className="bg-white/40 backdrop-blur-sm rounded-[4rem] p-32 border-4 border-white border-dashed flex flex-col items-center justify-center text-center space-y-8">
                  <div className="w-32 h-32 bg-white rounded-[3rem] shadow-2xl flex items-center justify-center rotate-6">
                    <Database className="w-12 h-12 text-slate-100" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="font-black text-3xl text-slate-300 font-serif italic">暂无房源记录</h3>
                    <p className="text-slate-300 font-bold max-w-sm mx-auto leading-relaxed uppercase tracking-tighter text-sm">请通过 AI 扫描录入您的房源信息。</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                  {properties.filter(p => filterArea === '全部' || p.area.includes(filterArea)).map(prop => (
                    <motion.div 
                      layout
                      key={prop.id}
                      onClick={(e) => {
                         if (e.shiftKey) togglePropSelection(prop.id);
                      }}
                      className={`group bg-white rounded-[3rem] border-2 transition-all p-8 relative overflow-hidden flex flex-col cursor-pointer ${selectedPropIds.includes(prop.id) ? `border-slate-800 ring-4 ring-slate-100` : 'border-white shadow-2xl shadow-slate-200/60 hover:shadow-slate-300'}`}
                    >
                      {/* Selection Badge */}
                      {selectedPropIds.includes(prop.id) && (
                        <div className="absolute top-8 left-8 z-20">
                          <div className="bg-slate-900 text-white p-2 rounded-full shadow-xl">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                        </div>
                      )}

                      {/* Status indicator pill */}
                      <div className="absolute top-8 right-8 z-10">
                         <div className={`px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest text-white shadow-xl flex items-center gap-2 uppercase ${getStatusColor(prop.status)}`}>
                           <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                           {prop.status}
                         </div>
                      </div>

                      {prop.imageUrl ? (
                         <div className="h-56 -mx-8 -mt-8 mb-8 overflow-hidden relative">
                            <img src={prop.imageUrl} alt={prop.name} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-1000" />
                            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent opacity-60" />
                            {prop.videoUrl && (
                               <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur-md p-2 rounded-full shadow-lg">
                                 <Plus className="w-4 h-4 text-theme-primary animate-pulse" />
                               </div>
                            )}
                         </div>
                      ) : (
                        <div className={`h-2 -mx-8 -mt-8 mb-8 ${getStatusColor(prop.status)}/30`} />
                      )}
                      
                      <div className="space-y-1.5 mb-8">
                         <div className="flex items-center justify-between gap-2">
                           <h3 
                              className="font-black text-2xl text-slate-900 group-hover:text-theme-primary transition-colors cursor-pointer font-serif line-clamp-1" 
                              onClick={() => setEditingProp(prop)}
                           >
                              {prop.name}
                           </h3>
                           {prop.videoUrl && <Plus className="w-4 h-4 text-rose-300" />}
                         </div>
                         <div className="flex items-center gap-2">
                            <Plus className={`w-3 h-3 ${t.primary}`} />
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">{prop.area}</p>
                         </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl flex flex-col justify-center shadow-inner group-hover:bg-white transition-colors">
                          <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.1em] mb-1.5">均价/总价</p>
                          <p className="font-black text-slate-900 text-xl leading-none font-mono tracking-tighter">
                             {prop.totalPrice}
                          </p>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 p-5 rounded-3xl flex flex-col justify-center shadow-inner group-hover:bg-white transition-colors">
                          <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.1em] mb-1.5">预计首付</p>
                          <p className="font-black text-slate-900 text-xl leading-none font-mono tracking-tighter">
                             {prop.downPayment}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-6 flex-grow">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-2xl ${t.secondary} text-white flex items-center justify-center shadow-xl group-hover:rotate-6 transition-transform`}>
                            <Database className="w-5 h-5" />
                          </div>
                          <div className="flex flex-col">
                             <span className="text-[9px] font-black text-slate-300 uppercase leading-none mb-1 tracking-widest">户型规格</span>
                             <span className="font-black text-slate-800 text-md leading-none">{prop.layout}</span>
                          </div>
                        </div>

                        <div className="bg-slate-50/80 border border-white p-6 rounded-[2rem] shadow-sm group-hover:bg-white/80 transition-all">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <p className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-2 tracking-widest opacity-60">
                                <Sparkles className="w-4 h-4 text-emerald-400" /> 特权卖点
                              </p>
                              <p className="text-sm text-slate-600 leading-relaxed italic font-medium">
                                "{ensureString(prop.sellingPoints)}"
                              </p>
                            </div>

                            {(prop.nearbyFacilities || prop.address) && (
                              <div className="space-y-2 pt-4 border-t border-slate-200/50">
                                <p className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-2 tracking-widest opacity-60">
                                  <Search className="w-4 h-4 text-sky-400" /> 配套引擎
                                </p>
                                {prop.nearbyFacilities ? (
                                  <p className="text-[11px] text-slate-500 font-bold leading-relaxed line-clamp-3">
                                    {ensureString(prop.nearbyFacilities)}
                                  </p>
                                ) : (
                                   <button 
                                     onClick={(e) => { e.stopPropagation(); suggestAmenities(prop); }}
                                     disabled={isSuggesting === prop.id}
                                     className="w-full py-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                                   >
                                     {isSuggesting === prop.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                     匹配周边配套
                                   </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-10 flex items-center justify-between border-t border-slate-50 pt-5">
                          <button 
                              onClick={() => setEditingProp(prop)}
                              className="text-[11px] font-black text-slate-400 hover:text-slate-800 flex items-center gap-2 transition-colors uppercase tracking-widest"
                          >
                              <Plus className="w-3.5 h-3.5" /> 复核数据
                          </button>
                          <button 
                              onClick={() => deleteProperty(prop.id)}
                              className="opacity-0 group-hover:opacity-100 text-[11px] font-black text-rose-300 hover:text-rose-500 flex items-center gap-2 transition-all uppercase tracking-widest"
                          >
                              <Trash2 className="w-3.5 h-3.5" /> 移除该项
                          </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Module 4: Matching */}
          {activeTab === 'match' && (
            <motion.div 
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-white/95 backdrop-blur-md rounded-[3.5rem] p-10 md:p-14 border border-white shadow-2xl relative overflow-hidden flex flex-col min-h-[700px]"
            >
              <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                 <Search className="w-64 h-64 rotate-12" />
              </div>

              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 relative border-b border-slate-50 pb-8">
                <div>
                  <h2 className="text-4xl font-black text-slate-900 font-serif tracking-tight">智能客户方案</h2>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] mt-2">AI PRECISION MATCHMAKING</p>
                </div>
                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                  <button 
                    onClick={() => setMatchMode('concise')}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${matchMode === 'concise' ? 'bg-white shadow-lg text-slate-900 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    精简筛选
                  </button>
                  <button 
                    onClick={() => setMatchMode('professional')}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${matchMode === 'professional' ? 'bg-white shadow-lg text-slate-900 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    电销话术
                  </button>
                </div>
              </div>

              <div className="flex-grow flex flex-col space-y-8 overflow-y-auto pr-4 scrollbar-hide max-h-[500px]">
                {matchHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center space-y-6 py-20 opacity-30">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center">
                      <Search className="w-10 h-10" />
                    </div>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-relaxed max-w-xs">
                      请输入客户需求，AI 将为您从 {properties.length} 个项目中智能筛选最佳方案。
                    </p>
                  </div>
                ) : (
                  matchHistory.map((msg, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`
                        max-w-[85%] px-8 py-6 rounded-[2.5rem] text-lg font-bold leading-relaxed shadow-sm
                        ${msg.role === 'user' 
                          ? `${t.secondary} text-white rounded-tr-none shadow-xl shadow-${theme}-200/40` 
                          : 'bg-slate-50 border border-slate-100 text-slate-800 rounded-tl-none'}
                      `}>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </motion.div>
                  ))
                )}
                {isMatching && (
                  <div className="flex justify-start">
                    <div className="bg-slate-50 px-8 py-6 rounded-[2.5rem] rounded-tl-none border border-slate-100 flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                      <span className="text-sm font-black text-slate-400 uppercase tracking-widest animate-pulse">专家演算中...</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-10 relative">
                <textarea 
                  value={matchRequest}
                  onChange={e => setMatchRequest(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      aiMatch(matchHistory.length > 0);
                    }
                  }}
                  placeholder={matchHistory.length > 0 ? "对此方案不满意？输入您的要求进行追问..." : "例如：预算 300-500 万，想要通燃气的，最好是在静安或者是虹口..."}
                  className="w-full px-10 py-8 bg-slate-50 border-2 border-slate-200 rounded-[2.5rem] focus:outline-none focus:border-slate-800 transition-all text-slate-800 resize-none font-medium text-xl leading-relaxed shadow-inner pr-32"
                />
                <button 
                  onClick={() => aiMatch(matchHistory.length > 0)}
                  disabled={isMatching || !matchRequest.trim()}
                  className={`absolute right-6 top-1/2 -translate-y-1/2 p-6 ${t.secondary} text-white rounded-3xl shadow-xl shadow-${theme}-200/50 hover:scale-105 active:scale-95 disabled:bg-slate-200 transition-all`}
                >
                  <Send className="w-6 h-6" />
                </button>
              </div>
              
              {matchHistory.length > 0 && (
                <button 
                  onClick={() => { setMatchHistory([]); setMatchRequest(''); }}
                  className="mt-6 text-[10px] font-black text-slate-300 hover:text-rose-400 uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 重置对话历史
                </button>
              )}
            </motion.div>
          )}

          {activeTab === 'broadcast' && (
            <motion.div 
               initial={{ opacity: 0, scale: 0.98 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-white/90 backdrop-blur-sm rounded-[3.5rem] p-12 border border-white shadow-2xl relative overflow-hidden"
            >
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12 relative border-b border-slate-50 pb-8">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 ${t.secondary} rounded-2xl flex items-center justify-center text-white shadow-xl`}>
                    <Send className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 font-serif">群发助手</h2>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">Broadcast Assistant</p>
                  </div>
                </div>

                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                  {[
                    { id: 'short', label: '短消息' },
                    { id: 'detailed', label: '长文案' },
                    { id: 'template', label: '套用模板' }
                  ].map(mode => (
                    <button 
                      key={mode.id}
                      onClick={() => setBroadcastMode(mode.id as any)}
                      className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${broadcastMode === mode.id ? 'bg-white shadow-lg text-slate-900 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-12 items-start">
                <div className="space-y-8">
                  {broadcastMode === 'template' ? (
                    <div className="space-y-4">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">粘贴你的模版格式</label>
                      <textarea 
                        value={broadcastTemplate}
                        onChange={e => setBroadcastTemplate(e.target.value)}
                        placeholder="🔥清盘特价❗仅此一套❗\n🏠项目：{项目名}\n💰总价：{总价}\n...\nAI 将根据你的格式替换房源信息"
                        className="w-full h-64 px-8 py-6 bg-slate-50 border-2 border-slate-200 rounded-[2rem] focus:outline-none focus:border-slate-800 transition-all text-slate-800 resize-none font-medium leading-relaxed"
                      />
                    </div>
                  ) : (
                    <div className="bg-slate-50/50 p-8 rounded-[2.5rem] border border-slate-100">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 px-2 flex items-center justify-between">
                        待发出的房源
                        <span className="bg-slate-900 text-white px-2 py-0.5 rounded-md text-[10px]">{selectedPropIds.length}</span>
                      </h4>
                      <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-hide">
                        {selectedPropIds.length === 0 ? (
                          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                             <Database className="w-10 h-10" />
                             <p className="text-xs font-bold uppercase">在房源管理中 Shift+点击 勾选房源</p>
                          </div>
                        ) : (
                          properties.filter(p => selectedPropIds.includes(p.id)).map(p => (
                            <div key={p.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between group">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                                  {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover" /> : <Plus className="w-4 h-4 m-auto text-slate-300" />}
                                </div>
                                <span className="font-bold text-slate-800 text-sm">{p.name}</span>
                              </div>
                              <button 
                                onClick={() => togglePropSelection(p.id)}
                                className="p-2 text-rose-300 hover:bg-rose-50 rounded-lg"
                              >
                                <Plus className="w-4 h-4 rotate-45" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={aiBroadcast}
                    disabled={isBroadcasting || selectedPropIds.length === 0}
                    className={`w-full py-6 ${t.secondary} text-white rounded-3xl font-black text-xl shadow-2xl flex items-center justify-center gap-4 transition-all disabled:bg-slate-200 active:scale-95`}
                  >
                    {isBroadcasting ? <Loader2 className="w-7 h-7 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                    {isBroadcasting ? '正在生成...' : '立即生成群发内容'}
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="bg-white rounded-[3rem] p-10 border border-slate-100 shadow-xl min-h-[500px] relative overflow-hidden group">
                     {!broadcastResult && (
                       <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 opacity-10 pointer-events-none group-hover:scale-110 transition-transform">
                          <ClipboardList className="w-32 h-32 mb-6" />
                          <p className="text-sm font-bold uppercase tracking-[0.2em]">文案生成预览区</p>
                       </div>
                     )}
                     <div className="relative z-10 whitespace-pre-wrap text-slate-800 leading-relaxed font-bold text-lg">
                       {broadcastResult}
                     </div>
                     {broadcastResult && (
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(broadcastResult);
                            alert('已复制到剪贴板！');
                          }}
                          className="absolute bottom-10 right-10 p-5 bg-slate-900 text-white rounded-2xl shadow-2xl hover:scale-110 active:scale-95 transition-all flex items-center gap-3"
                        >
                          <Send className="w-5 h-5" />
                          <span className="text-xs font-black uppercase tracking-widest">复制全文</span>
                        </button>
                     )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </div>
      </main>

      {/* Mobile Navigation */}
      <footer className="md:hidden fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] z-50">
        <nav className="bg-slate-900/90 backdrop-blur-3xl p-3 rounded-[2.5rem] border border-white/20 shadow-2xl flex items-center justify-around">
          {[
            { id: 'database', icon: Database },
            { id: 'input', icon: Plus },
            { id: 'match', icon: Search },
            { id: 'config', icon: Settings }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`p-5 rounded-3xl transition-all relative ${activeTab === tab.id ? `${t.secondary} text-white shadow-2xl scale-110` : 'text-slate-500 hover:text-slate-300'}`}
            >
              <tab.icon className="w-7 h-7" />
              {activeTab === tab.id && (
                 <motion.div layoutId="mob-nav" className="absolute inset-0 bg-white/10 rounded-3xl -z-10" />
              )}
            </button>
          ))}
        </nav>
      </footer>

      {/* Edit Modal (Universal High-End Modal) */}
      <AnimatePresence>
        {editingProp && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditingProp(null)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              />
              <motion.div 
                 initial={{ opacity: 0, scale: 0.9, y: 50 }}
                 animate={{ opacity: 1, scale: 1, y: 0 }}
                 exit={{ opacity: 0, scale: 0.9, y: 50 }}
                 className="relative bg-white rounded-[4rem] w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl border border-white flex flex-col"
              >
                 <div className="flex items-center justify-between p-10 border-b border-slate-50 sticky top-0 bg-white/90 backdrop-blur-md z-20">
                    <div>
                        <h3 className="text-3xl font-black text-slate-900 font-serif">编辑房源明细</h3>
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">Refine Project Specifications</p>
                    </div>
                    <button onClick={() => setEditingProp(null)} className="p-3 hover:bg-slate-50 rounded-full transition-colors group">
                      <Plus className="w-8 h-8 rotate-45 text-slate-300 group-hover:text-slate-900 transition-colors" />
                    </button>
                 </div>

                 <div className="p-10 space-y-10 overflow-y-auto flex-grow scrollbar-hide">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">项目全名</label>
                         <input 
                           value={editingProp.name}
                           onChange={e => setEditingProp({ ...editingProp, name: e.target.value })}
                           className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all font-bold text-slate-800"
                         />
                       </div>
                       <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">所属板块</label>
                         <input 
                           value={editingProp.area}
                           onChange={e => setEditingProp({ ...editingProp, area: e.target.value })}
                           className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all font-bold text-slate-800"
                         />
                       </div>
                       <div className="col-span-full space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">详细地理位置</label>
                         <input 
                           value={editingProp.address || ''}
                           onChange={e => setEditingProp({ ...editingProp, address: e.target.value })}
                           placeholder="输入完整地址以便 AI 智能匹配配套"
                           className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all font-bold text-slate-800"
                         />
                       </div>
                       <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">价格/区间描述</label>
                         <input 
                           value={editingProp.totalPrice}
                           onChange={e => setEditingProp({ ...editingProp, totalPrice: e.target.value })}
                           className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all font-bold text-slate-800 font-mono"
                         />
                       </div>
                       <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">预计首付</label>
                         <input 
                           value={editingProp.downPayment}
                           onChange={e => setEditingProp({ ...editingProp, downPayment: e.target.value })}
                           className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all font-bold text-slate-800 font-mono"
                         />
                       </div>
                       <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">当前去化状态</label>
                         <input 
                           value={editingProp.status}
                           onChange={e => setEditingProp({ ...editingProp, status: e.target.value })}
                           className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all font-bold text-slate-800"
                         />
                       </div>
                       <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">宣传大图</label>
                         <div className="flex gap-3">
                           <input 
                             value={editingProp.imageUrl || ''}
                             onChange={e => setEditingProp({ ...editingProp, imageUrl: e.target.value })}
                             placeholder="图片 URL"
                             className="flex-grow px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all font-bold text-slate-800"
                           />
                           <label className={`cursor-pointer px-6 flex items-center justify-center ${t.secondary} text-white rounded-3xl active:scale-95 transition-all shadow-lg`}>
                             <Plus className="w-5 h-5" />
                             <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'imageUrl')} />
                           </label>
                         </div>
                       </div>
                       <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">视频内容</label>
                         <div className="flex gap-3">
                           <input 
                             value={editingProp.videoUrl || ''}
                             onChange={e => setEditingProp({ ...editingProp, videoUrl: e.target.value })}
                             placeholder="视频 URL"
                             className="flex-grow px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all font-bold text-slate-800"
                           />
                           <label className={`cursor-pointer px-6 flex items-center justify-center ${t.secondary} text-white rounded-3xl active:scale-95 transition-all shadow-lg`}>
                             <Plus className="w-5 h-5" />
                             <input type="file" accept="video/*" className="hidden" onChange={e => handleFileUpload(e, 'videoUrl')} />
                           </label>
                         </div>
                       </div>
                       <div className="col-span-full space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">核心卖点提炼</label>
                         <textarea 
                           value={editingProp.sellingPoints}
                           onChange={e => setEditingProp({ ...editingProp, sellingPoints: e.target.value })}
                           className="w-full h-32 px-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all resize-none font-bold text-slate-800 leading-relaxed"
                         />
                       </div>
                       <div className="col-span-full space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">配套设施说明</label>
                         <textarea 
                           value={editingProp.nearbyFacilities || ''}
                           onChange={e => setEditingProp({ ...editingProp, nearbyFacilities: e.target.value })}
                           className="w-full h-32 px-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl focus:ring-4 focus:ring-theme-primary/10 outline-none transition-all resize-none font-bold text-slate-800 leading-relaxed"
                         />
                       </div>
                    </div>
                 </div>

                 <div className="p-10 pt-0 flex gap-5">
                    <button 
                      onClick={() => updateProperty(editingProp)}
                      className={`flex-grow py-5 ${t.secondary} text-white rounded-[2rem] font-black text-xl shadow-2xl hover:opacity-90 active:scale-95 transition-all shadow-slate-200`}
                    >
                      保存并更新档案
                    </button>
                    <button 
                      onClick={() => setEditingProp(null)}
                      className="px-10 py-5 bg-slate-50 text-slate-400 rounded-[2rem] font-black text-lg hover:bg-slate-100 transition-all border border-slate-100"
                    >
                      舍弃更改
                    </button>
                 </div>
              </motion.div>
           </div>
        )}
      </AnimatePresence>
    </div>
  );
}
